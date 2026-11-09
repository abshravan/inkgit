import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getContentService } from "./container";
import {
  countCategories,
  countTags,
  selectByCategory,
  selectByTag,
  selectFeatured,
  liveContentLifetime,
  nextScheduledAt,
  selectLive,
  selectRelated,
} from "./selectors";
import { searchArticles } from "@/modules/search/search";
import { isValidSlug } from "./slug";
import type { Article, Category, ContentIndex, Page, TermWithCount } from "./types";

/**
 * Cached, read-only content queries for the public site.
 *
 * Everything is tagged `content` so a publish (or Git webhook in Phase 3) can
 * call `revalidateTag("content")`. The `hours` lifetime is a backstop in case
 * a revalidation signal is missed.
 */
export const CONTENT_CACHE_TAG = "content";

async function getIndex(): Promise<ContentIndex> {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_CACHE_TAG);
  return getContentService().loadIndex();
}

/**
 * What readers can see right now. Scheduled articles are filtered out, and the
 * cache lifetime is shortened so the next one appears on time (on the first
 * request after its date, served stale-while-revalidate).
 */
async function getLiveContent(): Promise<{ articles: Article[]; categories: Category[] }> {
  "use cache";
  cacheTag(CONTENT_CACHE_TAG);
  const index = await getIndex();
  const now = Date.now();
  const next = nextScheduledAt(index.articles, now);
  cacheLife(liveContentLifetime(next === null ? null : (next - now) / 1000));
  return { articles: selectLive(index.articles, now), categories: index.categories };
}

async function getPublishedArticles(): Promise<Article[]> {
  return (await getLiveContent()).articles;
}

export async function listPublishedArticles(): Promise<Article[]> {
  return getPublishedArticles();
}

export async function getPublishedArticle(slug: string): Promise<Article | null> {
  if (!isValidSlug(slug)) return null;
  return (await getPublishedArticles()).find((article) => article.slug === slug) ?? null;
}

/** Old slug → current slug for every published article with `redirectFrom`. */
export async function getRedirectMap(): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  for (const article of await getPublishedArticles()) {
    for (const from of article.redirectFrom) map[from] ??= article.slug;
  }
  return map;
}

/** Search results are cached per normalized query and refreshed with content. */
export async function searchPublishedArticles(query: string): Promise<Article[]> {
  "use cache";
  cacheTag(CONTENT_CACHE_TAG);
  cacheLife("hours");
  return searchArticles(await getPublishedArticles(), query);
}

export async function listFeaturedArticles(limit: number): Promise<Article[]> {
  return selectFeatured(await getPublishedArticles(), limit);
}

export async function listRelatedArticles(article: Article, limit = 3): Promise<Article[]> {
  return selectRelated(await getPublishedArticles(), article, limit);
}

export async function listTags(): Promise<TermWithCount[]> {
  return countTags(await getPublishedArticles());
}

export async function listCategories(): Promise<TermWithCount<Category>[]> {
  const { articles, categories } = await getLiveContent();
  return countCategories(articles, categories);
}

export async function getTagWithArticles(slug: string) {
  const articles = await getPublishedArticles();
  const matching = selectByTag(articles, slug);
  const term = matching[0]?.tags.find((tag) => tag.slug === slug);
  return term ? { term, articles: matching } : null;
}

export async function getCategoryWithArticles(slug: string) {
  const { articles, categories } = await getLiveContent();
  const term = categories.find((category) => category.slug === slug);
  return term ? { term, articles: selectByCategory(articles, slug) } : null;
}

export async function getPage(slug: string): Promise<Page | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_CACHE_TAG);
  if (!isValidSlug(slug)) return null;
  return getContentService().loadPage(slug);
}
