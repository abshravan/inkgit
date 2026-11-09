"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { MdxContent } from "@/components/mdx/mdx-content";
import { commitAuthorFor, requireAdminAction, UnauthorizedError } from "@/modules/auth/guards";
import { signIn, signOut } from "@/modules/auth/auth";
import { getEditorialService, getTaxonomyService } from "@/modules/content/container";
import { articleFormSchema } from "@/modules/content/editable";
import { CONTENT_CACHE_TAG } from "@/modules/content/queries";
import type { TaxonomyResult } from "@/modules/publishing/taxonomy-service";
import type { DeleteArticleResult, RenameResult, RestoreResult, SaveArticleResult } from "@/modules/publishing/types";
import { compileContent, ContentRenderError, type TocEntry } from "@/modules/rendering/pipeline";
import { countWords } from "@/modules/rendering/text-stats";

/**
 * Server actions are public HTTP endpoints. Every action here:
 *  1. verifies the admin session (never trusts the UI or proxy),
 *  2. validates its input with Zod (never trusts the client's types),
 *  3. delegates to the editorial service, and
 *  4. expires the public content cache so readers see the change.
 */

const blobSha = z.string().regex(/^[0-9a-f]{40}$/);
const MAX_BODY_CHARS = 900_000;

const saveInputSchema = z.object({
  slug: z.string().max(100),
  baseSha: blobSha.nullable(),
  intent: z.enum(["save", "publish", "unpublish"]),
  values: articleFormSchema,
  body: z.string().max(MAX_BODY_CHARS),
  overwrite: z.object({ remoteSha: blobSha.nullable() }).optional(),
});

/** Maps nested issues (`values.description`) to the form's field names (`description`). */
function toInvalidResult(error: z.ZodError): SaveArticleResult {
  const fieldErrors: Record<string, string[]> = {};
  const formErrors: string[] = [];
  for (const issue of error.issues) {
    const [first, second] = issue.path;
    const key = first === "values" ? second : first;
    if (typeof key === "string") (fieldErrors[key] ??= []).push(issue.message);
    else formErrors.push(issue.message);
  }
  return { status: "invalid", fieldErrors, formErrors };
}

/** Expire cached content so readers see the change (see ARCHITECTURE.md §13). */
function refreshPublicSite(): void {
  updateTag(CONTENT_CACHE_TAG);
}

function unauthorized(): { status: "error"; message: string } {
  return { status: "error", message: new UnauthorizedError().message };
}

export async function saveArticleAction(input: unknown): Promise<SaveArticleResult> {
  const admin = await requireAdminAction().catch(() => null);
  if (!admin) return unauthorized();
  const parsed = saveInputSchema.safeParse(input);
  if (!parsed.success) return toInvalidResult(parsed.error);
  const { overwrite, ...rest } = parsed.data;
  const result = await getEditorialService().save({ ...rest, ...(overwrite && { overwrite }) }, commitAuthorFor(admin));
  if (result.status === "saved") refreshPublicSite();
  return result;
}

const deleteInputSchema = z.object({ slug: z.string().max(100), baseSha: blobSha });

export async function deleteArticleAction(input: unknown): Promise<DeleteArticleResult> {
  const admin = await requireAdminAction().catch(() => null);
  if (!admin) return unauthorized();
  const parsed = deleteInputSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Invalid request" };
  const result = await getEditorialService().delete(parsed.data.slug, parsed.data.baseSha, commitAuthorFor(admin));
  if (result.status === "deleted") refreshPublicSite();
  return result;
}

const restoreInputSchema = z.object({ slug: z.string().max(100), commitSha: blobSha, baseSha: blobSha.nullable() });

export async function restoreArticleAction(input: unknown): Promise<RestoreResult> {
  const admin = await requireAdminAction().catch(() => null);
  if (!admin) return unauthorized();
  const parsed = restoreInputSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Invalid request" };
  const { slug, commitSha, baseSha } = parsed.data;
  const result = await getEditorialService().restore(slug, commitSha, baseSha, commitAuthorFor(admin));
  if (result.status === "restored") refreshPublicSite();
  return result;
}

const renameInputSchema = z.object({ slug: z.string().max(100), newSlug: z.string().max(100), baseSha: blobSha });

export async function renameArticleAction(input: unknown): Promise<RenameResult> {
  const admin = await requireAdminAction().catch(() => null);
  if (!admin) return unauthorized();
  const parsed = renameInputSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid", message: "Invalid request" };
  const { slug, newSlug, baseSha } = parsed.data;
  const result = await getEditorialService().rename(slug, newSlug.trim(), baseSha, commitAuthorFor(admin));
  if (result.status === "renamed") refreshPublicSite();
  return result;
}

const termName = z.string().trim().min(1).max(60);
const termSlug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(100);
const taxonomyInputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("add-category"), name: termName, description: z.string().trim().max(300) }),
  z.object({
    type: z.literal("update-category"),
    slug: termSlug,
    name: termName,
    description: z.string().trim().max(300),
  }),
  z.object({ type: z.literal("delete-category"), slug: termSlug }),
  z.object({ type: z.literal("rename-tag"), slug: termSlug, name: termName }),
  z.object({ type: z.literal("delete-tag"), slug: termSlug }),
]);

export async function taxonomyAction(input: unknown): Promise<TaxonomyResult> {
  const admin = await requireAdminAction().catch(() => null);
  if (!admin) return unauthorized();
  const parsed = taxonomyInputSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid", message: parsed.error.issues[0]?.message ?? "Invalid request" };
  const result = await getTaxonomyService().apply(parsed.data, commitAuthorFor(admin));
  if (result.status === "saved" && result.filesChanged > 0) refreshPublicSite();
  return result;
}

const previewInputSchema = z.object({ body: z.string().max(MAX_BODY_CHARS), format: z.enum(["md", "mdx"]) });

export type PreviewResult =
  | { ok: true; content: React.ReactNode; toc: TocEntry[]; warnings: string[]; wordCount: number }
  | { ok: false; message: string; line?: number };

/**
 * Renders a live preview with the exact production pipeline and components,
 * returned as a React tree (RSC payload) — no HTML strings, no client-side MDX.
 */
export async function renderPreviewAction(input: unknown): Promise<PreviewResult> {
  const admin = await requireAdminAction().catch(() => null);
  if (!admin) return { ok: false, message: new UnauthorizedError().message };
  const parsed = previewInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid request" };
  try {
    const compiled = await compileContent(parsed.data.body, parsed.data.format);
    return {
      ok: true,
      content: <MdxContent code={compiled.code} />,
      toc: compiled.toc,
      warnings: compiled.warnings,
      wordCount: countWords(parsed.data.body),
    };
  } catch (error) {
    if (error instanceof ContentRenderError)
      return { ok: false, message: error.message, ...(error.line && { line: error.line }) };
    throw error;
  }
}

export async function signInWithGitHubAction(): Promise<void> {
  await signIn("github", { redirectTo: "/admin" });
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
