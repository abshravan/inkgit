/**
 * Domain types for parsed content. All values are plain, serializable data so
 * they can cross the server cache boundary (`'use cache'`) and RSC payloads.
 */

export interface TaxonomyTerm {
  slug: string;
  name: string;
}

export interface Category extends TaxonomyTerm {
  description?: string;
}

export interface TermWithCount<T extends TaxonomyTerm = TaxonomyTerm> {
  term: T;
  count: number;
}

export interface Article {
  slug: string;
  /** Repo path of the source file, e.g. `posts/hello.mdx`. */
  path: string;
  /** Git blob SHA of the source — basis for optimistic concurrency later. */
  sha: string;
  format: "md" | "mdx";
  title: string;
  description: string;
  date: string;
  updatedAt?: string;
  author: string;
  tags: TaxonomyTerm[];
  categories: Category[];
  coverImage?: string;
  coverAlt?: string;
  published: boolean;
  featured: boolean;
  canonicalUrl?: string;
  redirectFrom: string[];
  /** MDX/Markdown body without frontmatter. */
  body: string;
  wordCount: number;
  readingTimeMinutes: number;
  excerpt: string;
}

export interface Page {
  slug: string;
  path: string;
  sha: string;
  format: "md" | "mdx";
  title: string;
  description?: string;
  updatedAt?: string;
  body: string;
}

export type IssueSeverity = "error" | "warning";

/**
 * A problem found while loading content. Errors exclude the file from the
 * public site; warnings keep it but are surfaced to the author.
 */
export interface ContentIssue {
  path: string;
  severity: IssueSeverity;
  message: string;
}

export interface ContentIndex {
  /** Every valid article, including drafts. Public queries filter further. */
  articles: Article[];
  categories: Category[];
  issues: ContentIssue[];
}
