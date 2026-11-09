import { Search } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ArticleRow } from "@/components/site/article-card";
import { Container } from "@/components/site/container";
import { EmptyState } from "@/components/site/empty-state";
import { PageHeader } from "@/components/site/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchPublishedArticles } from "@/modules/content/queries";
import { MAX_QUERY_LENGTH, normalizeQuery } from "@/modules/search/search";

export const metadata: Metadata = {
  title: "Search",
  description: "Search all articles.",
  robots: { index: false, follow: true },
};

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <Container className="max-w-3xl">
      <PageHeader title="Search" />
      {/* The query is request data, so the form and results stream in. */}
      <Suspense fallback={<SearchForm query="" />}>
        <SearchResults searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

function SearchForm({ query }: { query: string }) {
  return (
    <form action="/search" method="get" role="search" className="flex gap-2 py-8">
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          name="q"
          defaultValue={query}
          maxLength={MAX_QUERY_LENGTH}
          placeholder="Search articles, tags, topics…"
          aria-label="Search articles"
          className="h-10 pl-9"
          autoFocus
        />
      </div>
      <Button type="submit" className="h-10">
        Search
      </Button>
    </form>
  );
}

async function SearchResults({ searchParams }: Pick<PageProps<"/search">, "searchParams">) {
  const raw = (await searchParams).q;
  const query = normalizeQuery(raw);
  const results = query.length >= 2 ? await searchPublishedArticles(query) : [];
  return (
    <>
      <SearchForm query={typeof raw === "string" ? raw.slice(0, MAX_QUERY_LENGTH) : ""} />
      {query.length === 0 ? null : query.length < 2 ? (
        <p className="text-sm text-muted-foreground">Type at least two characters.</p>
      ) : results.length === 0 ? (
        <EmptyState title="No matches" description={`Nothing found for “${query}”. Try a broader term.`} />
      ) : (
        <section aria-live="polite">
          <p className="text-sm text-muted-foreground">
            {results.length} result{results.length === 1 ? "" : "s"} for “{query}”
          </p>
          <div className="divide-y">
            {results.map((article) => (
              <ArticleRow key={article.slug} article={article} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
