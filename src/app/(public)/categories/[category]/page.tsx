import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleRow } from "@/components/site/article-card";
import { Container } from "@/components/site/container";
import { EmptyState } from "@/components/site/empty-state";
import { PageHeader } from "@/components/site/page-header";
import { withPlaceholder } from "@/lib/static-params";
import { getCategoryWithArticles, listCategories } from "@/modules/content/queries";

export async function generateStaticParams() {
  return withPlaceholder(
    "category",
    (await listCategories()).map(({ term }) => term.slug),
  );
}

export async function generateMetadata({ params }: PageProps<"/categories/[category]">): Promise<Metadata> {
  const result = await getCategoryWithArticles((await params).category);
  if (!result) return { title: "Not found" };
  return {
    title: result.term.name,
    description: result.term.description ?? `Articles in ${result.term.name}.`,
    alternates: { canonical: `/categories/${result.term.slug}` },
  };
}

export default async function CategoryPage({ params }: PageProps<"/categories/[category]">) {
  const result = await getCategoryWithArticles((await params).category);
  if (!result) notFound();
  const { term, articles } = result;
  return (
    <Container className="max-w-3xl">
      <PageHeader eyebrow="Category" title={term.name} {...(term.description && { description: term.description })} />
      {articles.length ? (
        <div className="divide-y">
          {articles.map((article) => (
            <ArticleRow key={article.slug} article={article} />
          ))}
        </div>
      ) : (
        <div className="py-12">
          <EmptyState title="Nothing here yet" description="No published articles in this category." />
        </div>
      )}
    </Container>
  );
}
