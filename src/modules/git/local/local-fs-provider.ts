import { promises as fs } from "node:fs";
import path from "node:path";
import { gitBlobSha } from "../blob-sha";
import { assertSafeRepoPath } from "../paths";
import { GitProviderError, type GitReader, type RepoFile, type RepoFileEntry } from "../types";

/**
 * Reads content from a directory on disk that mirrors the content repository
 * layout. Used for local development, tests, and Phase 1.
 */
export class LocalFsProvider implements GitReader {
  readonly id = "local";
  private readonly root: string;

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

  /**
   * Resolves symlinks and verifies the final location is still inside the
   * root, so a symlink in the content folder can't expose arbitrary files.
   */
  private async resolveInsideRoot(safePath: string): Promise<string> {
    const candidate = path.resolve(this.root, safePath);
    let real: string;
    try {
      real = await fs.realpath(candidate);
    } catch (error) {
      if (isNotFound(error)) return candidate;
      throw new GitProviderError(`Unable to resolve ${safePath}`, "io", { cause: error });
    }
    const realRoot = await fs.realpath(this.root).catch(() => this.root);
    if (real !== realRoot && !real.startsWith(realRoot + path.sep)) {
      throw new GitProviderError(`Path escapes content root: ${safePath}`, "invalid_path");
    }
    return real;
  }
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
