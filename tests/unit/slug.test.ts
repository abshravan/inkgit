import { describe, expect, it } from "vitest";
import { isValidSlug, slugFromFilename, slugify } from "@/modules/content/slug";

describe("isValidSlug", () => {
  it.each(["hello", "hello-world", "a1-b2", "2026-recap"])("accepts %s", (slug) => {
    expect(isValidSlug(slug)).toBe(true);
  });
  it.each(["", "Hello", "hello_world", "-hello", "hello-", "hello--world", "../etc", "a/b", "a".repeat(101)])(
    "rejects %j",
    (slug) => expect(isValidSlug(slug)).toBe(false),
  );
});

describe("slugify", () => {
  it.each([
    ["Next.js & React", "next-js-react"],
    ["  Artificial Intelligence ", "artificial-intelligence"],
    ["C++", "c-plus-plus"],
    ["C#", "c-sharp"],
    ["Café Crème", "cafe-creme"],
    ["!!!", ""],
  ])("%j → %j", (input, expected) => expect(slugify(input)).toBe(expected));
});

describe("slugFromFilename", () => {
  it("extracts slug and format", () => {
    expect(slugFromFilename("hello.mdx")).toEqual({ slug: "hello", format: "mdx" });
    expect(slugFromFilename("hello.md")).toEqual({ slug: "hello", format: "md" });
  });
  it("ignores other files", () => {
    expect(slugFromFilename("notes.txt")).toBeNull();
    expect(slugFromFilename(".mdx")).toBeNull();
  });
});
