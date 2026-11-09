import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleRow } from "@/components/site/article-card";
import { Container } from "@/components/site/container";
import { PageHeader } from "@/components/site/page-header";
import { withPlaceholder } from "@/lib/static-params";
import { getTagWithArticles, listTags } from "@/modules/content/queries";

/**
 * Every known slug is prerendered (generateStaticParams). An unknown slug
 * resolves in one blocking request instead of streaming a shell, so the page
 * can decide (404 or content) before anything is sent. That's a deliberate
 * blocking route, so opt out of instant-navigation validation.
 */
export const instant = false;

export async function generateStaticParams() {
  return withPlaceholder(
    "tag",
    (await listTags()).map(({ term }) => term.slug),
  );
}

export async function generateMetadata({ params }: PageProps<"/tags/[tag]">): Promise<Metadata> {
  const result = await getTagWithArticles((await params).tag);
  if (!result) return { title: "Not found" };
  return {
    title: `#${result.term.name}`,
    description: `Articles tagged ${result.term.name}.`,
    alternates: { canonical: `/tags/${result.term.slug}` },
  };
}

export default async function TagPage({ params }: PageProps<"/tags/[tag]">) {
  const result = await getTagWithArticles((await params).tag);
  if (!result) notFound();
  const { term, articles } = result;
  return (
    <Container className="max-w-3xl">
      <PageHeader
        eyebrow="Tag"
        title={`#${term.name}`}
        description={`${articles.length} ${articles.length === 1 ? "article" : "articles"}`}
      />
      <div className="divide-y">
        {articles.map((article) => (
          <ArticleRow key={article.slug} article={article} />
        ))}
      </div>
    </Container>
  );
}
