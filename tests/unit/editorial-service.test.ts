import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContentService } from "@/modules/content/content-service";
import type { ArticleFormValues } from "@/modules/content/editable";
import { LocalFsProvider } from "@/modules/git/local/local-fs-provider";
import { ConflictError } from "@/modules/git/types";
import { GitHubClient } from "@/modules/git/github/github-client";
import { GitHubProvider } from "@/modules/git/github/github-provider";
import type { GitProvider } from "@/modules/git/types";
import { EditorialService } from "@/modules/publishing/editorial-service";
import { FakeGitHub } from "../helpers/fake-github";

const author = { name: "Tester", email: "tester@example.com" };
let root: string;
let provider: LocalFsProvider;
let service: EditorialService;

const values = (overrides: Partial<ArticleFormValues> = {}): ArticleFormValues => ({
  title: "Hello",
  description: "Desc",
  date: "2026-01-01",
  author: "",
  tags: ["AI"],
  categories: [],
  coverImage: "",
  coverAlt: "",
  featured: false,
  ...overrides,
});

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "inkgit-"));
  provider = new LocalFsProvider(root);
  const content = new ContentService(provider, { defaultAuthor: "A", wordsPerMinute: 200 });
  service = new EditorialService(provider, content, { today: () => "2026-02-01" });
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

const readPost = (slug: string) => fs.readFile(path.join(root, "posts", `${slug}.mdx`), "utf8");

describe("LocalFsProvider.commit", () => {
  it("rejects blind overwrites and stale SHAs", async () => {
    await provider.commit({
      message: "m",
      author,
      changes: [{ op: "upsert", path: "posts/a.mdx", content: "one", expectedSha: null }],
    });
    await expect(
      provider.commit({
        message: "m",
        author,
        changes: [{ op: "upsert", path: "posts/a.mdx", content: "two", expectedSha: null }],
      }),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(
      provider.commit({
        message: "m",
        author,
        changes: [{ op: "upsert", path: "posts/a.mdx", content: "two", expectedSha: "stale" }],
      }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(await readPost("a")).toBe("one");
  });

  it("is all-or-nothing across files", async () => {
    await expect(
      provider.commit({
        message: "m",
        author,
        changes: [
          { op: "upsert", path: "posts/new.mdx", content: "x", expectedSha: null },
          { op: "delete", path: "posts/missing.mdx", expectedSha: "abc" },
        ],
      }),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(readPost("new")).rejects.toThrow();
  });

  it("refuses writes outside the content allowlist", async () => {
    await expect(
      provider.commit({
        message: "m",
        author,
        changes: [{ op: "upsert", path: "../evil.mdx", content: "x", expectedSha: null }],
      }),
    ).rejects.toThrow(/traversal/);
    await expect(
      provider.commit({
        message: "m",
        author,
        changes: [{ op: "upsert", path: ".github/workflows/x.yml", content: "x", expectedSha: null }],
      }),
    ).rejects.toThrow(/allowlist/);
  });

  it("refuses to write through a symlinked directory that escapes the root", async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), "inkgit-outside-"));
    await fs.symlink(outside, path.join(root, "posts"));
    await expect(
      provider.commit({
        message: "m",
        author,
        changes: [{ op: "upsert", path: "posts/x.mdx", content: "x", expectedSha: null }],
      }),
    ).rejects.toThrow(/escapes/);
    expect(await fs.readdir(outside)).toEqual([]);
    await fs.rm(outside, { recursive: true });
  });

  it("serializes concurrent commits so only one create wins", async () => {
    const attempt = (content: string) =>
      provider.commit({
        message: "m",
        author,
        changes: [{ op: "upsert", path: "posts/race.mdx", content, expectedSha: null }],
      });
    const results = await Promise.allSettled([attempt("a"), attempt("b")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });
});

interface Harness {
  name: string;
  setup(): Promise<{
    provider: GitProvider;
    read(path: string): Promise<string | null>;
    externalWrite(path: string, content: string): Promise<void>;
  }>;
}

const harnesses: Harness[] = [
  {
    name: "local filesystem",
    async setup() {
      return {
        provider,
        read: (p) => fs.readFile(path.join(root, p), "utf8").catch(() => null),
        externalWrite: async (p, content) => {
          await fs.mkdir(path.dirname(path.join(root, p)), { recursive: true });
          await fs.writeFile(path.join(root, p), content);
        },
      };
    },
  },
  {
    name: "GitHub (fake API)",
    async setup() {
      const github = new FakeGitHub({ "README.md": "# repo" });
      const client = new GitHubClient({ token: "test-token", fetch: github.fetch });
      const gh = new GitHubProvider({
        owner: github.owner,
        repo: github.repo,
        branch: "main",
        contentPath: "content",
        client,
        headTtlMs: 0,
      });
      return {
        provider: gh,
        read: async (p) => github.file(`content/${p}`),
        externalWrite: async (p, content) => void github.push({ [`content/${p}`]: content }),
      };
    },
  },
];

describe.each(harnesses)("EditorialService contract — $name", (harness) => {
  let read: (p: string) => Promise<string | null>;
  let externalWrite: (p: string, content: string) => Promise<void>;
  const readPost = async (slug: string) => {
    const content = await read(`posts/${slug}.mdx`);
    if (content === null) throw new Error(`posts/${slug}.mdx does not exist`);
    return content;
  };

  beforeEach(async () => {
    const h = await harness.setup();
    read = h.read;
    externalWrite = h.externalWrite;
    const content = new ContentService(h.provider, { defaultAuthor: "A", wordsPerMinute: 200 });
    service = new EditorialService(h.provider, content, { today: () => "2026-02-01" });
  });

  it("creates a draft, then publishes it", async () => {
    const created = await service.save(
      { slug: "hello", baseSha: null, intent: "save", values: values(), body: "Hi" },
      author,
    );
    expect(created).toMatchObject({ status: "saved", published: false });
    expect(await readPost("hello")).toContain("published: false");

    const sha = created.status === "saved" ? created.sha : "";
    const published = await service.save(
      { slug: "hello", baseSha: sha, intent: "publish", values: values(), body: "Hi" },
      author,
    );
    expect(published).toMatchObject({ status: "saved", published: true });
    const file = await readPost("hello");
    expect(file).toContain("published: true");
    expect(file).toContain('updatedAt: "2026-02-01"'); // today is after the article date
  });

  it("refuses to create over an existing slug", async () => {
    await service.save({ slug: "dup", baseSha: null, intent: "save", values: values(), body: "1" }, author);
    const again = await service.save(
      { slug: "dup", baseSha: null, intent: "save", values: values(), body: "2" },
      author,
    );
    expect(again).toMatchObject({ status: "conflict", message: expect.stringMatching(/already exists/) });
  });

  it("detects edits made outside the editor and supports an explicit overwrite", async () => {
    const created = await service.save(
      { slug: "c", baseSha: null, intent: "save", values: values(), body: "mine" },
      author,
    );
    const baseSha = created.status === "saved" ? created.sha : "";
    await externalWrite("posts/c.mdx", (await readPost("c")).replace("mine", "theirs"));

    const result = await service.save(
      { slug: "c", baseSha, intent: "save", values: values(), body: "mine v2" },
      author,
    );
    expect(result.status).toBe("conflict");
    expect(await readPost("c")).toContain("theirs");

    const remoteSha = result.status === "conflict" ? result.remote.sha : null;
    const forced = await service.save(
      { slug: "c", baseSha, intent: "save", values: values(), body: "mine v2", overwrite: { remoteSha } },
      author,
    );
    expect(forced.status).toBe("saved");
    expect(await readPost("c")).toContain("mine v2");
  });

  it("returns field errors and writes nothing for invalid frontmatter", async () => {
    const result = await service.save(
      { slug: "bad", baseSha: null, intent: "save", values: values({ coverImage: "javascript:alert(1)" }), body: "x" },
      author,
    );
    expect(result).toMatchObject({ status: "invalid", fieldErrors: { coverImage: expect.any(Array) } });
    expect(await read("posts/bad.mdx")).toBeNull();
  });

  it("rejects invalid slugs", async () => {
    const result = await service.save(
      { slug: "../etc", baseSha: null, intent: "save", values: values(), body: "x" },
      author,
    );
    expect(result).toMatchObject({ status: "invalid", fieldErrors: { slug: expect.any(Array) } });
  });

  it("blocks publishing content that cannot render, but allows saving it as a draft", async () => {
    const broken = "<div>unclosed";
    const draft = await service.save(
      { slug: "b", baseSha: null, intent: "save", values: values(), body: broken },
      author,
    );
    expect(draft.status).toBe("saved");
    const sha = draft.status === "saved" ? draft.sha : "";
    const publish = await service.save(
      { slug: "b", baseSha: sha, intent: "publish", values: values(), body: broken },
      author,
    );
    expect(publish.status).toBe("render-error");
    expect(await readPost("b")).toContain("published: false");
  });

  it("preserves unknown frontmatter keys and canonicalUrl", async () => {
    await externalWrite(
      "posts/keep.mdx",
      '---\ntitle: "Old"\ndescription: "D"\ndate: "2026-01-01"\ncanonicalUrl: "https://example.com/x"\nseries: "Deep Dives"\npublished: true\n---\n\nBody\n',
    );
    const loaded = await service.loadForEdit("keep");
    expect(loaded).toMatchObject({ published: true, values: { title: "Old" }, issues: [] });
    const saved = await service.save(
      {
        slug: "keep",
        baseSha: loaded?.sha ?? "",
        intent: "save",
        values: { ...loaded!.values, title: "New" },
        body: loaded!.body,
      },
      author,
    );
    expect(saved).toMatchObject({ status: "saved", published: true });
    const file = await readPost("keep");
    expect(file).toContain('title: "New"');
    expect(file).toContain('canonicalUrl: "https://example.com/x"');
    expect(file).toContain('series: "Deep Dives"');
  });

  it("opens invalid files for repair and lists them in the overview", async () => {
    await externalWrite("posts/broken.mdx", "---\ntitle: Only a title\n---\n\nBody\n");
    const loaded = await service.loadForEdit("broken");
    expect(loaded?.issues.join("\n")).toMatch(/description/);
    const overview = await service.getOverview();
    expect(overview.articles).toContainEqual(expect.objectContaining({ slug: "broken", status: "invalid" }));
  });

  it("deletes only the version that was loaded", async () => {
    const created = await service.save(
      { slug: "d", baseSha: null, intent: "save", values: values(), body: "x" },
      author,
    );
    expect(await service.delete("d", "stale", author)).toMatchObject({ status: "conflict" });
    expect(await service.delete("d", created.status === "saved" ? created.sha : "", author)).toEqual({
      status: "deleted",
    });
    expect(await service.loadForEdit("d")).toBeNull();
  });
});
