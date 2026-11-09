import { gitBlobSha } from "../blob-sha";
import { assertSafeRepoPath } from "../paths";
import {
  ConflictError,
  GitProviderError,
  type CommitRequest,
  type CommitResult,
  type GitHistory,
  type GitProvider,
  type HistoryPage,
  type RepoFile,
  type RepoFileEntry,
} from "../types";
import { GitHubApiError, type GitHubClient } from "./github-client";

export interface GitHubProviderOptions {
  owner: string;
  repo: string;
  branch: string;
  /** Folder inside the repository that holds the content ("" = repository root). */
  contentPath: string;
  client: GitHubClient;
  /**
   * How long a read may reuse the last known head commit (default 0). Keep it
   * at 0 in production: a cached render built from an old head would stay
   * cached until the next invalidation. Head checks are conditional requests
   * (304s don't count against the rate limit) and concurrent ones are shared.
   */
  headTtlMs?: number;
}

interface Snapshot {
  commitSha: string;
  treeSha: string;
  /** Content-relative path → blob. */
  files: Map<string, { sha: string; size: number }>;
}

interface GitTreeResponse {
  sha: string;
  truncated: boolean;
  tree: Array<{ path: string; type: "blob" | "tree" | "commit"; sha: string; size?: number }>;
}

interface GitCommitListItem {
  sha: string;
  html_url: string;
  commit: { message: string; author: { name: string; email: string; date: string } | null };
}

const NAME_PATTERN = /^[A-Za-z0-9_.-]{1,100}$/;
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const BRANCH_PATTERN = /^(?!.*\.\.)(?!\/)(?!.*\/$)(?!.*@\{)[A-Za-z0-9._/-]{1,200}$/;
const MAX_COMMIT_ATTEMPTS = 3;
const MAX_BLOB_CACHE = 1000;

/**
 * Content stored in a GitHub repository, accessed through the Git Data API.
 *
 * Writes are atomic multi-file commits: build a tree on top of the current
 * head, create a commit, then move the branch with `force: false`. If the
 * branch moved in between, GitHub rejects the update and the whole operation
 * is retried against the new head — re-checking every file's expected SHA, so
 * an edit made elsewhere is reported as a conflict, never overwritten.
 */
export class GitHubProvider implements GitProvider, GitHistory {
  readonly id = "github";
  private readonly client: GitHubClient;
  private readonly prefix: string;
  private readonly repoBase: string;
  private readonly headTtlMs: number;
  private head: { sha: string; fetchedAt: number } | null = null;
  private headRequest: Promise<string> | null = null;
  private readonly trees = new Map<string, Snapshot>();
  private readonly blobs = new Map<string, string>();

  constructor(private readonly options: GitHubProviderOptions) {
    if (!NAME_PATTERN.test(options.owner) || !NAME_PATTERN.test(options.repo)) {
      throw new GitProviderError("Invalid GitHub repository name", "invalid_path");
    }
    if (!BRANCH_PATTERN.test(options.branch)) throw new GitProviderError("Invalid branch name", "invalid_path");
    const contentPath = options.contentPath.replace(/^\/+|\/+$/g, "");
    if (contentPath && contentPath.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
      throw new GitProviderError("Invalid content path", "invalid_path");
    }
    this.prefix = contentPath ? `${contentPath}/` : "";
    this.client = options.client;
    this.repoBase = `/repos/${options.owner}/${options.repo}`;
    this.headTtlMs = options.headTtlMs ?? 0;
  }

  get repository(): string {
    return `${this.options.owner}/${this.options.repo}`;
  }

  // ---- Reading -----------------------------------------------------------------

  async listFiles(dir: string): Promise<RepoFileEntry[]> {
    const safeDir = assertSafeRepoPath(dir.endsWith("/") ? dir : `${dir}/`);
    const snapshot = await this.snapshot(false);
    const entries: RepoFileEntry[] = [];
    for (const [path, blob] of snapshot.files) {
      if (path.startsWith(safeDir) && !path.slice(safeDir.length).includes("/")) {
        entries.push({ path, sha: blob.sha, size: blob.size });
      }
    }
    return entries.sort((a, b) => a.path.localeCompare(b.path));
  }

  async readFile(path: string): Promise<RepoFile | null> {
    const safePath = assertSafeRepoPath(path);
    const snapshot = await this.snapshot(false);
    const blob = snapshot.files.get(safePath);
    if (!blob) return null;
    return { path: safePath, sha: blob.sha, size: blob.size, content: await this.readBlob(blob.sha) };
  }

  // ---- Writing -----------------------------------------------------------------

  async commit(request: CommitRequest): Promise<CommitResult> {
    if (request.changes.length === 0) throw new GitProviderError("A commit needs at least one change", "invalid_path");
    const paths = request.changes.map((change) => assertSafeRepoPath(change.path));
    if (new Set(paths).size !== paths.length) {
      throw new GitProviderError("A commit cannot change the same path twice", "invalid_path");
    }

    for (let attempt = 1; attempt <= MAX_COMMIT_ATTEMPTS; attempt++) {
      const snapshot = await this.snapshot(true);
      for (const change of request.changes) {
        const actualSha = snapshot.files.get(change.path)?.sha ?? null;
        if (actualSha !== change.expectedSha) throw new ConflictError(change.path, change.expectedSha, actualSha);
      }

      const tree = await this.client.send<{ sha: string }>("POST", `${this.repoBase}/git/trees`, {
        base_tree: snapshot.treeSha,
        tree: request.changes.map((change) =>
          change.op === "delete"
            ? { path: this.toRepoPath(change.path), mode: "100644", type: "blob", sha: null }
            : { path: this.toRepoPath(change.path), mode: "100644", type: "blob", content: change.content },
        ),
      });
      const commit = await this.client.send<{ sha: string }>("POST", `${this.repoBase}/git/commits`, {
        message: request.message,
        tree: tree.sha,
        parents: [snapshot.commitSha],
        author: { name: request.author.name, email: request.author.email, date: new Date().toISOString() },
      });
      try {
        await this.client.send("PATCH", `${this.repoBase}/git/refs/heads/${this.encodeBranch(this.options.branch)}`, {
          sha: commit.sha,
          force: false,
        });
      } catch (error) {
        // 422 = not a fast-forward: someone pushed since our snapshot. Retry on the new head.
        if (error instanceof GitHubApiError && error.status === 422 && attempt < MAX_COMMIT_ATTEMPTS) continue;
        if (error instanceof GitHubApiError && error.status === 422) {
          throw new GitProviderError("The branch kept changing while saving. Please try again.", "conflict");
        }
        throw error;
      }

      this.head = { sha: commit.sha, fetchedAt: Date.now() };
      const files: CommitResult["files"] = {};
      for (const change of request.changes) {
        files[change.path] = change.op === "delete" ? null : gitBlobSha(change.content);
        if (change.op === "upsert") this.rememberBlob(gitBlobSha(change.content), change.content);
      }
      return { commitId: commit.sha, files };
    }
    throw new GitProviderError("Unable to commit", "io");
  }

  // ---- History -----------------------------------------------------------------

  async getHistory(query: { path?: string; limit: number; cursor?: string | null }): Promise<HistoryPage> {
    const limit = Math.min(Math.max(Math.trunc(query.limit), 1), 100);
    const page = query.cursor && /^\d{1,4}$/.test(query.cursor) ? Number(query.cursor) : 1;
    const params = new URLSearchParams({ sha: this.options.branch, per_page: String(limit), page: String(page) });
    params.set("path", query.path ? this.toRepoPath(assertSafeRepoPath(query.path)) : this.prefix.replace(/\/$/, ""));
    if (!params.get("path")) params.delete("path");
    const items = await this.client.get<GitCommitListItem[]>(`${this.repoBase}/commits?${params.toString()}`);
    return {
      commits: items.map((item) => ({
        sha: item.sha,
        subject: item.commit.message.split("\n")[0] ?? "",
        authorName: item.commit.author?.name ?? "unknown",
        authorEmail: item.commit.author?.email ?? null,
        date: item.commit.author?.date ?? "",
        url: item.html_url ?? null,
      })),
      nextCursor: items.length === limit ? String(page + 1) : null,
    };
  }

  async readFileAtCommit(path: string, commitSha: string): Promise<RepoFile | null> {
    const safePath = assertSafeRepoPath(path);
    if (!SHA_PATTERN.test(commitSha)) throw new GitProviderError("Invalid commit SHA", "invalid_path");
    const encodedPath = this.toRepoPath(safePath).split("/").map(encodeURIComponent).join("/");
    const content = await this.client.get<string>(`${this.repoBase}/contents/${encodedPath}?ref=${commitSha}`, {
      accept: "application/vnd.github.raw+json",
      allow404: true,
    });
    if (content === null) return null;
    return { path: safePath, sha: gitBlobSha(content), size: Buffer.byteLength(content, "utf8"), content };
  }

  async createBranch(branch: string, fromSha?: string): Promise<void> {
    if (!BRANCH_PATTERN.test(branch)) throw new GitProviderError("Invalid branch name", "invalid_path");
    if (fromSha !== undefined && !SHA_PATTERN.test(fromSha))
      throw new GitProviderError("Invalid commit SHA", "invalid_path");
    const sha = fromSha ?? (await this.snapshot(true)).commitSha;
    await this.client.send("POST", `${this.repoBase}/git/refs`, { ref: `refs/heads/${branch}`, sha });
  }

  // ---- Internals ---------------------------------------------------------------

  private toRepoPath(contentPath: string): string {
    return `${this.prefix}${contentPath}`;
  }

  private encodeBranch(branch: string): string {
    return branch.split("/").map(encodeURIComponent).join("/");
  }

  private async snapshot(fresh: boolean): Promise<Snapshot> {
    const commitSha =
      !fresh && this.head && Date.now() - this.head.fetchedAt < this.headTtlMs
        ? this.head.sha
        : await this.fetchHead(fresh);
    const cached = this.trees.get(commitSha);
    if (cached) return cached;

    // A commit's tree never changes, so snapshots are cached by commit SHA.
    const tree = await this.client.get<GitTreeResponse>(`${this.repoBase}/git/trees/${commitSha}?recursive=1`);
    if (tree.truncated) {
      throw new GitProviderError(
        "The repository tree is too large to read in one request. Set CONTENT_REPO_PATH to the content folder.",
        "io",
      );
    }
    const files = new Map<string, { sha: string; size: number }>();
    for (const entry of tree.tree) {
      if (entry.type !== "blob" || !entry.path.startsWith(this.prefix)) continue;
      files.set(entry.path.slice(this.prefix.length), { sha: entry.sha, size: entry.size ?? 0 });
    }
    const snapshot = { commitSha, treeSha: tree.sha, files };
    this.trees.clear(); // only the latest snapshot is useful
    this.trees.set(commitSha, snapshot);
    return snapshot;
  }

  /** Concurrent reads share one in-flight ref request; writes always get their own. */
  private fetchHead(fresh: boolean): Promise<string> {
    if (!fresh && this.headRequest) return this.headRequest;
    const request = this.client
      .get<{ object: { sha: string } }>(`${this.repoBase}/git/ref/heads/${this.encodeBranch(this.options.branch)}`)
      .then((ref) => {
        this.head = { sha: ref.object.sha, fetchedAt: Date.now() };
        return ref.object.sha;
      })
      .finally(() => {
        if (this.headRequest === request) this.headRequest = null;
      });
    if (!fresh) this.headRequest = request;
    return request;
  }

  private async readBlob(sha: string): Promise<string> {
    const cached = this.blobs.get(sha);
    if (cached !== undefined) return cached;
    const blob = await this.client.get<{ content: string; encoding: string }>(`${this.repoBase}/git/blobs/${sha}`);
    const content = blob.encoding === "base64" ? Buffer.from(blob.content, "base64").toString("utf8") : blob.content;
    this.rememberBlob(sha, content);
    return content;
  }

  private rememberBlob(sha: string, content: string): void {
    if (this.blobs.size >= MAX_BLOB_CACHE) this.blobs.delete(this.blobs.keys().next().value as string);
    this.blobs.set(sha, content);
  }
}
