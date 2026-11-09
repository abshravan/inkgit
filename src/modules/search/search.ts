import MiniSearch from "minisearch";
import type { Article } from "@/modules/content/types";
import { toPlainText } from "@/modules/rendering/text-stats";

export const MAX_QUERY_LENGTH = 100;

/** Normalizes user input so equivalent queries share a cache entry. */
export function normalizeQuery(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
  return value.replace(/\s+/g, " ").trim().toLowerCase().slice(0, MAX_QUERY_LENGTH);
}

/**
 * Full-text search over articles: fuzzy + prefix matching, with title, tags
 * and description weighted above body text. Pure, so it can be cached and
 * unit-tested; results keep the input's article objects.
 */
export function searchArticles(articles: readonly Article[], query: string, limit = 20): Article[] {
  const normalized = normalizeQuery(query);
  if (normalized.length < 2) return [];
  const engine = new MiniSearch<{
    id: string;
    title: string;
    description: string;
    tags: string;
    categories: string;
    body: string;
  }>({
    fields: ["title", "description", "tags", "categories", "body"],
    searchOptions: {
      boost: { title: 3, tags: 2, categories: 2, description: 1.5 },
      prefix: true,
      fuzzy: (term) => (term.length > 4 ? 0.2 : false),
      combineWith: "AND",
    },
  });
  engine.addAll(
    articles.map((article) => ({
      id: article.slug,
      title: article.title,
      description: article.description,
      tags: article.tags.map((tag) => tag.name).join(" "),
      categories: article.categories.map((category) => category.name).join(" "),
      body: toPlainText(article.body),
    })),
  );
  const bySlug = new Map(articles.map((article) => [article.slug, article]));
  return engine
    .search(normalized)
    .slice(0, limit)
    .map((result) => bySlug.get(String(result.id)))
    .filter((article): article is Article => article !== undefined);
}
