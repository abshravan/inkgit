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
