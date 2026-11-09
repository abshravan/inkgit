import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { listCategories, listPublishedArticles, listTags } from "@/modules/content/queries";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url.replace(/\/+$/, "");
  const [articles, tags, categories] = await Promise.all([listPublishedArticles(), listTags(), listCategories()]);
  const latest = articles[0] ? (articles[0].updatedAt ?? articles[0].date) : undefined;
  return [
    { url: `${base}/`, ...(latest && { lastModified: latest }), changeFrequency: "weekly", priority: 1 },
    { url: `${base}/blog`, ...(latest && { lastModified: latest }), changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/about`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/tags`, changeFrequency: "weekly", priority: 0.3 },
    { url: `${base}/categories`, changeFrequency: "weekly", priority: 0.3 },
    ...articles.map((article) => ({
      url: `${base}/blog/${article.slug}`,
      lastModified: article.updatedAt ?? article.date,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...categories
      .filter(({ count }) => count > 0)
      .map(({ term }) => ({
        url: `${base}/categories/${term.slug}`,
        changeFrequency: "weekly" as const,
        priority: 0.4,
      })),
    ...tags.map(({ term }) => ({
      url: `${base}/tags/${term.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.3,
    })),
  ];
}
