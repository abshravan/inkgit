import { GitProviderError } from "./types";

/** Top-level locations inside the content repository that InkGit may touch. */
export const CONTENT_PREFIXES = ["posts/", "pages/"] as const;
export const CONTENT_ROOT_FILES = ["taxonomy.yml"] as const;

/**
 * Normalizes a repo-relative path and rejects anything that could escape the
 * repository root or target files outside the allowlist.
 *
 * Throws `GitProviderError("invalid_path")` instead of returning a boolean so a
 * forgotten check can never silently pass.
 */
export function assertSafeRepoPath(
  input: string,
  allowed: { prefixes: readonly string[]; files: readonly string[] } = {
    prefixes: CONTENT_PREFIXES,
    files: CONTENT_ROOT_FILES,
  },
): string {
  if (typeof input !== "string" || input.length === 0 || input.length > 512) {
    throw new GitProviderError("Path must be a non-empty string", "invalid_path");
  }
  if (input.includes("\0") || input.includes("\\")) {
    throw new GitProviderError(`Illegal characters in path: ${input}`, "invalid_path");
  }
  if (input.startsWith("/") || /^[a-zA-Z]:/.test(input)) {
    throw new GitProviderError(`Absolute paths are not allowed: ${input}`, "invalid_path");
  }
  // A single trailing slash denotes a directory; everything else must be clean.
  const isDirectory = input.endsWith("/");
  const body = isDirectory ? input.slice(0, -1) : input;
  const segments = body.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    // Reject rather than normalize: `posts/../x` is never a legitimate request.
    throw new GitProviderError(`Path traversal is not allowed: ${input}`, "invalid_path");
  }
  const normalized = isDirectory ? `${body}/` : body;
  const isAllowedFile = !isDirectory && allowed.files.includes(normalized);
  const isUnderPrefix = allowed.prefixes.some((prefix) => normalized.startsWith(prefix));
  if (!isAllowedFile && !isUnderPrefix) {
    throw new GitProviderError(`Path is outside the content allowlist: ${input}`, "invalid_path");
  }
  return normalized;
}
