import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { gitBlobSha } from "../blob-sha";
import { assertSafeRepoPath } from "../paths";
import {
  ConflictError,
  GitProviderError,
  type CommitRequest,
  type CommitResult,
  type GitProvider,
  type RepoFile,
  type RepoFileEntry,
} from "../types";

/**
 * Reads and writes content in a directory on disk that mirrors the content
 * repository layout. Used for local development and tests.
 *
 * It enforces the same optimistic-concurrency contract as the GitHub provider
 * (blob SHAs), but keeps no history — that comes from Git in Phase 3.
 */
export class LocalFsProvider implements GitProvider {
  readonly id = "local";
  private readonly root: string;
  /** Serializes commits within this process so check-then-write is atomic. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  async listFiles(dir: string): Promise<RepoFileEntry[]> {
    const safeDir = assertSafeRepoPath(dir.endsWith("/") ? dir : `${dir}/`);
    const absoluteDir = await this.resolveInsideRoot(safeDir);
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(absoluteDir, { withFileTypes: true });
    } catch (error) {
      if (isNotFound(error)) return [];
      throw new GitProviderError(`Unable to list ${safeDir}`, "io", { cause: error });
    }
    const files = entries.filter((entry) => entry.isFile());
    const results = await Promise.all(
      files.map(async (entry) => {
        const file = await this.readFile(path.posix.join(safeDir, entry.name));
        return file && { path: file.path, sha: file.sha, size: file.size };
      }),
    );
    return results
      .filter((entry): entry is RepoFileEntry => entry !== null)
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  async readFile(repoPath: string): Promise<RepoFile | null> {
    const safePath = assertSafeRepoPath(repoPath);
    const absolutePath = await this.resolveInsideRoot(safePath);
    try {
      const content = await fs.readFile(absolutePath, "utf8");
      return {
        path: safePath,
        content,
        sha: gitBlobSha(content),
        size: Buffer.byteLength(content, "utf8"),
      };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw new GitProviderError(`Unable to read ${safePath}`, "io", { cause: error });
    }
  }

  commit(request: CommitRequest): Promise<CommitResult> {
    const run = this.queue.then(() => this.applyCommit(request));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async applyCommit(request: CommitRequest): Promise<CommitResult> {
    if (request.changes.length === 0) {
      throw new GitProviderError("A commit needs at least one change", "invalid_path");
    }
    const paths = request.changes.map((change) => assertSafeRepoPath(change.path));
    if (new Set(paths).size !== paths.length) {
      throw new GitProviderError("A commit cannot change the same path twice", "invalid_path");
    }

    // 1. Verify every precondition before touching the disk.
    for (const change of request.changes) {
      const current = await this.readFile(change.path);
      const actualSha = current?.sha ?? null;
      if (actualSha !== change.expectedSha) {
        throw new ConflictError(change.path, change.expectedSha, actualSha);
      }
    }

    // 2. Apply. Each file is written to a temp file and renamed into place, so
    //    readers never observe a half-written file.
    const files: CommitResult["files"] = {};
    for (const change of request.changes) {
      const target = await this.resolveInsideRoot(assertSafeRepoPath(change.path));
      try {
        if (change.op === "delete") {
          await fs.rm(target);
          files[change.path] = null;
        } else {
          await fs.mkdir(path.dirname(target), { recursive: true });
          const temp = `${target}.${randomUUID()}.tmp`;
          await fs.writeFile(temp, change.content, "utf8");
          await fs.rename(temp, target);
          files[change.path] = gitBlobSha(change.content);
        }
      } catch (error) {
        throw new GitProviderError(`Unable to write ${change.path}`, "io", { cause: error });
      }
    }

    const commitId = createHash("sha1")
      .update(`${request.message}\0${Date.now()}\0${JSON.stringify(files)}`)
      .digest("hex");
    return { commitId, files };
  }

  /**
   * Resolves symlinks and verifies the final location is still inside the
   * root, so a symlink in the content folder can't expose or overwrite
   * arbitrary files. For paths that don't exist yet, the nearest existing
   * ancestor is checked instead.
   */
  private async resolveInsideRoot(safePath: string): Promise<string> {
    const candidate = path.resolve(this.root, safePath);
    const realRoot = await fs.realpath(this.root).catch(() => this.root);
    let existing = candidate;
    let suffix = "";
    for (;;) {
      try {
        const real = await fs.realpath(existing);
        if (real !== realRoot && !real.startsWith(realRoot + path.sep)) {
          throw new GitProviderError(`Path escapes content root: ${safePath}`, "invalid_path");
        }
        return suffix ? path.join(real, suffix) : real;
      } catch (error) {
        if (error instanceof GitProviderError) throw error;
        if (!isNotFound(error)) throw new GitProviderError(`Unable to resolve ${safePath}`, "io", { cause: error });
        // A missing root means "no content yet", not an escape attempt.
        if (existing === this.root) return candidate;
        const parent = path.dirname(existing);
        if (parent === existing) return candidate;
        suffix = suffix ? path.join(path.basename(existing), suffix) : path.basename(existing);
        existing = parent;
      }
    }
  }
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
