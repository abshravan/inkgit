/**
 * Git provider abstraction.
 *
 * Split by capability (Interface Segregation): the public site only needs to
 * read, so Phase 1 defines `GitReader`. Write and history capabilities are
 * added as separate interfaces in later phases and composed into `GitProvider`.
 */

export interface RepoFileEntry {
  /** Repo-relative POSIX path, e.g. `posts/hello-world.mdx`. */
  path: string;
  /** Git blob SHA-1 of the file content (same value GitHub reports). */
  sha: string;
  size: number;
}

export interface RepoFile extends RepoFileEntry {
  content: string;
}

export interface GitReader {
  /** Stable identifier for logging/diagnostics, e.g. `local`, `github`. */
  readonly id: string;
  /** Lists files (non-recursive) directly inside `dir`. Missing dir → empty list. */
  listFiles(dir: string): Promise<RepoFileEntry[]>;
  /** Reads a UTF-8 file. Missing file → `null`. */
  readFile(path: string): Promise<RepoFile | null>;
}

export class GitProviderError extends Error {
  constructor(
    message: string,
    readonly code: "invalid_path" | "not_found" | "io" | "conflict" | "rate_limited",
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "GitProviderError";
  }
}

/** Thrown when a file changed since the caller read it (optimistic concurrency). */
export class ConflictError extends GitProviderError {
  constructor(
    readonly path: string,
    readonly expectedSha: string | null,
    readonly actualSha: string | null,
  ) {
    super(
      expectedSha === null
        ? `${path} already exists`
        : actualSha === null
          ? `${path} was deleted since it was loaded`
          : `${path} was changed since it was loaded`,
      "conflict",
    );
    this.name = "ConflictError";
  }
}

/**
 * A single file change. `expectedSha` is the blob SHA the caller last saw:
 * `null` means "the file must not exist yet". Every write is conditional —
 * there is deliberately no way to overwrite a file blindly.
 */
export type FileChange =
  | { op: "upsert"; path: string; content: string; expectedSha: string | null }
  | { op: "delete"; path: string; expectedSha: string };

export interface CommitAuthor {
  name: string;
  email: string;
}

export interface CommitRequest {
  message: string;
  author: CommitAuthor;
  changes: FileChange[];
}

export interface CommitResult {
  /** Commit identifier (a Git commit SHA for real providers). */
  commitId: string;
  /** New blob SHA per changed path; `null` for deleted files. */
  files: Record<string, string | null>;
}

export interface GitWriter {
  /** Applies all changes atomically, or none if any precondition fails. */
  commit(request: CommitRequest): Promise<CommitResult>;
}

/** A provider that can both read and write content. */
export type GitProvider = GitReader & GitWriter;

export interface CommitSummary {
  sha: string;
  /** First line of the commit message. */
  subject: string;
  authorName: string;
  authorEmail: string | null;
  /** ISO 8601 timestamp. */
  date: string;
  /** Link to the commit on the Git host, when available. */
  url: string | null;
}

export interface HistoryPage {
  commits: CommitSummary[];
  /** Opaque cursor for the next page, or null when there are no more. */
  nextCursor: string | null;
}

/**
 * Optional capability: providers backed by real Git history implement this.
 * The local filesystem provider does not, and the UI degrades gracefully.
 */
export interface GitHistory {
  getHistory(query: { path?: string; limit: number; cursor?: string | null }): Promise<HistoryPage>;
  /** Reads a file as it was at `commitSha`. Missing at that commit → `null`. */
  readFileAtCommit(path: string, commitSha: string): Promise<RepoFile | null>;
  /** Creates `branch` pointing at `fromSha` (or the current head). */
  createBranch(branch: string, fromSha?: string): Promise<void>;
}

export function supportsHistory(provider: GitProvider): provider is GitProvider & GitHistory {
  return "getHistory" in provider && typeof (provider as Partial<GitHistory>).getHistory === "function";
}
