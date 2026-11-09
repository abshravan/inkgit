import { describe, expect, it } from "vitest";
import { assertSafeRepoPath } from "@/modules/git/paths";
import { GitProviderError } from "@/modules/git/types";

describe("assertSafeRepoPath", () => {
  it.each(["posts/hello.mdx", "pages/about.md", "taxonomy.yml", "posts/"])("allows %s", (input) => {
    expect(assertSafeRepoPath(input)).toBe(input);
  });

  it.each([
    "../secrets.env",
    "posts/../../etc/passwd",
    "posts/./hello.mdx",
    "posts//hello.mdx",
    "/posts/hello.mdx",
    "C:/posts/hello.mdx",
    "posts\\hello.mdx",
    "posts/hello\0.mdx",
    ".env",
    ".github/workflows/deploy.yml",
    "package.json",
    "taxonomy.yml/",
    "",
  ])("rejects %j", (input) => {
    expect(() => assertSafeRepoPath(input)).toThrow(GitProviderError);
  });
});
