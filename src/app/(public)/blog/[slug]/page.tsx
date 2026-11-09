import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { compileSafely } from "@/components/article/article-body";
import { ArticleView } from "@/components/article/article-view";
import { siteConfig } from "@/config/site";
import { serializeJsonLd } from "@/modules/seo/json-ld";
import { withPlaceholder } from "@/lib/static-params";
import { getPublishedArticle, listPublishedArticles, listRelatedArticles } from "@/modules/content/queries";

/**
 * Every known slug is prerendered (generateStaticParams). An unknown slug
 * resolves in one blocking request instead of streaming a shell, so the page
 * can decide (404 or content) before anything is sent. That's a deliberate
 * blocking route, so opt out of instant-navigation validation.
 */
export const instant = false;

export async function generateStaticParams() {
  const articles = await listPublishedArticles();
  return withPlaceholder(
    "slug",
    articles.map((article) => article.slug),
  );
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublishedArticle(slug);
  if (!article) return { title: "Not found" };
  const url = `/blog/${article.slug}`;
  return {
    title: article.title,
    description: article.description,
    authors: [{ name: article.author }],
    keywords: article.tags.map((tag) => tag.name),
    alternates: { canonical: article.canonicalUrl ?? url },
    openGraph: {
      type: "article",
      url,
      title: article.title,
      description: article.description,
      publishedTime: article.date,
      ...(article.updatedAt && { modifiedTime: article.updatedAt }),
      authors: [article.author],
      tags: article.tags.map((tag) => tag.name),
      images: [{ url: `/og/blog/${article.slug}`, width: 1200, height: 630, alt: article.title }],
    },
    twitter: { card: "summary_large_image", images: [`/og/blog/${article.slug}`] },
  };
}

export default async function ArticlePage({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const article = await getPublishedArticle(slug);
  // Old slugs of renamed articles are redirected in proxy.ts, before rendering.
  // (A redirect thrown here would be cached by Next.js without its Location header.)
  if (!article) notFound();

  const [outcome, related] = await Promise.all([
    compileSafely(article.body, article.format, article.path),
    listRelatedArticles(article, 3),
  ]);
  const url = new URL(`/blog/${article.slug}`, siteConfig.url).toString();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.description,
    datePublished: article.date,
    dateModified: article.updatedAt ?? article.date,
    author: { "@type": "Person", name: article.author },
    publisher: { "@type": "Organization", name: siteConfig.name },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    image: new URL(`/og/blog/${article.slug}`, siteConfig.url).toString(),
    keywords: article.tags.map((tag) => tag.name).join(", "),
    wordCount: article.wordCount,
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <ArticleView article={article} outcome={outcome} related={related} />
    </>
  );
}
