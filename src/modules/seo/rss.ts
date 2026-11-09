import type { Article } from "@/modules/content/types";

export interface FeedSite {
  name: string;
  description: string;
  url: string;
  locale: string;
}

const XML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };

export function escapeXml(value: string): string {
  // Also drop characters that are illegal in XML 1.0.
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/[&<>"']/g, (c) => XML_ESCAPES[c]!);
}

const rfc822 = (date: string) => new Date(Date.parse(date)).toUTCString();

/**
 * RSS 2.0 feed of the newest articles (summaries with links). Dates come from
 * content, not the clock, so the output is deterministic and cacheable.
 */
export function buildRssFeed(site: FeedSite, articles: readonly Article[], limit = 20): string {
  const base = site.url.replace(/\/+$/, "");
  const items = articles.slice(0, limit);
  const lastBuild = items.reduce<string | null>((latest, article) => {
    const candidate = article.updatedAt ?? article.date;
    return !latest || Date.parse(candidate) > Date.parse(latest) ? candidate : latest;
  }, null);

  const itemXml = items
    .map((article) => {
      const link = `${base}/blog/${article.slug}`;
      return [
        "    <item>",
        `      <title>${escapeXml(article.title)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
        `      <pubDate>${rfc822(article.date)}</pubDate>`,
        `      <description>${escapeXml(article.description)}</description>`,
        `      <dc:creator>${escapeXml(article.author)}</dc:creator>`,
        ...article.categories.map((category) => `      <category>${escapeXml(category.name)}</category>`),
        ...article.tags.map((tag) => `      <category>${escapeXml(tag.name)}</category>`),
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    "  <channel>",
    `    <title>${escapeXml(site.name)}</title>`,
    `    <link>${escapeXml(`${base}/`)}</link>`,
    `    <description>${escapeXml(site.description)}</description>`,
    `    <language>${escapeXml(site.locale)}</language>`,
    `    <atom:link href="${escapeXml(`${base}/rss.xml`)}" rel="self" type="application/rss+xml"/>`,
    ...(lastBuild ? [`    <lastBuildDate>${rfc822(lastBuild)}</lastBuildDate>`] : []),
    ...(itemXml ? [itemXml] : []),
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}
