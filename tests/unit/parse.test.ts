import { describe, expect, it } from "vitest";
import { parseArticle, parsePage } from "@/modules/content/parse";

const options = { defaultAuthor: "Default Author", wordsPerMinute: 200 };
const file = (content: string, path = "posts/my-post.mdx") => ({ path, sha: "abc", content });

const valid = `---
title: "Understanding Large Language Models"
slug: "my-post"
description: "An introduction to LLMs."
date: "2026-11-09"
updatedAt: "2026-11-09"
tags:
  - AI
  - LLM
  - ai
categories:
  - Artificial Intelligence
coverImage: "/images/llm.png"
published: true
featured: false
---

# Heading

Article content goes here.
`;

describe("parseArticle", () => {
  it("parses the documented frontmatter format", () => {
    const result = parseArticle(file(valid), options);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { article, warnings } = result.value;
    expect(article).toMatchObject({
      slug: "my-post",
      format: "mdx",
      title: "Understanding Large Language Models",
      date: "2026-11-09",
      author: "Default Author",
      published: true,
      featured: false,
      coverImage: "/images/llm.png",
      coverAlt: "Understanding Large Language Models",
      tagLabels: ["AI", "LLM"], // case-insensitive dedupe
      categoryLabels: ["Artificial Intelligence"],
    });
    expect(article.body.startsWith("# Heading")).toBe(true);
    expect(article.readingTimeMinutes).toBe(1);
    expect(warnings.map((w) => w.message)).toContain("coverImage has no coverAlt; using the title as alt text");
  });

  it("normalizes unquoted YAML dates and string tags", () => {
    const result = parseArticle(
      file("---\ntitle: T\ndescription: D\ndate: 2026-03-04\ntags: solo\n---\nBody"),
      options,
    );
    expect(result.ok && result.value.article.date).toBe("2026-03-04");
    expect(result.ok && result.value.article.tagLabels).toEqual(["solo"]);
  });

  it("defaults published to false (drafts are safe by default)", () => {
    const result = parseArticle(file("---\ntitle: T\ndescription: D\ndate: 2026-03-04\n---\nBody"), options);
    expect(result.ok && result.value.article.published).toBe(false);
  });

  it.each([
    ["missing title", "---\ndescription: D\ndate: 2026-01-01\n---\n", /title/],
    ["invalid date", "---\ntitle: T\ndescription: D\ndate: yesterday\n---\n", /date/],
    ["impossible date", '---\ntitle: T\ndescription: D\ndate: "2026-13-45"\n---\n', /date/],
    [
      "javascript cover",
      '---\ntitle: T\ndescription: D\ndate: 2026-01-01\ncoverImage: "javascript:alert(1)"\n---\n',
      /coverImage/,
    ],
    [
      "http cover",
      '---\ntitle: T\ndescription: D\ndate: 2026-01-01\ncoverImage: "http://x.com/a.png"\n---\n',
      /coverImage/,
    ],
    [
      "traversal cover",
      '---\ntitle: T\ndescription: D\ndate: 2026-01-01\ncoverImage: "/../secret"\n---\n',
      /coverImage/,
    ],
    ["non-boolean published", '---\ntitle: T\ndescription: D\ndate: 2026-01-01\npublished: "yes"\n---\n', /published/],
    [
      "updatedAt before date",
      "---\ntitle: T\ndescription: D\ndate: 2026-02-01\nupdatedAt: 2026-01-01\n---\n",
      /updatedAt/,
    ],
    [
      "too many tags",
      `---\ntitle: T\ndescription: D\ndate: 2026-01-01\ntags: [${Array.from({ length: 11 }, (_, i) => `t${i}`).join(",")}]\n---\n`,
      /tags/,
    ],
    ["slug mismatch", "---\ntitle: T\nslug: other\ndescription: D\ndate: 2026-01-01\n---\n", /does not match/],
    ["broken YAML", '---\ntitle: "unclosed\ndescription: D\n---\n', /Invalid YAML/],
  ])("rejects %s", (_name, content, pattern) => {
    const result = parseArticle(file(content), options);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.map((issue) => issue.message).join("\n")).toMatch(pattern);
  });

  it("rejects non kebab-case filenames", () => {
    const result = parseArticle(
      file("---\ntitle: T\ndescription: D\ndate: 2026-01-01\n---\n", "posts/My_Post.mdx"),
      options,
    );
    expect(result.ok).toBe(false);
  });

  it("never throws on arbitrary input", () => {
    for (const content of ["", "---", "---\n---", "---\n- a\n- b\n---\n", "\0\0\0", "---\n: :\n---"]) {
      expect(() => parseArticle(file(content), options)).not.toThrow();
    }
  });
});

describe("parsePage", () => {
  it("parses a page", () => {
    const result = parsePage({ path: "pages/about.md", sha: "x", content: "---\ntitle: About\n---\nHi" });
    expect(result).toMatchObject({ ok: true, value: { slug: "about", format: "md", title: "About", body: "Hi" } });
  });
});
