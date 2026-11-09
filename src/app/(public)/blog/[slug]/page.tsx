import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { compileSafely } from "@/components/article/article-body";
import { ArticleView } from "@/components/article/article-view";
import { withPlaceholder } from "@/lib/static-params";
import { getPublishedArticle, listPublishedArticles, listRelatedArticles } from "@/modules/content/queries";

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
      ...(article.coverImage && { images: [{ url: article.coverImage, alt: article.coverAlt ?? article.title }] }),
    },
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
  return <ArticleView article={article} outcome={outcome} related={related} />;
}
