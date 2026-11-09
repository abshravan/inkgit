import type { Metadata } from "next";
import { ArticleRow } from "@/components/site/article-card";
import { Container } from "@/components/site/container";
import { EmptyState } from "@/components/site/empty-state";
import { PageHeader } from "@/components/site/page-header";
import { listPublishedArticles } from "@/modules/content/queries";

export const metadata: Metadata = {
  title: "Blog",
  description: "All published articles, newest first.",
  alternates: { canonical: "/blog" },
};

export default async function BlogPage() {
  const articles = await listPublishedArticles();
  return (
    <Container className="max-w-3xl">
      <PageHeader
        title="Blog"
        description={`${articles.length} ${articles.length === 1 ? "article" : "articles"}, newest first.`}
      />
      {articles.length ? (
        <div className="divide-y">
          {articles.map((article) => (
            <ArticleRow key={article.slug} article={article} />
          ))}
        </div>
      ) : (
        <div className="py-12">
          <EmptyState title="No articles yet" description="Published articles will appear here." />
        </div>
      )}
    </Container>
  );
}
