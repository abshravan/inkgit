import { parse as parseYaml } from "yaml";
import type { ParsedArticle } from "./parse";
import { taxonomySchema } from "./schema";
import { slugify } from "./slug";
import type { Article, Category, ContentIndex, ContentIssue, TaxonomyTerm } from "./types";

export const TAXONOMY_PATH = "taxonomy.yml";

/**
 * Parses the curated category list. A missing file is valid (categories are
 * then derived from articles); a malformed one is reported and ignored.
 */
export function parseTaxonomy(source: string | null): { categories: Category[] | null; issues: ContentIssue[] } {
  if (source === null) return { categories: null, issues: [] };
  let raw: unknown;
  try {
    raw = parseYaml(source) ?? {};
  } catch (error) {
    const reason = error instanceof Error ? error.message.split("\n")[0] : "unknown error";
    return { categories: null, issues: [{ path: TAXONOMY_PATH, severity: "error", message: `Invalid YAML: ${reason}` }] };
  }
  const parsed = taxonomySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      categories: null,
      issues: parsed.error.issues.map((issue) => ({
        path: TAXONOMY_PATH,
        severity: "error" as const,
        message: `${issue.path.join(".")} ${issue.message}`,
      })),
    };
  }
  const categories = parsed.data.categories
    .map((category) => ({
      slug: category.slug ?? slugify(category.name),
      name: category.name,
      ...(category.description && { description: category.description }),
    }))
    .filter((category) => category.slug.length > 0);
  return { categories, issues: [] };
}

/**
 * Turns individually parsed articles into a consistent index: resolves tag and
 * category labels to terms, enforces unique slugs, and sorts newest first.
 */
export function buildContentIndex(input: {
  articles: ParsedArticle[];
  curatedCategories: Category[] | null;
  issues: ContentIssue[];
}): ContentIndex {
  const issues = [...input.issues];
  const categoryLookup = new Map<string, Category>();
  for (const category of input.curatedCategories ?? []) {
    categoryLookup.set(category.slug, category);
    categoryLookup.set(category.name.toLowerCase(), category);
  }
  const derivedCategories = new Map<string, Category>();

  const resolveCategory = (labelText: string, path: string): Category | null => {
    const slug = slugify(labelText);
    const match = categoryLookup.get(labelText.toLowerCase()) ?? categoryLookup.get(slug);
    if (match) return match;
    if (input.curatedCategories === null) {
      if (!slug) return null;
      const derived = derivedCategories.get(slug) ?? { slug, name: labelText };
      derivedCategories.set(slug, derived);
      return derived;
    }
    issues.push({ path, severity: "warning", message: `Unknown category "${labelText}" (not in ${TAXONOMY_PATH}); ignored` });
    return null;
  };

  const tagNames = new Map<string, string>();
  const resolveTag = (labelText: string): TaxonomyTerm | null => {
    const slug = slugify(labelText);
    if (!slug) return null;
    // First spelling wins so "React" and "react" share one display label.
    if (!tagNames.has(slug)) tagNames.set(slug, labelText);
    return { slug, name: tagNames.get(slug) ?? labelText };
  };

  const bySlug = new Map<string, Article>();
  const sorted = [...input.articles].sort((a, b) => a.path.localeCompare(b.path));
  for (const parsed of sorted) {
    const existing = bySlug.get(parsed.slug);
    if (existing) {
      issues.push({
        path: parsed.path,
        severity: "error",
        message: `Duplicate slug "${parsed.slug}" (already used by ${existing.path}); file ignored`,
      });
      continue;
    }
    const { tagLabels, categoryLabels, ...rest } = parsed;
    const article: Article = {
      ...rest,
      tags: uniqueBySlug(tagLabels.map(resolveTag)),
      categories: uniqueBySlug(categoryLabels.map((labelText) => resolveCategory(labelText, parsed.path))),
    };
    bySlug.set(article.slug, article);
  }

  const articles = [...bySlug.values()].sort(compareNewestFirst);
  const categories = input.curatedCategories ?? [...derivedCategories.values()].sort((a, b) => a.name.localeCompare(b.name));
  return { articles, categories, issues };
}

export function compareNewestFirst(a: Pick<Article, "date" | "slug">, b: Pick<Article, "date" | "slug">): number {
  return Date.parse(b.date) - Date.parse(a.date) || a.slug.localeCompare(b.slug);
}

function uniqueBySlug<T extends TaxonomyTerm>(terms: Array<T | null>): T[] {
  const seen = new Set<string>();
  return terms.filter((term): term is T => {
    if (!term || seen.has(term.slug)) return false;
    seen.add(term.slug);
    return true;
  });
}
