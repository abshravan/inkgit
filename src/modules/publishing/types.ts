import type { ArticleFormValues } from "@/modules/content/editable";
import type { Category, ContentIssue } from "@/modules/content/types";

/** Serializable result types shared by the editorial service, actions and UI. */

export type ArticleStatus = "published" | "draft" | "invalid";

export interface AdminArticleSummary {
  slug: string;
  path: string;
  title: string;
  status: ArticleStatus;
  featured: boolean;
  date: string | null;
  updatedAt: string | null;
  tags: string[];
  categories: string[];
  wordCount: number | null;
  issues: ContentIssue[];
}

export interface AdminOverview {
  articles: AdminArticleSummary[];
  categories: Category[];
  /** Issues not tied to an article file (e.g. `taxonomy.yml`). */
  globalIssues: ContentIssue[];
}

export interface EditableArticle {
  slug: string;
  path: string;
  sha: string;
  format: "md" | "mdx";
  published: boolean;
  values: ArticleFormValues;
  body: string;
  /** Problems with the stored file (e.g. invalid frontmatter) shown in the editor. */
  issues: string[];
}

export type SaveIntent = "save" | "publish" | "unpublish";

export interface SaveArticleInput {
  slug: string;
  /** Blob SHA the editor loaded; `null` when creating a new article. */
  baseSha: string | null;
  intent: SaveIntent;
  values: ArticleFormValues;
  body: string;
  /** Explicit, user-confirmed overwrite after a conflict. */
  overwrite?: { remoteSha: string | null };
}

export type SaveArticleResult =
  | { status: "saved"; slug: string; sha: string; published: boolean; savedAt: string }
  | { status: "invalid"; fieldErrors: Record<string, string[]>; formErrors: string[] }
  | { status: "render-error"; message: string; line?: number }
  | { status: "conflict"; message: string; remote: { sha: string | null; content: string | null } }
  | { status: "error"; message: string };

export type DeleteArticleResult =
  { status: "deleted" } | { status: "conflict"; message: string } | { status: "error"; message: string };

export interface ArticleHistory {
  supported: boolean;
  commits: import("@/modules/git/types").CommitSummary[];
  nextCursor: string | null;
}

export interface ArticleRevision {
  commitSha: string;
  /** File content at that commit (null if the file didn't exist there). */
  content: string | null;
  /** Current content on the branch (null if the article was deleted). */
  current: string | null;
  currentSha: string | null;
}

export type RestoreResult =
  { status: "restored"; sha: string } | { status: "conflict"; message: string } | { status: "error"; message: string };

export type RenameResult =
  | { status: "renamed"; slug: string; sha: string }
  | { status: "invalid"; message: string }
  | { status: "conflict"; message: string }
  | { status: "error"; message: string };
