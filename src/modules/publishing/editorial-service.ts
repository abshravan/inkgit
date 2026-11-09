import { emptyFormValues, formValuesFromData, MANAGED_KEYS, type ArticleFormValues } from "@/modules/content/editable";
import type { ContentService } from "@/modules/content/content-service";
import { POSTS_DIR } from "@/modules/content/content-service";
import { splitFrontmatter } from "@/modules/content/parse";
import { articleFrontmatterSchema } from "@/modules/content/schema";
import { serializeArticle } from "@/modules/content/serialize";
import { isValidSlug } from "@/modules/content/slug";
import {
  ConflictError,
  GitProviderError,
  supportsHistory,
  type CommitAuthor,
  type GitProvider,
  type RepoFile,
} from "@/modules/git/types";
import { compileContent, ContentRenderError } from "@/modules/rendering/pipeline";
import { commitMessage } from "./commit-messages";
import type {
  AdminArticleSummary,
  AdminOverview,
  ArticleHistory,
  ArticleRevision,
  DeleteArticleResult,
  RenameResult,
  RestoreResult,
  EditableArticle,
  SaveArticleInput,
  SaveArticleResult,
} from "./types";

const MAX_BODY_BYTES = 900_000;

export interface EditorialOptions {
  /** Returns today's date (YYYY-MM-DD, UTC). Injected for deterministic tests. */
  today: () => string;
}

/**
 * Application service behind the admin dashboard: loading articles for
 * editing and turning editor intents into validated, conditional commits.
 *
 * It never writes without an expected blob SHA, so changes made outside InkGit
 * surface as conflicts instead of being overwritten.
 */
export class EditorialService {
  constructor(
    private readonly provider: GitProvider,
    private readonly content: ContentService,
    private readonly options: EditorialOptions,
  ) {}

  async getOverview(): Promise<AdminOverview> {
    const index = await this.content.loadIndex();
    const issuesByPath = new Map<string, AdminArticleSummary["issues"]>();
    const globalIssues: AdminOverview["globalIssues"] = [];
    for (const issue of index.issues) {
      if (!issue.path.startsWith(POSTS_DIR)) {
        globalIssues.push(issue);
        continue;
      }
      issuesByPath.set(issue.path, [...(issuesByPath.get(issue.path) ?? []), issue]);
    }

    const articles: AdminArticleSummary[] = index.articles.map((article) => ({
      slug: article.slug,
      path: article.path,
      title: article.title,
      status: article.published ? "published" : "draft",
      featured: article.featured,
      date: article.date,
      updatedAt: article.updatedAt ?? null,
      tags: article.tags.map((tag) => tag.name),
      categories: article.categories.map((category) => category.name),
      wordCount: article.wordCount,
      issues: issuesByPath.get(article.path) ?? [],
    }));

    // Files that failed validation still appear, so they can be fixed.
    const validPaths = new Set(articles.map((article) => article.path));
    for (const [path, issues] of issuesByPath) {
      if (validPaths.has(path)) continue;
      const slug = path.slice(POSTS_DIR.length).replace(/\.(mdx|md)$/, "");
      articles.push({
        slug,
        path,
        title: slug,
        status: "invalid",
        featured: false,
        date: null,
        updatedAt: null,
        tags: [],
        categories: [],
        wordCount: null,
        issues,
      });
    }
    return { articles, categories: index.categories, globalIssues };
  }

  async loadForEdit(slug: string): Promise<EditableArticle | null> {
    if (!isValidSlug(slug)) return null;
    const file = await this.findArticleFile(slug);
    if (!file) return null;
    const format = file.path.endsWith(".md") ? "md" : "mdx";
    const split = splitFrontmatter(file);
    const data = split.ok ? split.value.data : {};
    const body = split.ok ? split.value.body.replace(/^\n+/, "") : file.content;
    const issues = split.ok ? [] : split.error.map((issue) => issue.message);
    if (split.ok) {
      const validation = articleFrontmatterSchema.safeParse(data);
      if (!validation.success) {
        issues.push(...validation.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`.trim()));
      }
    }
    return {
      slug,
      path: file.path,
      sha: file.sha,
      format,
      published: data.published === true,
      values: formValuesFromData(data, this.options.today()),
      body,
      issues,
    };
  }

  newArticleValues(): ArticleFormValues {
    return emptyFormValues(this.options.today());
  }

  async save(input: SaveArticleInput, author: CommitAuthor): Promise<SaveArticleResult> {
    if (!isValidSlug(input.slug)) {
      return invalid({ slug: ["Use lowercase letters, numbers and single hyphens (e.g. my-first-post)"] });
    }
    if (Buffer.byteLength(input.body, "utf8") > MAX_BODY_BYTES) {
      return invalid({ body: ["The article is too large (limit ~900 KB)"] });
    }

    const existing = await this.findArticleFile(input.slug);
    const expectedSha = input.overwrite ? input.overwrite.remoteSha : input.baseSha;
    if ((existing?.sha ?? null) !== expectedSha) {
      return conflict(existing, input.baseSha === null ? "An article with this slug already exists." : undefined);
    }

    const previous = existing ? splitFrontmatter(existing) : null;
    const previousData = previous?.ok ? previous.value.data : {};
    const wasPublished = previousData.published === true;
    const published = input.intent === "publish" ? true : input.intent === "unpublish" ? false : wasPublished;

    const frontmatter = this.buildFrontmatter(previousData, input.values, published);
    const validation = articleFrontmatterSchema.safeParse(frontmatter);
    if (!validation.success) {
      const fieldErrors: Record<string, string[]> = {};
      const formErrors: string[] = [];
      for (const issue of validation.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string") (fieldErrors[key] ??= []).push(issue.message);
        else formErrors.push(issue.message);
      }
      return { status: "invalid", fieldErrors, formErrors };
    }

    const format = existing?.path.endsWith(".md") ? "md" : "mdx";
    if (published) {
      // Never publish something the public site can't render.
      try {
        await compileContent(input.body, format);
      } catch (error) {
        if (error instanceof ContentRenderError) {
          return { status: "render-error", message: error.message, ...(error.line && { line: error.line }) };
        }
        throw error;
      }
    }

    const path = existing?.path ?? `${POSTS_DIR}${input.slug}.mdx`;
    const content = serializeArticle(frontmatter, input.body);
    const action = !existing
      ? "create"
      : published && !wasPublished
        ? "publish"
        : !published && wasPublished
          ? "unpublish"
          : "update";
    try {
      const result = await this.provider.commit({
        message: commitMessage(action, input.slug, { draft: !published, overwrite: Boolean(input.overwrite) }),
        author,
        changes: [{ op: "upsert", path, content, expectedSha }],
      });
      return {
        status: "saved",
        slug: input.slug,
        sha: result.files[path] ?? "",
        published,
        savedAt: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof ConflictError) return conflict(await this.findArticleFile(input.slug));
      return { status: "error", message: describeError(error) };
    }
  }

  async delete(slug: string, baseSha: string, author: CommitAuthor): Promise<DeleteArticleResult> {
    if (!isValidSlug(slug)) return { status: "error", message: "Invalid slug" };
    const existing = await this.findArticleFile(slug);
    if (!existing) return { status: "conflict", message: "The article no longer exists." };
    if (existing.sha !== baseSha) {
      return { status: "conflict", message: "The article changed since you loaded it. Reload before deleting." };
    }
    try {
      await this.provider.commit({
        message: commitMessage("delete", slug),
        author,
        changes: [{ op: "delete", path: existing.path, expectedSha: baseSha }],
      });
      return { status: "deleted" };
    } catch (error) {
      if (error instanceof ConflictError) return { status: "conflict", message: error.message };
      return { status: "error", message: describeError(error) };
    }
  }

  // ---- History, restore, rename ---------------------------------------------------

  get historySupported(): boolean {
    return supportsHistory(this.provider);
  }

  async getHistory(slug: string, cursor: string | null, limit = 20): Promise<ArticleHistory> {
    if (!supportsHistory(this.provider) || !isValidSlug(slug))
      return { supported: false, commits: [], nextCursor: null };
    const file = await this.findArticleFile(slug);
    const path = file?.path ?? `${POSTS_DIR}${slug}.mdx`;
    const page = await this.provider.getHistory({ path, limit, cursor });
    return { supported: true, commits: page.commits, nextCursor: page.nextCursor };
  }

  async getRevision(slug: string, commitSha: string): Promise<ArticleRevision | null> {
    if (!supportsHistory(this.provider) || !isValidSlug(slug) || !/^[0-9a-f]{40}$/.test(commitSha)) return null;
    const current = await this.findArticleFile(slug);
    const path = current?.path ?? `${POSTS_DIR}${slug}.mdx`;
    const old =
      (await this.provider.readFileAtCommit(path, commitSha)) ??
      (path.endsWith(".mdx") ? null : await this.provider.readFileAtCommit(`${POSTS_DIR}${slug}.mdx`, commitSha));
    return {
      commitSha,
      content: old?.content ?? null,
      current: current?.content ?? null,
      currentSha: current?.sha ?? null,
    };
  }

  /**
   * Restores an article to its content at `commitSha` by committing that
   * content as a new version. History is never rewritten.
   */
  async restore(slug: string, commitSha: string, baseSha: string | null, author: CommitAuthor): Promise<RestoreResult> {
    const revision = await this.getRevision(slug, commitSha);
    if (!revision || revision.content === null)
      return { status: "error", message: "That version doesn't contain this article." };
    if (revision.currentSha !== baseSha) {
      return { status: "conflict", message: "The article changed since you opened its history. Reload and try again." };
    }
    if (revision.current === revision.content)
      return { status: "error", message: "That version is identical to the current one." };
    const existing = await this.findArticleFile(slug);
    const path = existing?.path ?? `${POSTS_DIR}${slug}.mdx`;
    try {
      const result = await this.provider.commit({
        message: commitMessage("restore", slug, { fromCommit: commitSha }),
        author,
        changes: [{ op: "upsert", path, content: revision.content, expectedSha: baseSha }],
      });
      return { status: "restored", sha: result.files[path] ?? "" };
    } catch (error) {
      if (error instanceof ConflictError) return { status: "conflict", message: error.message };
      return { status: "error", message: describeError(error) };
    }
  }

  /**
   * Renames an article in one atomic commit (delete old file + create new),
   * recording the old slug in `redirectFrom` so existing links keep working.
   */
  async rename(oldSlug: string, newSlug: string, baseSha: string, author: CommitAuthor): Promise<RenameResult> {
    if (!isValidSlug(newSlug)) {
      return { status: "invalid", message: "Use lowercase letters, numbers and single hyphens (e.g. my-first-post)." };
    }
    if (newSlug === oldSlug) return { status: "invalid", message: "The new slug is the same as the current one." };
    const existing = await this.findArticleFile(oldSlug);
    if (!existing) return { status: "conflict", message: "The article no longer exists." };
    if (existing.sha !== baseSha)
      return { status: "conflict", message: "Save or reload your changes before renaming." };
    if (await this.findArticleFile(newSlug))
      return { status: "invalid", message: `An article with the slug "${newSlug}" already exists.` };

    const split = splitFrontmatter(existing);
    if (!split.ok) return { status: "invalid", message: "Fix the article's frontmatter before renaming it." };
    const data = { ...split.value.data };
    const redirects = Array.isArray(data.redirectFrom)
      ? data.redirectFrom.filter((v): v is string => typeof v === "string")
      : [];
    data.redirectFrom = [...new Set([...redirects, oldSlug])].filter((slug) => slug !== newSlug);
    if ("slug" in data) data.slug = newSlug;

    const extension = existing.path.endsWith(".md") ? "md" : "mdx";
    const newPath = `${POSTS_DIR}${newSlug}.${extension}`;
    const content = serializeArticle(data, split.value.body);
    try {
      const result = await this.provider.commit({
        message: commitMessage("rename", newSlug, { fromSlug: oldSlug }),
        author,
        changes: [
          { op: "delete", path: existing.path, expectedSha: baseSha },
          { op: "upsert", path: newPath, content, expectedSha: null },
        ],
      });
      return { status: "renamed", slug: newSlug, sha: result.files[newPath] ?? "" };
    } catch (error) {
      if (error instanceof ConflictError) return { status: "conflict", message: error.message };
      return { status: "error", message: describeError(error) };
    }
  }

  private buildFrontmatter(
    previous: Record<string, unknown>,
    values: ArticleFormValues,
    published: boolean,
  ): Record<string, unknown> {
    const preserved = Object.fromEntries(
      Object.entries(previous).filter(
        ([key]) =>
          !(MANAGED_KEYS as readonly string[]).includes(key) ||
          key === "slug" ||
          key === "canonicalUrl" ||
          key === "redirectFrom",
      ),
    );
    const today = this.options.today();
    const updatedAt = published && today > values.date ? today : undefined;
    return {
      ...preserved,
      title: values.title,
      description: values.description,
      date: values.date,
      updatedAt,
      author: values.author || undefined,
      tags: values.tags,
      categories: values.categories,
      coverImage: values.coverImage || undefined,
      coverAlt: values.coverAlt || undefined,
      published,
      featured: values.featured,
    };
  }

  private async findArticleFile(slug: string): Promise<RepoFile | null> {
    for (const extension of ["mdx", "md"] as const) {
      const file = await this.provider.readFile(`${POSTS_DIR}${slug}.${extension}`);
      if (file) return file;
    }
    return null;
  }
}

function invalid(fieldErrors: Record<string, string[]>): SaveArticleResult {
  return { status: "invalid", fieldErrors, formErrors: [] };
}

function conflict(remote: RepoFile | null, message?: string): SaveArticleResult {
  return {
    status: "conflict",
    message:
      message ??
      (remote
        ? "This article was changed outside the editor since you opened it."
        : "This article was deleted outside the editor since you opened it."),
    remote: { sha: remote?.sha ?? null, content: remote?.content ?? null },
  };
}

function describeError(error: unknown): string {
  if (error instanceof GitProviderError) return error.message;
  console.error("[inkgit:editorial]", error);
  return "Something went wrong while saving. Please try again.";
}
