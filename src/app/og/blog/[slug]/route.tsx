import { ImageResponse } from "next/og";
import { OgCard } from "@/components/seo/og-card";
import { siteConfig } from "@/config/site";
import { formatDate, formatReadingTime } from "@/lib/format";
import { withPlaceholder } from "@/lib/static-params";
import { getPublishedArticle, listPublishedArticles } from "@/modules/content/queries";

/**
 * Social card for an article at a stable URL (`/og/blog/<slug>`), referenced
 * from the page metadata and JSON-LD. (The `opengraph-image` file convention
 * adds a hashed suffix to dynamic routes, which can't be referenced reliably.)
 */
export async function generateStaticParams() {
  return withPlaceholder(
    "slug",
    (await listPublishedArticles()).map((article) => article.slug),
  );
}

export async function GET(_request: Request, { params }: RouteContext<"/og/blog/[slug]">): Promise<Response> {
  const article = await getPublishedArticle((await params).slug);
  if (!article) return new Response("Not found", { status: 404 });
  return new ImageResponse(
    <OgCard
      eyebrow={article.categories[0]?.name ?? siteConfig.name}
      title={article.title}
      footer={`${siteConfig.name} · ${formatDate(article.date)} · ${formatReadingTime(article.readingTimeMinutes)}`}
    />,
    { width: 1200, height: 630 },
  );
}
