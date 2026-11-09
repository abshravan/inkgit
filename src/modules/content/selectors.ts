import type { Article, Category, TaxonomyTerm, TermWithCount } from "./types";

/**
 * Pure query helpers over an article list. Kept separate from caching and I/O
 * so they're trivially unit-testable.
 */

export function selectPublished(articles: readonly Article[]): Article[] {
  return articles.filter((article) => article.published);
}

/**
 * Articles visible to readers at `now`: published, and not scheduled for a
 * later date. A published article with a future `date` goes live on that date
 * (date-only values mean 00:00 UTC).
 */
export function selectLive(articles: readonly Article[], now: number): Article[] {
  return articles.filter((article) => article.published && Date.parse(article.date) <= now);
}

/** Published articles waiting for their date. */
export function isScheduled(article: Pick<Article, "published" | "date">, now: number): boolean {
  return article.published && Date.parse(article.date) > now;
}

/** When the next scheduled article goes live (epoch ms), or null. */
export function nextScheduledAt(articles: readonly Article[], now: number): number | null {
  let next: number | null = null;
  for (const article of articles) {
    const at = Date.parse(article.date);
    if (article.published && at > now && (next === null || at < next)) next = at;
  }
  return next;
}

export function selectFeatured(articles: readonly Article[], limit: number): Article[] {
  return articles.filter((article) => article.featured).slice(0, limit);
}

export function selectByTag(articles: readonly Article[], tagSlug: string): Article[] {
  return articles.filter((article) => article.tags.some((tag) => tag.slug === tagSlug));
}

export function selectByCategory(articles: readonly Article[], categorySlug: string): Article[] {
  return articles.filter((article) => article.categories.some((category) => category.slug === categorySlug));
}

export function countTags(articles: readonly Article[]): TermWithCount[] {
  return countTerms(articles.flatMap((article) => article.tags));
}

/** Curated categories with their article counts; empty categories are kept at zero. */
export function countCategories(articles: readonly Article[], categories: readonly Category[]): TermWithCount<Category>[] {
  const counts = new Map<string, number>();
  for (const category of articles.flatMap((article) => article.categories)) {
    counts.set(category.slug, (counts.get(category.slug) ?? 0) + 1);
  }
  return categories.map((term) => ({ term, count: counts.get(term.slug) ?? 0 }));
}

function countTerms(terms: TaxonomyTerm[]): TermWithCount[] {
  const map = new Map<string, TermWithCount>();
  for (const term of terms) {
    const entry = map.get(term.slug) ?? { term, count: 0 };
    entry.count += 1;
    map.set(term.slug, entry);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.term.name.localeCompare(b.term.name));
}

/**
 * Related articles ranked by shared categories (weighted higher) and tags,
 * falling back to recency. Excludes the article itself.
 */
export function selectRelated(articles: readonly Article[], target: Article, limit: number): Article[] {
  const targetTags = new Set(target.tags.map((tag) => tag.slug));
  const targetCategories = new Set(target.categories.map((category) => category.slug));
  return articles
    .filter((candidate) => candidate.slug !== target.slug)
    .map((candidate, recencyRank) => ({
      candidate,
      recencyRank,
      score:
        candidate.categories.filter((category) => targetCategories.has(category.slug)).length * 2 +
        candidate.tags.filter((tag) => targetTags.has(tag.slug)).length,
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.recencyRank - b.recencyRank)
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}

const HOUR = 3600;

/**
 * Cache lifetime for live content: normally an hour, but shortened so it ends
 * when the next scheduled article should go live (never below a minute, and
 * `expire` stays long so pages remain prerenderable).
 */
export function liveContentLifetime(secondsUntilNextScheduled: number | null): {
  stale: number;
  revalidate: number;
  expire: number;
} {
  const revalidate =
    secondsUntilNextScheduled === null ? HOUR : Math.min(HOUR, Math.max(60, Math.ceil(secondsUntilNextScheduled)));
  return { stale: Math.min(300, revalidate), revalidate, expire: 24 * HOUR };
}
