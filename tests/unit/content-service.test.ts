import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ContentService } from "@/modules/content/content-service";
import { LocalFsProvider } from "@/modules/git/local/local-fs-provider";
import { gitBlobSha } from "@/modules/git/blob-sha";

const root = path.resolve(__dirname, "../fixtures/content");

function createService() {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  return new ContentService(new LocalFsProvider(root), { defaultAuthor: "Fixture", wordsPerMinute: 200 });
}

describe("ContentService (local fixtures)", () => {
  it("loads valid articles and isolates malformed ones", async () => {
    const index = await createService().loadIndex();
    expect(index.articles.map((a) => a.slug).sort()).toEqual(["draft-post", "valid-post"]);

    const errors = index.issues
      .filter((i) => i.severity === "error")
      .map((i) => i.path)
      .sort();
    expect(errors).toEqual(
      expect.arrayContaining([
        "posts/Bad_Name.mdx",
        "posts/broken-yaml.mdx",
        "posts/missing-fields.mdx",
        "posts/slug-mismatch.mdx",
      ]),
    );
    expect(errors).not.toContain("posts/notes.txt");
  });

  it("resolves taxonomy and reports unknown categories as warnings", async () => {
    const index = await createService().loadIndex();
    const post = index.articles.find((a) => a.slug === "valid-post");
    expect(post?.categories.map((c) => c.slug)).toEqual(["engineering"]);
    expect(post?.tags.map((t) => t.slug)).toEqual(["testing", "vitest"]);
    expect(index.categories.map((c) => c.slug)).toEqual(["engineering", "design"]);
    expect(index.issues).toContainEqual(
      expect.objectContaining({ severity: "warning", message: expect.stringContaining("Nonexistent") }),
    );
  });

  it("keeps drafts in the index but unpublished", async () => {
    const draft = (await createService().loadIndex()).articles.find((a) => a.slug === "draft-post");
    expect(draft?.published).toBe(false);
    expect(draft?.format).toBe("md");
  });

  it("loads pages", async () => {
    expect(await createService().loadPage("about")).toMatchObject({ title: "About fixture", format: "md" });
    expect(await createService().loadPage("missing")).toBeNull();
  });
});

describe("LocalFsProvider", () => {
  const provider = new LocalFsProvider(root);

  it("reports git-compatible blob SHAs", async () => {
    const file = await provider.readFile("pages/about.md");
    expect(file?.sha).toBe(gitBlobSha(file?.content ?? ""));
    // `git hash-object` of "hello\n"
    expect(gitBlobSha("hello\n")).toBe("ce013625030ba8dba906f756967f9e9ca394464a");
  });

  it("refuses paths outside the allowlist", async () => {
    await expect(provider.readFile("../../package.json")).rejects.toThrow(/traversal/);
    await expect(provider.readFile("package.json")).rejects.toThrow(/allowlist/);
  });

  it("returns empty results for missing locations", async () => {
    expect(await provider.listFiles("pages/nested")).toEqual([]);
    expect(await provider.readFile("posts/nope.mdx")).toBeNull();
  });
});
