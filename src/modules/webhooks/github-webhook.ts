import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies GitHub's `X-Hub-Signature-256` header (HMAC-SHA256 of the raw body)
 * in constant time. Any malformed header simply fails verification.
 */
export function verifyGitHubSignature(secret: string, rawBody: string, header: string | null): boolean {
  if (!secret || !header?.startsWith("sha256=")) return false;
  const received = Buffer.from(header.slice("sha256=".length), "hex");
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  return received.length === expected.length && timingSafeEqual(received, expected);
}

interface PushPayload {
  ref?: unknown;
  repository?: { full_name?: unknown };
  commits?: Array<{ added?: unknown; modified?: unknown; removed?: unknown }>;
  head_commit?: { added?: unknown; modified?: unknown; removed?: unknown } | null;
}

const asPaths = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

/**
 * Decides whether a push event should refresh the site: it must target the
 * configured repository and branch, and touch at least one file under the
 * content folder. GitHub omits file lists for very large pushes; in that case
 * we refresh to be safe.
 */
export function isRelevantPush(
  payload: unknown,
  config: { repository: string; branch: string; contentPath: string },
): boolean {
  if (typeof payload !== "object" || payload === null) return false;
  const push = payload as PushPayload;
  if (push.ref !== `refs/heads/${config.branch}`) return false;
  if (typeof push.repository?.full_name !== "string") return false;
  if (push.repository.full_name.toLowerCase() !== config.repository.toLowerCase()) return false;

  const commits = [...(push.commits ?? []), ...(push.head_commit ? [push.head_commit] : [])];
  if (commits.length === 0) return true;
  const prefix = config.contentPath.replace(/^\/+|\/+$/g, "");
  const files = commits.flatMap((commit) => [
    ...asPaths(commit.added),
    ...asPaths(commit.modified),
    ...asPaths(commit.removed),
  ]);
  if (files.length === 0) return true;
  return !prefix || files.some((file) => file === prefix || file.startsWith(`${prefix}/`));
}
