import { describe, expect, it } from "vitest";
import { formValuesFromData, parseLabelList } from "@/modules/content/editable";
import { parseArticle } from "@/modules/content/parse";
import { serializeArticle } from "@/modules/content/serialize";

describe("serializeArticle", () => {
  it("writes canonical key order, drops empties and keeps unknown keys last", () => {
    const output = serializeArticle(
      {
        zeta: 1,
        published: false,
        title: 'He said "hi": yes',
        tags: [],
        date: "2026-01-02",
        description: "D",
        coverImage: "",
      },
      "\n\nBody text",
    );
    expect(output).toBe(
      [
        "---",
        'title: "He said \\"hi\\": yes"',
        'description: "D"',
        'date: "2026-01-02"',
        "published: false",
        "zeta: 1",
        "---",
        "",
        "Body text",
        "",
      ].join("\n"),
    );
  });

  it("round-trips through the parser", () => {
    const source = serializeArticle(
      {
        title: "T: colon",
        description: "D",
        date: "2026-01-02",
        tags: ["AI", "C++"],
        categories: ["Engineering"],
        published: true,
      },
      "# Hello\n\nWorld",
    );
    const parsed = parseArticle(
      { path: "posts/t.mdx", sha: "x", content: source },
      { defaultAuthor: "a", wordsPerMinute: 200 },
    );
    expect(parsed.ok && parsed.value.article).toMatchObject({
      title: "T: colon",
      tagLabels: ["AI", "C++"],
      categoryLabels: ["Engineering"],
      published: true,
      body: "# Hello\n\nWorld\n",
    });
  });
});

describe("editable helpers", () => {
  it("reads lenient values from broken frontmatter", () => {
    expect(
      formValuesFromData({ title: 42, tags: "solo", date: new Date("2026-03-04"), featured: "yes" }, "2026-01-01"),
    ).toMatchObject({
      title: "42",
      tags: ["solo"],
      date: "2026-03-04",
      featured: false,
    });
    expect(formValuesFromData({ date: "soon" }, "2026-01-01").date).toBe("2026-01-01");
  });

  it("parses comma-separated labels", () => {
    expect(parseLabelList(" AI, llm ,, LLM ,Rust ")).toEqual(["AI", "llm", "Rust"]);
  });
});
