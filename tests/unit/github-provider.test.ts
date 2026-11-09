import { describe, expect, it } from "vitest";
import { gitBlobSha } from "@/modules/git/blob-sha";
import { GitHubClient } from "@/modules/git/github/github-client";
import { GitHubProvider } from "@/modules/git/github/github-provider";
import { ConflictError, GitProviderError } from "@/modules/git/types";
import { FakeGitHub } from "../helpers/fake-github";

const author = { name: "Ada", email: "ada@example.com" };

function setup(files: Record<string, string> = {}, contentPath = "content") {
  const github = new FakeGitHub(files);
  const client = new GitHubClient({ token: "test-token", fetch: github.fetch });
  const provider = new GitHubProvider({
    owner: github.owner,
    repo: github.repo,
    branch: "main",
    contentPath,
    client,
    headTtlMs: 0,
  });
  return { github, provider };
}

describe("GitHubProvider reads", () => {
  it("lists and reads files under the content path with real blob SHAs", async () => {
    const { provider } = setup({
      "content/posts/a.mdx": "A",
      "content/posts/nested/x.mdx": "X",
      "content/taxonomy.yml": "categories: []",
      "src/app.ts": "not content",
    });
    expect((await provider.listFiles("posts/")).map((f) => f.path)).toEqual(["posts/a.mdx"]);
    expect(await provider.readFile("posts/a.mdx")).toMatchObject({ content: "A", sha: gitBlobSha("A") });
    expect(await provider.readFile("posts/missing.mdx")).toBeNull();
    await expect(provider.readFile("../src/app.ts")).rejects.toThrow(/traversal/);
  });

  it("works with content at the repository root", async () => {
    const { provider } = setup({ "posts/a.mdx": "A" }, "");
    expect(await provider.readFile("posts/a.mdx")).toMatchObject({ content: "A" });
  });

  it("reuses blobs and revalidates with ETags", async () => {
    const { github, provider } = setup({ "content/posts/a.mdx": "A" });
    await provider.readFile("posts/a.mdx");
    github.requests = [];
    await provider.readFile("posts/a.mdx");
    // Only the ref is re-checked (cheap 304); tree and blob come from cache.
    expect(github.requests).toEqual(["GET /repos/acme/blog-content/git/ref/heads/main"]);
  });

  it("maps rate limiting and auth failures to typed errors", async () => {
    const { github, provider } = setup({ "content/posts/a.mdx": "A" });
    github.rateLimited = true;
    await expect(provider.readFile("posts/a.mdx")).rejects.toMatchObject({ code: "rate_limited" });
    const bad = new GitHubProvider({
      owner: github.owner,
      repo: github.repo,
      branch: "main",
      contentPath: "content",
      client: new GitHubClient({ token: "wrong", fetch: github.fetch }),
    });
    github.rateLimited = false;
    await expect(bad.readFile("posts/a.mdx")).rejects.toThrow(/401/);
  });

  it("rejects unsafe configuration", () => {
    const client = new GitHubClient({ token: "t" });
    expect(() => new GitHubProvider({ owner: "a/b", repo: "r", branch: "main", contentPath: "", client })).toThrow(
      GitProviderError,
    );
    expect(() => new GitHubProvider({ owner: "a", repo: "r", branch: "main", contentPath: "../x", client })).toThrow(
      GitProviderError,
    );
    expect(() => new GitHubProvider({ owner: "a", repo: "r", branch: "a..b", contentPath: "", client })).toThrow(
      GitProviderError,
    );
  });
});

describe("GitHubProvider commits", () => {
  it("creates one atomic commit for multiple changes with the author", async () => {
    const { github, provider } = setup({ "content/posts/old.mdx": "old" });
    const before = github.commitCount();
    const result = await provider.commit({
      message: "content(rename): old → new",
      author,
      changes: [
        { op: "delete", path: "posts/old.mdx", expectedSha: gitBlobSha("old") },
        { op: "upsert", path: "posts/new.mdx", content: "new", expectedSha: null },
      ],
    });
    expect(github.commitCount()).toBe(before + 1);
    expect(github.file("content/posts/old.mdx")).toBeNull();
    expect(github.file("content/posts/new.mdx")).toBe("new");
    expect(result.files).toEqual({ "posts/old.mdx": null, "posts/new.mdx": gitBlobSha("new") });
    expect(github.headCommit()).toMatchObject({ message: "content(rename): old → new", author: { name: "Ada" } });
  });

  it("reports a conflict without committing when a file changed", async () => {
    const { github, provider } = setup({ "content/posts/a.mdx": "v1" });
    github.push({ "content/posts/a.mdx": "v2 from github.com" });
    const head = github.headSha();
    await expect(
      provider.commit({
        message: "m",
        author,
        changes: [{ op: "upsert", path: "posts/a.mdx", content: "mine", expectedSha: gitBlobSha("v1") }],
      }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(github.headSha()).toBe(head);
  });

  it("retries on a concurrent push to an unrelated file and keeps both changes", async () => {
    const { github, provider } = setup({ "content/posts/a.mdx": "A", "content/posts/b.mdx": "B" });
    let raced = false;
    github.beforeRefUpdate = () => {
      if (raced) return;
      raced = true;
      github.push({ "content/posts/b.mdx": "B changed concurrently" });
    };
    await provider.commit({
      message: "m",
      author,
      changes: [{ op: "upsert", path: "posts/a.mdx", content: "A2", expectedSha: gitBlobSha("A") }],
    });
    expect(github.file("content/posts/a.mdx")).toBe("A2");
    expect(github.file("content/posts/b.mdx")).toBe("B changed concurrently");
  });

  it("turns a concurrent push to the same file into a conflict", async () => {
    const { github, provider } = setup({ "content/posts/a.mdx": "A" });
    github.beforeRefUpdate = () => {
      github.beforeRefUpdate = null;
      github.push({ "content/posts/a.mdx": "theirs" });
    };
    await expect(
      provider.commit({
        message: "m",
        author,
        changes: [{ op: "upsert", path: "posts/a.mdx", content: "mine", expectedSha: gitBlobSha("A") }],
      }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(github.file("content/posts/a.mdx")).toBe("theirs");
  });

  it("refuses writes outside the content allowlist", async () => {
    const { provider } = setup();
    await expect(
      provider.commit({
        message: "m",
        author,
        changes: [{ op: "upsert", path: ".github/workflows/x.yml", content: "x", expectedSha: null }],
      }),
    ).rejects.toThrow(/allowlist/);
  });
});

describe("GitHubProvider history", () => {
  it("lists commits touching a file and reads old versions", async () => {
    const { github, provider } = setup({ "content/posts/a.mdx": "v1", "content/posts/b.mdx": "b" });
    const firstSha = github.headSha();
    github.push({ "content/posts/a.mdx": "v2" }, "content(update): a");
    github.push({ "content/posts/b.mdx": "b2" }, "content(update): b");

    const history = await provider.getHistory({ path: "posts/a.mdx", limit: 10 });
    expect(history.commits.map((c) => c.subject)).toEqual(["content(update): a", "Initial commit"]);
    expect(history.commits[0]?.url).toContain("github.com");
    expect(await provider.readFileAtCommit("posts/a.mdx", firstSha)).toMatchObject({
      content: "v1",
      sha: gitBlobSha("v1"),
    });
    expect(await provider.readFileAtCommit("posts/missing.mdx", firstSha)).toBeNull();
    await expect(provider.readFileAtCommit("posts/a.mdx", "not-a-sha")).rejects.toThrow(/Invalid commit/);
  });

  it("paginates with a cursor", async () => {
    const { github, provider } = setup({ "content/posts/a.mdx": "0" });
    for (let i = 1; i <= 3; i++) github.push({ "content/posts/a.mdx": String(i) });
    const first = await provider.getHistory({ path: "posts/a.mdx", limit: 2 });
    expect(first.commits).toHaveLength(2);
    const second = await provider.getHistory({ path: "posts/a.mdx", limit: 2, cursor: first.nextCursor });
    expect(second.commits).toHaveLength(2);
    expect(second.nextCursor).toBe("3");
  });

  it("creates branches from the current head", async () => {
    const { github, provider } = setup({ "content/posts/a.mdx": "A" });
    await provider.createBranch("scheduled/2026-12-01");
    expect(github.headSha("scheduled/2026-12-01")).toBe(github.headSha("main"));
    await expect(provider.createBranch("bad..name")).rejects.toThrow(/branch/);
  });
});

describe("GitHubProvider head freshness", () => {
  it("never serves a read from a stale head (no TTL by default)", async () => {
    const github = new FakeGitHub({ "content/posts/a.mdx": "v1" });
    const provider = new GitHubProvider({
      owner: github.owner,
      repo: github.repo,
      branch: "main",
      contentPath: "content",
      client: new GitHubClient({ token: "test-token", fetch: github.fetch }),
    });
    expect((await provider.readFile("posts/a.mdx"))?.content).toBe("v1");
    github.push({ "content/posts/a.mdx": "v2" });
    expect((await provider.readFile("posts/a.mdx"))?.content).toBe("v2");
  });

  it("shares one ref request between concurrent reads", async () => {
    const { github, provider } = setup({ "content/posts/a.mdx": "A", "content/posts/b.mdx": "B" });
    github.requests = [];
    await Promise.all([
      provider.readFile("posts/a.mdx"),
      provider.readFile("posts/b.mdx"),
      provider.listFiles("posts/"),
    ]);
    expect(github.requests.filter((r) => r.includes("/git/ref/"))).toHaveLength(1);
  });
});
