import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContentService } from "@/modules/content/content-service";
import { parseArticle } from "@/modules/content/parse";
import { gitBlobSha } from "@/modules/git/blob-sha";
import { GitHubClient } from "@/modules/git/github/github-client";
import { GitHubProvider } from "@/modules/git/github/github-provider";
import { EditorialService } from "@/modules/publishing/editorial-service";
import { TaxonomyService } from "@/modules/publishing/taxonomy-service";
import { FakeGitHub } from "../helpers/fake-github";

const author = { name: "Ada", email: "ada@example.com" };
const post = (fm: string, body = "Body") =>
  `---\ntitle: "T"\ndescription: "D"\ndate: "2026-01-01"\npublished: true\n${fm}---\n\n${body}\n`;

let github: FakeGitHub;
let editorial: EditorialService;
let taxonomy: TaxonomyService;

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  github = new FakeGitHub({
    "content/taxonomy.yml":
      "categories:\n  - name: Engineering\n    description: Eng\n  - name: Design\n  - name: AI\n    slug: artificial-intelligence\n",
    "content/posts/one.mdx": post('tags: ["React", "TypeScript"]\ncategories: ["Engineering"]\n'),
    "content/posts/two.mdx": post('tags: ["react"]\ncategories: ["Engineering", "Design"]\nseries: "keep me"\n'),
  });
  const provider = new GitHubProvider({
    owner: github.owner,
    repo: github.repo,
    branch: "main",
    contentPath: "content",
    client: new GitHubClient({ token: "test-token", fetch: github.fetch }),
    headTtlMs: 0,
  });
  const content = new ContentService(provider, { defaultAuthor: "A", wordsPerMinute: 200 });
  editorial = new EditorialService(provider, content, { today: () => "2026-02-01" });
  taxonomy = new TaxonomyService(provider, content);
});

const parsed = (path: string) => {
  const result = parseArticle(
    { path, sha: "x", content: github.file(`content/${path}`)! },
    { defaultAuthor: "A", wordsPerMinute: 200 },
  );
  if (!result.ok) throw new Error(result.error.map((e) => e.message).join());
  return result.value.article;
};

describe("history and restore", () => {
  it("lists an article's commits and restores an old version as a new commit", async () => {
    const original = github.file("content/posts/one.mdx")!;
    github.push({ "content/posts/one.mdx": post("", "Rewritten body") }, "content(update): one");
    const history = await editorial.getHistory("one", null);
    expect(history.supported).toBe(true);
    expect(history.commits.map((c) => c.subject)).toEqual(["content(update): one", "Initial commit"]);

    const initialSha = history.commits[1]!.sha;
    const revision = await editorial.getRevision("one", initialSha);
    expect(revision?.content).toBe(original);

    const commitsBefore = github.commitCount();
    const result = await editorial.restore("one", initialSha, revision!.currentSha, author);
    expect(result.status).toBe("restored");
    expect(github.file("content/posts/one.mdx")).toBe(original);
    expect(github.commitCount()).toBe(commitsBefore + 1);
    expect(github.headCommit().message).toMatch(/^content\(restore\): one to [0-9a-f]{7}/);
  });

  it("restores a deleted article", async () => {
    const initial = github.headSha();
    github.push({ "content/posts/one.mdx": null }, "delete");
    const result = await editorial.restore("one", initial, null, author);
    expect(result.status).toBe("restored");
    expect(github.file("content/posts/one.mdx")).not.toBeNull();
  });

  it("refuses to restore over a newer version than the one shown", async () => {
    const initial = github.headSha();
    github.push({ "content/posts/one.mdx": post("", "v2") });
    const stale = gitBlobSha(github.file("content/posts/one.mdx")!);
    github.push({ "content/posts/one.mdx": post("", "v3") });
    expect(await editorial.restore("one", initial, stale, author)).toMatchObject({ status: "conflict" });
  });
});

describe("rename", () => {
  it("moves the file atomically and records a redirect", async () => {
    const sha = gitBlobSha(github.file("content/posts/two.mdx")!);
    const commits = github.commitCount();
    const result = await editorial.rename("two", "second-post", sha, author);
    expect(result).toMatchObject({ status: "renamed", slug: "second-post" });
    expect(github.commitCount()).toBe(commits + 1);
    expect(github.file("content/posts/two.mdx")).toBeNull();
    const article = parsed("posts/second-post.mdx");
    expect(article.redirectFrom).toEqual(["two"]);
    expect(github.file("content/posts/second-post.mdx")).toContain('series: "keep me"');
  });

  it("rejects taken, invalid or stale renames", async () => {
    const sha = gitBlobSha(github.file("content/posts/two.mdx")!);
    expect(await editorial.rename("two", "one", sha, author)).toMatchObject({ status: "invalid" });
    expect(await editorial.rename("two", "Bad Slug", sha, author)).toMatchObject({ status: "invalid" });
    expect(await editorial.rename("two", "fine", "0".repeat(40), author)).toMatchObject({ status: "conflict" });
  });
});

describe("taxonomy", () => {
  it("summarizes categories and tags with counts", async () => {
    const overview = await taxonomy.getOverview();
    expect(overview.categories).toEqual([
      { slug: "engineering", name: "Engineering", description: "Eng", count: 2 },
      { slug: "design", name: "Design", description: "", count: 1 },
      { slug: "artificial-intelligence", name: "AI", description: "", count: 0 },
    ]);
    expect(overview.tags).toEqual([
      { slug: "react", name: "React", count: 2 },
      { slug: "typescript", name: "TypeScript", count: 1 },
    ]);
  });

  it("renames a category everywhere in one commit, preserving custom slugs elsewhere", async () => {
    const commits = github.commitCount();
    const result = await taxonomy.apply(
      { type: "update-category", slug: "engineering", name: "Software Engineering", description: "Eng" },
      author,
    );
    expect(result).toEqual({ status: "saved", filesChanged: 3 });
    expect(github.commitCount()).toBe(commits + 1);
    expect(parsed("posts/one.mdx").categoryLabels).toEqual(["Software Engineering"]);
    expect(parsed("posts/two.mdx").categoryLabels).toEqual(["Software Engineering", "Design"]);
    expect(github.file("content/taxonomy.yml")).toContain("slug: artificial-intelligence");
    expect(github.file("content/posts/two.mdx")).toContain('series: "keep me"');
  });

  it("merges tags by renaming one onto another", async () => {
    await taxonomy.apply({ type: "rename-tag", slug: "typescript", name: "React" }, author);
    expect(parsed("posts/one.mdx").tagLabels).toEqual(["React"]);
  });

  it("deletes a category from taxonomy.yml and articles", async () => {
    await taxonomy.apply({ type: "delete-category", slug: "design" }, author);
    expect(github.file("content/taxonomy.yml")).not.toContain("Design");
    expect(parsed("posts/two.mdx").categoryLabels).toEqual(["Engineering"]);
  });

  it("adds categories and rejects duplicates", async () => {
    expect(await taxonomy.apply({ type: "add-category", name: "Tooling", description: "" }, author)).toMatchObject({
      status: "saved",
    });
    expect(github.file("content/taxonomy.yml")).toContain("- name: Tooling");
    expect(await taxonomy.apply({ type: "add-category", name: "tooling", description: "" }, author)).toMatchObject({
      status: "invalid",
    });
  });

  it("aborts the whole operation if an article changed meanwhile", async () => {
    await taxonomy.getOverview();
    // Simulate an edit landing between planning and committing.
    github.beforeRefUpdate = () => {
      github.beforeRefUpdate = null;
      github.push({ "content/posts/one.mdx": post('tags: ["React"]\n', "edited elsewhere") });
    };
    const result = await taxonomy.apply({ type: "rename-tag", slug: "react", name: "ReactJS" }, author);
    expect(result.status).toBe("conflict");
    expect(github.file("content/posts/two.mdx")).toContain('"react"');
  });
});
