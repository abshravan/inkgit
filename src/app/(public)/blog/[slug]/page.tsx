import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleBody, compileSafely } from "@/components/article/article-body";
import { ReadingProgress } from "@/components/article/reading-progress";
import { RelatedArticles } from "@/components/article/related-articles";
import { ShareLinks } from "@/components/article/share-links";
import { TableOfContents } from "@/components/article/table-of-contents";
import { ArticleMeta } from "@/components/site/article-meta";
import { Container } from "@/components/site/container";
import { CategoryLinks, TagBadges } from "@/components/site/term-badges";
import { Separator } from "@/components/ui/separator";
import { siteConfig } from "@/config/site";
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
  if (!article) notFound();

  const [outcome, related] = await Promise.all([
    compileSafely(article.body, article.format, article.path),
    listRelatedArticles(article, 3),
  ]);
  const toc = outcome.ok ? outcome.compiled.toc : [];
  const shareUrl = new URL(`/blog/${article.slug}`, siteConfig.url).toString();

  return (
    <>
      <ReadingProgress targetId="article-content" />
      <Container className="max-w-6xl">
        <div className="grid gap-12 pt-12 sm:pt-16 xl:grid-cols-[minmax(0,1fr)_14rem]">
          <article className="mx-auto w-full max-w-3xl min-w-0">
            <header className="flex flex-col gap-4">
              <CategoryLinks categories={article.categories} />
              <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{article.title}</h1>
              <p className="text-lg text-pretty text-muted-foreground">{article.description}</p>
              <ArticleMeta article={article} />
              <TagBadges tags={article.tags} />
            </header>

            {article.coverImage && (
              // Cover images may be remote or local; dimensions are unknown, so use a fixed aspect frame.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={article.coverImage}
                alt={article.coverAlt ?? article.title}
                className="mt-8 aspect-[2/1] w-full rounded-xl border object-cover"
                fetchPriority="high"
              />
            )}

            {toc.length >= 2 && (
              <details className="mt-8 rounded-lg border p-4 xl:hidden">
                <summary className="cursor-pointer text-sm font-medium">On this page</summary>
                <div className="mt-4">
                  <TableOfContents entries={toc} />
                </div>
              </details>
            )}

            <div id="article-content" className="prose-inkgit prose mt-10 max-w-none prose-neutral dark:prose-invert">
              <ArticleBody outcome={outcome} />
            </div>

            <Separator className="my-10" />
            <footer className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <TagBadges tags={article.tags} />
              <ShareLinks url={shareUrl} title={article.title} />
            </footer>
          </article>

          <aside className="hidden xl:block">
            <div className="sticky top-24">
              <TableOfContents entries={toc} />
            </div>
          </aside>
        </div>
        <RelatedArticles articles={related} />
      </Container>
    </>
  );
}
