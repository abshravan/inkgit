import { EditorSelection, EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { insertImage } from "@/components/admin/editor/markdown-commands";
import { altFromFilename } from "@/lib/upload-client";
import { isScheduled, liveContentLifetime, nextScheduledAt, selectLive } from "@/modules/content/selectors";
import type { Article } from "@/modules/content/types";
import { normalizeQuery, searchArticles } from "@/modules/search/search";
import { serializeJsonLd } from "@/modules/seo/json-ld";
import { buildRssFeed, escapeXml } from "@/modules/seo/rss";

function article(slug: string, overrides: Partial<Article> = {}): Article {
  return {
    slug,
    path: `posts/${slug}.mdx`,
    sha: "x",
    format: "mdx",
    title: slug,
    description: "",
    date: "2026-01-01",
    author: "Ada",
    tags: [],
    categories: [],
    published: true,
    featured: false,
    redirectFrom: [],
    body: "",
    wordCount: 0,
    readingTimeMinutes: 1,
    excerpt: "",
    ...overrides,
  };
}

const NOW = Date.parse("2026-11-09T12:00:00Z");

describe("scheduled publishing", () => {
  const list = [
    article("live", { date: "2026-11-01" }),
    article("today", { date: "2026-11-09" }),
    article("later", { date: "2026-11-10" }),
    article("draft", { date: "2026-10-01", published: false }),
  ];

  it("hides drafts and future-dated articles", () => {
    expect(selectLive(list, NOW).map((a) => a.slug)).toEqual(["live", "today"]);
    expect(isScheduled(list[2]!, NOW)).toBe(true);
    expect(isScheduled(list[3]!, NOW)).toBe(false);
  });

  it("finds the next go-live time", () => {
    expect(nextScheduledAt(list, NOW)).toBe(Date.parse("2026-11-10"));
    expect(nextScheduledAt(list.slice(0, 2), NOW)).toBeNull();
  });

  it("shortens the cache lifetime to the next go-live, within bounds", () => {
    expect(liveContentLifetime(null)).toEqual({ stale: 300, revalidate: 3600, expire: 86400 });
    expect(liveContentLifetime(600).revalidate).toBe(600);
    expect(liveContentLifetime(5)).toMatchObject({ revalidate: 60, stale: 60 });
    expect(liveContentLifetime(10 * 86400).revalidate).toBe(3600);
  });
});

describe("search", () => {
  const articles = [
    article("ts", {
      title: "TypeScript Patterns",
      tags: [{ slug: "typescript", name: "TypeScript" }],
      body: "Discriminated unions and branded types.",
    }),
    article("git", {
      title: "Git as a CMS",
      description: "Markdown in a repository",
      body: "Commits are history. TypeScript is mentioned once.",
    }),
    article("llm", { title: "Large Language Models", body: "Tokens and transformers." }),
  ];

  it("ranks title/tag matches above body matches", () => {
    expect(searchArticles(articles, "typescript").map((a) => a.slug)).toEqual(["ts", "git"]);
  });

  it("supports prefixes and typos", () => {
    expect(searchArticles(articles, "transf").map((a) => a.slug)).toEqual(["llm"]);
    expect(searchArticles(articles, "transfromers").map((a) => a.slug)).toEqual(["llm"]);
  });

  it("requires all terms and at least two characters", () => {
    expect(searchArticles(articles, "git tokens")).toEqual([]);
    expect(searchArticles(articles, "t")).toEqual([]);
  });

  it("normalizes queries", () => {
    expect(normalizeQuery(["  TypeScript   Patterns ", "x"])).toBe("typescript patterns");
    expect(normalizeQuery("a".repeat(500))).toHaveLength(100);
    expect(normalizeQuery(undefined)).toBe("");
  });
});

describe("RSS and JSON-LD", () => {
  it("escapes XML and builds a valid-looking feed", () => {
    expect(escapeXml(`<a href="x">Tom & Jerry's</a>\u0001`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&apos;s&lt;/a&gt;",
    );
    const xml = buildRssFeed({ name: "Blog & Co", description: "D", url: "https://example.com/", locale: "en" }, [
      article("b", { title: "B <script>", date: "2026-02-01", tags: [{ slug: "x", name: "X" }] }),
      article("a", { date: "2026-01-01", updatedAt: "2026-03-01" }),
    ]);
    expect(xml).toContain("<title>Blog &amp; Co</title>");
    expect(xml).toContain("<title>B &lt;script&gt;</title>");
    expect(xml).toContain("<link>https://example.com/blog/b</link>");
    expect(xml).toContain("<lastBuildDate>Sun, 01 Mar 2026 00:00:00 GMT</lastBuildDate>");
    expect(xml).toContain('<atom:link href="https://example.com/rss.xml" rel="self" type="application/rss+xml"/>');
    expect(xml.indexOf("blog/b")).toBeLessThan(xml.indexOf("blog/a"));
  });

  it("prevents script breakout in JSON-LD", () => {
    const out = serializeJsonLd({ headline: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(JSON.parse(out)).toEqual({ headline: "</script><script>alert(1)</script>" });
  });
});

describe("editor image helpers", () => {
  it("inserts an image with the alt text selected", () => {
    const state = EditorState.create({ doc: "Intro ", selection: EditorSelection.cursor(6) });
    const next = state.update(insertImage("https://cdn.example.com/a.png", "My [photo]")(state)).state;
    expect(next.doc.toString()).toBe("Intro ![My  photo](https://cdn.example.com/a.png)");
    expect(next.sliceDoc(next.selection.main.from, next.selection.main.to)).toBe("My  photo");
  });

  it("derives alt text from file names", () => {
    expect(altFromFilename("My_Photo-final.JPG")).toBe("My Photo final");
    expect(altFromFilename(".png")).toBe("image");
  });
});
