import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { ArticleCard, ArticleRow } from "@/components/site/article-card";
import { Container } from "@/components/site/container";
import { EmptyState } from "@/components/site/empty-state";
import { SocialLinks } from "@/components/site/social-links";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { listCategories, listFeaturedArticles, listPublishedArticles, listTags } from "@/modules/content/queries";

export default async function HomePage() {
  const { featuredCount, recentCount } = siteConfig.homepage;
  const [all, featured, categories, tags] = await Promise.all([
    listPublishedArticles(),
    listFeaturedArticles(featuredCount),
    listCategories(),
    listTags(),
  ]);
  const featuredSlugs = new Set(featured.map((article) => article.slug));
  const recent = all.filter((article) => !featuredSlugs.has(article.slug)).slice(0, recentCount);

  return (
    <Container>
      <section className="flex flex-col gap-6 pt-16 pb-12 sm:pt-24">
        <p className="w-fit rounded-full border px-3 py-1 text-xs text-muted-foreground">
          Written in Markdown · Versioned in Git
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          {siteConfig.tagline}
        </h1>
        <p className="max-w-2xl text-lg text-pretty text-muted-foreground">{siteConfig.description}</p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/blog">
              Read the blog <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/about">About</Link>
          </Button>
        </div>
      </section>

      {all.length === 0 ? (
        <EmptyState title="No articles yet" description="Published articles will appear here." />
      ) : (
        <>
          {featured.length > 0 && (
            <section aria-labelledby="featured-heading" className="py-8">
              <h2
                id="featured-heading"
                className="mb-6 text-sm font-medium tracking-wide text-muted-foreground uppercase"
              >
                Featured
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {featured.map((article) => (
                  <ArticleCard key={article.slug} article={article} variant="featured" />
                ))}
              </div>
            </section>
          )}

          <div className="grid gap-12 py-8 lg:grid-cols-[1fr_16rem]">
            <section aria-labelledby="recent-heading">
              <div className="mb-2 flex items-center justify-between">
                <h2 id="recent-heading" className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
                  Recent
                </h2>
                <Link href="/blog" className="text-sm text-muted-foreground hover:text-foreground">
                  All articles →
                </Link>
              </div>
              {recent.length ? (
                <div className="divide-y">
                  {recent.map((article) => (
                    <ArticleRow key={article.slug} article={article} />
                  ))}
                </div>
              ) : (
                <p className="py-6 text-sm text-muted-foreground">Everything published is featured above.</p>
              )}
            </section>

            <aside className="flex flex-col gap-10">
              <section aria-labelledby="about-heading" className="flex flex-col gap-3">
                <h2 id="about-heading" className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
                  About
                </h2>
                <p className="text-sm leading-relaxed">{siteConfig.author.bio}</p>
                <SocialLinks className="-ml-2" />
              </section>
              {categories.length > 0 && (
                <section aria-labelledby="categories-heading" className="flex flex-col gap-3">
                  <h2
                    id="categories-heading"
                    className="text-sm font-medium tracking-wide text-muted-foreground uppercase"
                  >
                    Categories
                  </h2>
                  <ul className="flex flex-col gap-1 text-sm">
                    {categories
                      .filter(({ count }) => count > 0)
                      .map(({ term, count }) => (
                        <li key={term.slug}>
                          <Link href={`/categories/${term.slug}`} className="flex justify-between hover:underline">
                            {term.name} <span className="text-muted-foreground tabular-nums">{count}</span>
                          </Link>
                        </li>
                      ))}
                  </ul>
                </section>
              )}
              {tags.length > 0 && (
                <section aria-labelledby="tags-heading" className="flex flex-col gap-3">
                  <h2 id="tags-heading" className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
                    Tags
                  </h2>
                  <ul className="flex flex-wrap gap-1.5">
                    {tags.slice(0, 15).map(({ term }) => (
                      <li key={term.slug}>
                        <Badge variant="secondary" asChild>
                          <Link href={`/tags/${term.slug}`}>#{term.name}</Link>
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </aside>
          </div>
        </>
      )}
    </Container>
  );
}
