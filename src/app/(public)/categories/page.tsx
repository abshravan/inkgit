import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/site/container";
import { EmptyState } from "@/components/site/empty-state";
import { PageHeader } from "@/components/site/page-header";
import { listCategories } from "@/modules/content/queries";

export const metadata: Metadata = {
  title: "Categories",
  description: "Browse articles by category.",
  alternates: { canonical: "/categories" },
};

export default async function CategoriesPage() {
  const categories = await listCategories();
  return (
    <Container className="max-w-3xl">
      <PageHeader title="Categories" description="Articles grouped by subject." />
      {categories.length ? (
        <ul className="grid gap-4 py-8 sm:grid-cols-2">
          {categories.map(({ term, count }) => (
            <li key={term.slug}>
              <Link
                href={`/categories/${term.slug}`}
                className="flex h-full flex-col gap-2 rounded-xl border p-5 transition-colors hover:border-foreground/20"
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{term.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {count} {count === 1 ? "article" : "articles"}
                  </span>
                </span>
                {term.description && <span className="text-sm text-muted-foreground">{term.description}</span>}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="py-12">
          <EmptyState title="No categories yet" />
        </div>
      )}
    </Container>
  );
}
