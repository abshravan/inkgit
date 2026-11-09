import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getContentService } from "./container";
import {
  countCategories,
  countTags,
  selectByCategory,
  selectByTag,
  selectFeatured,
  selectPublished,
  selectRelated,
} from "./selectors";
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

async function getPublishedArticles(): Promise<Article[]> {
  return selectPublished((await getIndex()).articles);
}

export async function listPublishedArticles(): Promise<Article[]> {
  return getPublishedArticles();
}

export async function getPublishedArticle(slug: string): Promise<Article | null> {
  if (!isValidSlug(slug)) return null;
  return (await getPublishedArticles()).find((article) => article.slug === slug) ?? null;
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
  const index = await getIndex();
  return countCategories(selectPublished(index.articles), index.categories);
}

export async function getTagWithArticles(slug: string) {
  const articles = await getPublishedArticles();
  const matching = selectByTag(articles, slug);
  const term = matching[0]?.tags.find((tag) => tag.slug === slug);
  return term ? { term, articles: matching } : null;
}

export async function getCategoryWithArticles(slug: string) {
  const index = await getIndex();
  const term = index.categories.find((category) => category.slug === slug);
  return term ? { term, articles: selectByCategory(selectPublished(index.articles), slug) } : null;
}

export async function getPage(slug: string): Promise<Page | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_CACHE_TAG);
  if (!isValidSlug(slug)) return null;
  return getContentService().loadPage(slug);
}
