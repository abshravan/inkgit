import { siteConfig } from "@/config/site";
import { listPublishedArticles } from "@/modules/content/queries";
import { buildRssFeed } from "@/modules/seo/rss";

export async function GET(): Promise<Response> {
  const xml = buildRssFeed(siteConfig, await listPublishedArticles());
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
