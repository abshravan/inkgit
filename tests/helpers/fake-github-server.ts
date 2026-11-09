/**
 * Serves FakeGitHub over HTTP for manual and end-to-end testing of the GitHub
 * content source without a real repository:
 *
 *   pnpm dlx tsx tests/helpers/fake-github-server.ts [port]
 *   CONTENT_SOURCE=github GITHUB_API_URL=http://127.0.0.1:4100 CONTENT_REPO=acme/blog-content \
 *     CONTENT_REPO_PATH=content CONTENT_GITHUB_TOKEN=test-token pnpm dev
 *
 * Seeds the repository from ./content. Control endpoints (test only):
 *   POST /__control/push  {"changes": {"content/posts/x.mdx": "…" | null}, "message": "…"}
 *   GET  /__control/file?path=content/posts/x.mdx
 *   GET  /__control/head
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { FakeGitHub } from "./fake-github";

function seed(dir: string, prefix: string, files: Record<string, string> = {}): Record<string, string> {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) seed(full, `${prefix}${name}/`, files);
    else files[`${prefix}${name}`] = readFileSync(full, "utf8");
  }
  return files;
}

const port = Number(process.argv[2] ?? 4100);
const github = new FakeGitHub({ "README.md": "# Blog content\n", ...seed(path.resolve("content"), "content/") });

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const body = Buffer.concat(chunks).toString("utf8");

  if (url.pathname === "/__control/push" && req.method === "POST") {
    const { changes, message } = JSON.parse(body) as { changes: Record<string, string | null>; message?: string };
    res.end(JSON.stringify({ sha: github.push(changes, message ?? "External edit") }));
    return;
  }
  if (url.pathname === "/__control/file") {
    res.end(JSON.stringify({ content: github.file(url.searchParams.get("path") ?? "") }));
    return;
  }
  if (url.pathname === "/__control/head") {
    res.end(JSON.stringify({ ...github.headCommit(), commitCount: github.commitCount() }));
    return;
  }

  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) if (typeof value === "string") headers[key] = value;
  const response = await github.fetch(`https://api.github.com${url.pathname}${url.search}`, {
    method: req.method ?? "GET",
    headers,
    ...(body && { body }),
  });
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, "127.0.0.1", () => console.log(`Fake GitHub API on http://127.0.0.1:${port}`));
