import { createHash } from "node:crypto";
import { gitBlobSha } from "@/modules/git/blob-sha";
import type { FetchLike } from "@/modules/git/github/github-client";

/**
 * In-memory stand-in for the subset of GitHub's REST API that InkGit uses.
 * Models real Git semantics: content-addressed blobs, immutable trees and
 * commits, and fast-forward-only ref updates (422 otherwise).
 */
interface Commit {
  sha: string;
  tree: string;
  parents: string[];
  message: string;
  author: { name: string; email: string; date: string };
}

export class FakeGitHub {
  readonly owner = "acme";
  readonly repo = "blog-content";
  private blobs = new Map<string, string>();
  /** Tree SHA → flat map of repo path → blob SHA. */
  private trees = new Map<string, Map<string, string>>();
  private commits = new Map<string, Commit>();
  private refs = new Map<string, string>();
  private clock = Date.parse("2026-01-01T00:00:00Z");
  requests: string[] = [];
  /** Called before a ref update is applied; lets tests simulate a concurrent push. */
  beforeRefUpdate: (() => void) | null = null;
  rateLimited = false;

  constructor(files: Record<string, string> = {}, branch = "main") {
    const tree = this.storeTree(
      new Map(Object.entries(files).map(([path, content]) => [path, this.storeBlob(content)])),
    );
    this.refs.set(branch, this.storeCommit(tree, [], "Initial commit"));
  }

  /** Simulates someone pushing directly to the branch (e.g. editing on github.com). */
  push(changes: Record<string, string | null>, message = "External edit", branch = "main"): string {
    const head = this.commits.get(this.refs.get(branch)!)!;
    const files = new Map(this.trees.get(head.tree)!);
    for (const [path, content] of Object.entries(changes)) {
      if (content === null) files.delete(path);
      else files.set(path, this.storeBlob(content));
    }
    const sha = this.storeCommit(this.storeTree(files), [head.sha], message);
    this.refs.set(branch, sha);
    return sha;
  }

  file(path: string, branch = "main"): string | null {
    const head = this.commits.get(this.refs.get(branch)!)!;
    const blob = this.trees.get(head.tree)!.get(path);
    return blob ? this.blobs.get(blob)! : null;
  }

  headSha(branch = "main"): string {
    return this.refs.get(branch)!;
  }

  commitCount(branch = "main"): number {
    let count = 0;
    for (let sha: string | undefined = this.refs.get(branch); sha; sha = this.commits.get(sha)?.parents[0]) count++;
    return count;
  }

  headCommit(branch = "main"): Commit {
    return this.commits.get(this.refs.get(branch)!)!;
  }

  readonly fetch: FetchLike = async (input, init) => {
    const url = new URL(input);
    const method = init?.method ?? "GET";
    this.requests.push(`${method} ${url.pathname}${url.search}`);
    const headers = new Headers(init?.headers);
    if (headers.get("authorization") !== "Bearer test-token") return json(401, { message: "Bad credentials" });
    if (this.rateLimited) {
      return json(
        403,
        { message: "API rate limit exceeded" },
        { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1800000000" },
      );
    }
    const base = `/repos/${this.owner}/${this.repo}`;
    if (!url.pathname.startsWith(base)) return json(404, { message: "Not Found" });
    const path = url.pathname.slice(base.length);
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    const result = this.route(method, path, url.searchParams, body, headers);
    if (method === "GET" && result.status === 200 && typeof result.body !== "string") {
      const etag = `"${hash(JSON.stringify(result.body))}"`;
      if (headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: { etag } });
      return json(200, result.body, { etag });
    }
    if (typeof result.body === "string") return new Response(result.body, { status: result.status });
    return json(result.status, result.body);
  };

  private route(
    method: string,
    path: string,
    query: URLSearchParams,
    body: Record<string, unknown>,
    headers: Headers,
  ): { status: number; body: unknown } {
    let match: RegExpMatchArray | null;
    if (method === "GET" && (match = path.match(/^\/git\/ref\/heads\/(.+)$/))) {
      const sha = this.refs.get(decodeURIComponent(match[1]!));
      return sha ? { status: 200, body: { object: { sha, type: "commit" } } } : notFound();
    }
    if (method === "GET" && (match = path.match(/^\/git\/trees\/([0-9a-f]{40})$/))) {
      const treeSha = this.commits.get(match[1]!)?.tree ?? match[1]!;
      const tree = this.trees.get(treeSha);
      if (!tree) return notFound();
      return {
        status: 200,
        body: {
          sha: treeSha,
          truncated: false,
          tree: [...tree].map(([p, sha]) => ({
            path: p,
            type: "blob",
            mode: "100644",
            sha,
            size: this.blobs.get(sha)!.length,
          })),
        },
      };
    }
    if (method === "GET" && (match = path.match(/^\/git\/blobs\/([0-9a-f]{40})$/))) {
      const content = this.blobs.get(match[1]!);
      return content === undefined
        ? notFound()
        : {
            status: 200,
            body: { sha: match[1], encoding: "base64", content: Buffer.from(content).toString("base64") },
          };
    }
    if (method === "POST" && path === "/git/trees") {
      const files = new Map(this.trees.get(String(body.base_tree)) ?? []);
      for (const entry of body.tree as Array<{ path: string; sha?: string | null; content?: string }>) {
        if (entry.sha === null) files.delete(entry.path);
        else if (entry.content !== undefined) files.set(entry.path, this.storeBlob(entry.content));
      }
      return { status: 201, body: { sha: this.storeTree(files) } };
    }
    if (method === "POST" && path === "/git/commits") {
      const author = body.author as Commit["author"];
      return {
        status: 201,
        body: { sha: this.storeCommit(String(body.tree), body.parents as string[], String(body.message), author) },
      };
    }
    if (method === "PATCH" && (match = path.match(/^\/git\/refs\/heads\/(.+)$/))) {
      const branch = decodeURIComponent(match[1]!);
      this.beforeRefUpdate?.();
      const current = this.refs.get(branch);
      const next = String(body.sha);
      if (!current) return notFound();
      if (!body.force && !this.isAncestor(current, next))
        return { status: 422, body: { message: "Update is not a fast forward" } };
      this.refs.set(branch, next);
      return { status: 200, body: { object: { sha: next } } };
    }
    if (method === "POST" && path === "/git/refs") {
      const ref = String(body.ref).replace(/^refs\/heads\//, "");
      if (this.refs.has(ref)) return { status: 422, body: { message: "Reference already exists" } };
      this.refs.set(ref, String(body.sha));
      return { status: 201, body: {} };
    }
    if (method === "GET" && path === "/commits") {
      const filter = query.get("path");
      const perPage = Number(query.get("per_page") ?? 30);
      const page = Number(query.get("page") ?? 1);
      const list: Commit[] = [];
      for (let sha: string | undefined = this.refs.get(query.get("sha") ?? "main"); sha;) {
        const commit = this.commits.get(sha)!;
        const parent = commit.parents[0] ? this.commits.get(commit.parents[0]) : undefined;
        const touched =
          !filter ||
          [
            ...new Set([
              ...this.trees.get(commit.tree)!.keys(),
              ...(parent ? this.trees.get(parent.tree)!.keys() : []),
            ]),
          ].some(
            (p) =>
              (p === filter || p.startsWith(`${filter}/`)) &&
              this.trees.get(commit.tree)!.get(p) !== (parent ? this.trees.get(parent.tree)!.get(p) : undefined),
          );
        if (touched) list.push(commit);
        sha = commit.parents[0];
      }
      const slice = list.slice((page - 1) * perPage, page * perPage);
      return {
        status: 200,
        body: slice.map((c) => ({
          sha: c.sha,
          html_url: `https://github.com/acme/blog-content/commit/${c.sha}`,
          commit: { message: c.message, author: c.author },
        })),
      };
    }
    if (method === "GET" && (match = path.match(/^\/contents\/(.+)$/))) {
      const filePath = match[1]!.split("/").map(decodeURIComponent).join("/");
      const commit = this.commits.get(query.get("ref") ?? "");
      const blob = commit && this.trees.get(commit.tree)!.get(filePath);
      if (!blob) return notFound();
      if (!headers.get("accept")?.includes("raw")) return { status: 415, body: { message: "test expects raw" } };
      return { status: 200, body: this.blobs.get(blob)! };
    }
    return notFound();
  }

  private isAncestor(ancestor: string, descendant: string): boolean {
    for (let sha: string | undefined = descendant; sha; sha = this.commits.get(sha)?.parents[0])
      if (sha === ancestor) return true;
    return false;
  }

  private storeBlob(content: string): string {
    const sha = gitBlobSha(content);
    this.blobs.set(sha, content);
    return sha;
  }

  private storeTree(files: Map<string, string>): string {
    const sha = hash(JSON.stringify([...files].sort()));
    this.trees.set(sha, files);
    return sha;
  }

  private storeCommit(tree: string, parents: string[], message: string, author?: Commit["author"]): string {
    this.clock += 60_000;
    const commit = {
      tree,
      parents,
      message,
      author: author ?? { name: "Someone", email: "someone@example.com", date: new Date(this.clock).toISOString() },
    };
    const sha = hash(JSON.stringify({ ...commit, at: this.clock }));
    this.commits.set(sha, { sha, ...commit });
    return sha;
  }
}

function hash(value: string): string {
  return createHash("sha1").update(value).digest("hex");
}

function notFound() {
  return { status: 404, body: { message: "Not Found" } };
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}
