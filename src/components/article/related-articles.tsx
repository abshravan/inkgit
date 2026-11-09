import { ArticleCard } from "@/components/site/article-card";
import type { Article } from "@/modules/content/types";

export function RelatedArticles({ articles }: { articles: Article[] }) {
  if (!articles.length) return null;
  return (
    <section aria-labelledby="related-heading" className="mx-auto mt-16 max-w-3xl xl:max-w-none">
      <h2 id="related-heading" className="mb-6 text-sm font-medium tracking-wide text-muted-foreground uppercase">
        Related articles
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <ArticleCard key={article.slug} article={article} />
        ))}
      </div>
    </section>
  );
}
