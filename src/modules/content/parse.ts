import matter from "gray-matter";
import type { z } from "zod";
import { err, ok, type Result } from "@/lib/result";
import { createExcerpt, countWords, estimateReadingTime } from "@/modules/rendering/text-stats";
import { articleFrontmatterSchema, pageFrontmatterSchema, type ArticleFrontmatter } from "./schema";
import { isValidSlug, slugFromFilename } from "./slug";
import type { Article, ContentIssue, Page } from "./types";

export interface SourceFile {
  path: string;
  sha: string;
  content: string;
}

export interface ArticleParseOptions {
  defaultAuthor: string;
  wordsPerMinute: number;
}

/** Frontmatter + derived fields; taxonomy terms are resolved later by the index builder. */
export type ParsedArticle = Omit<Article, "tags" | "categories"> & {
  tagLabels: string[];
  categoryLabels: string[];
};

const MAX_SOURCE_BYTES = 1_000_000;

export function splitFrontmatter(file: SourceFile): Result<{ data: Record<string, unknown>; body: string }, ContentIssue[]> {
  if (Buffer.byteLength(file.content, "utf8") > MAX_SOURCE_BYTES) {
    return err([{ path: file.path, severity: "error", message: "File exceeds the 1 MB content limit" }]);
  }
  try {
    // Passing an options object disables gray-matter's global content cache,
    // which would otherwise return shared mutable objects between calls.
    const parsed = matter(file.content, {});
    return ok({ data: parsed.data as Record<string, unknown>, body: parsed.content });
  } catch (error) {
    const reason = error instanceof Error ? error.message.split("\n")[0] : "unknown error";
    return err([{ path: file.path, severity: "error", message: `Invalid YAML frontmatter: ${reason}` }]);
  }
}

function zodIssues(path: string, error: z.ZodError): ContentIssue[] {
  return error.issues.map((issue) => ({
    path,
    severity: "error" as const,
    message: issue.path.length ? `${issue.path.join(".")} ${issue.message}` : issue.message,
  }));
}

/**
 * Parses and validates one article file. Pure: never throws for bad content —
 * returns issues instead, so one broken file can't take down the site.
 */
export function parseArticle(
  file: SourceFile,
  options: ArticleParseOptions,
): Result<{ article: ParsedArticle; warnings: ContentIssue[] }, ContentIssue[]> {
  const filename = file.path.split("/").at(-1) ?? "";
  const identity = slugFromFilename(filename);
  if (!identity) {
    return err([{ path: file.path, severity: "error", message: "Filename must end in .md or .mdx" }]);
  }
  const { slug, format } = identity;
  const split = splitFrontmatter(file);
  if (!split.ok) return split;

  const validation = articleFrontmatterSchema.safeParse(split.value.data);
  if (!validation.success) return err(zodIssues(file.path, validation.error));
  const frontmatter: ArticleFrontmatter = validation.data;

  const errors: ContentIssue[] = [];
  if (!isValidSlug(slug)) {
    errors.push({ path: file.path, severity: "error", message: "Filename must be a lowercase kebab-case slug" });
  }
  if (frontmatter.slug && frontmatter.slug !== slug) {
    errors.push({
      path: file.path,
      severity: "error",
      message: `slug "${frontmatter.slug}" does not match filename "${slug}"`,
    });
  }
  if (errors.length) return err(errors);

  const warnings: ContentIssue[] = [];
  if (frontmatter.coverImage && !frontmatter.coverAlt) {
    warnings.push({ path: file.path, severity: "warning", message: "coverImage has no coverAlt; using the title as alt text" });
  }

  const body = split.value.body.replace(/^\s*\n/, "");
  return ok({
    article: {
      slug,
      path: file.path,
      sha: file.sha,
      format,
      title: frontmatter.title,
      description: frontmatter.description,
      date: frontmatter.date,
      ...(frontmatter.updatedAt && { updatedAt: frontmatter.updatedAt }),
      author: frontmatter.author ?? options.defaultAuthor,
      tagLabels: dedupe(frontmatter.tags),
      categoryLabels: dedupe(frontmatter.categories),
      ...(frontmatter.coverImage && { coverImage: frontmatter.coverImage, coverAlt: frontmatter.coverAlt ?? frontmatter.title }),
      published: frontmatter.published,
      featured: frontmatter.featured,
      ...(frontmatter.canonicalUrl && { canonicalUrl: frontmatter.canonicalUrl }),
      redirectFrom: frontmatter.redirectFrom,
      body,
      wordCount: countWords(body),
      readingTimeMinutes: estimateReadingTime(body, options.wordsPerMinute),
      excerpt: createExcerpt(body),
    },
    warnings,
  });
}

export function parsePage(file: SourceFile): Result<Page, ContentIssue[]> {
  const filename = file.path.split("/").at(-1) ?? "";
  const identity = slugFromFilename(filename);
  if (!identity) return err([{ path: file.path, severity: "error", message: "Filename must end in .md or .mdx" }]);
  const split = splitFrontmatter(file);
  if (!split.ok) return split;
  const validation = pageFrontmatterSchema.safeParse(split.value.data);
  if (!validation.success) return err(zodIssues(file.path, validation.error));
  const { title, description, updatedAt } = validation.data;
  return ok({
    slug: identity.slug,
    path: file.path,
    sha: file.sha,
    format: identity.format,
    title,
    ...(description && { description }),
    ...(updatedAt && { updatedAt }),
    body: split.value.body.replace(/^\s*\n/, ""),
  });
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
