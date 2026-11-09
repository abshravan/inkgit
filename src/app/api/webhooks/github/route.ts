import { revalidateTag } from "next/cache";
import { getServerEnv } from "@/lib/env";
import { CONTENT_CACHE_TAG } from "@/modules/content/queries";
import { isRelevantPush, verifyGitHubSignature } from "@/modules/webhooks/github-webhook";

const MAX_BODY_BYTES = 5 * 1024 * 1024;

/**
 * GitHub push webhook. Refreshes the public site when content changes outside
 * InkGit (e.g. edited on github.com, merged PRs). Configure it on the content
 * repository with content type `application/json` and GITHUB_WEBHOOK_SECRET.
 */
export async function POST(request: Request): Promise<Response> {
  const env = getServerEnv();
  if (env.CONTENT_SOURCE !== "github" || !env.GITHUB_WEBHOOK_SECRET || !env.CONTENT_REPO) {
    return Response.json({ error: "Webhook not configured" }, { status: 404 });
  }
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return Response.json({ error: "Payload too large" }, { status: 413 });

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) return Response.json({ error: "Payload too large" }, { status: 413 });
  if (!verifyGitHubSignature(env.GITHUB_WEBHOOK_SECRET, rawBody, request.headers.get("x-hub-signature-256"))) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = request.headers.get("x-github-event");
  if (event === "ping") return Response.json({ ok: true, pong: true });
  if (event !== "push") return Response.json({ ok: true, ignored: event });

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const relevant = isRelevantPush(payload, {
    repository: env.CONTENT_REPO,
    branch: env.CONTENT_BRANCH,
    contentPath: env.CONTENT_REPO_PATH,
  });
  // `expire: 0`: the next visitor gets fresh content rather than a stale copy.
  if (relevant) revalidateTag(CONTENT_CACHE_TAG, { expire: 0 });
  return Response.json({ ok: true, revalidated: relevant });
}
