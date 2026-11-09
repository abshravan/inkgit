import { describe, expect, it } from "vitest";
import {
  countCategories,
  countTags,
  selectFeatured,
  selectPublished,
  selectRelated,
} from "@/modules/content/selectors";
import type { Article } from "@/modules/content/types";

function article(slug: string, overrides: Partial<Article> = {}): Article {
  return {
    slug,
    path: `posts/${slug}.mdx`,
    sha: "x",
    format: "mdx",
    title: slug,
    description: "",
    date: "2026-01-01",
    author: "a",
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
const tag = (slug: string) => ({ slug, name: slug });

describe("selectors", () => {
  it("filters drafts out", () => {
    expect(selectPublished([article("a"), article("b", { published: false })]).map((a) => a.slug)).toEqual(["a"]);
  });

  it("limits featured", () => {
    const list = ["a", "b", "c"].map((s) => article(s, { featured: true }));
    expect(selectFeatured(list, 2)).toHaveLength(2);
  });

  it("counts tags and keeps empty curated categories", () => {
    const list = [
      article("a", { tags: [tag("x"), tag("y")] }),
      article("b", { tags: [tag("x")], categories: [tag("eng")] }),
    ];
    expect(countTags(list)).toEqual([
      { term: tag("x"), count: 2 },
      { term: tag("y"), count: 1 },
    ]);
    expect(countCategories(list, [tag("eng"), tag("design")])).toEqual([
      { term: tag("eng"), count: 1 },
      { term: tag("design"), count: 0 },
    ]);
  });

  it("ranks related articles by category then tag overlap, excluding self and unrelated", () => {
    const target = article("t", { tags: [tag("x")], categories: [tag("eng")] });
    const list = [
      target,
      article("tag-only", { tags: [tag("x")] }),
      article("category", { categories: [tag("eng")] }),
      article("unrelated", { tags: [tag("z")] }),
    ];
    expect(selectRelated(list, target, 5).map((a) => a.slug)).toEqual(["category", "tag-only"]);
  });
});
