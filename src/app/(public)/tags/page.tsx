import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/site/container";
import { EmptyState } from "@/components/site/empty-state";
import { PageHeader } from "@/components/site/page-header";
import { listTags } from "@/modules/content/queries";

export const metadata: Metadata = {
  title: "Tags",
  description: "Browse articles by tag.",
  alternates: { canonical: "/tags" },
};

export default async function TagsPage() {
  const tags = await listTags();
  return (
    <Container className="max-w-3xl">
      <PageHeader title="Tags" description="Browse articles by topic." />
      {tags.length ? (
        <ul className="flex flex-wrap gap-2 py-8">
          {tags.map(({ term, count }) => (
            <li key={term.slug}>
              <Link
                href={`/tags/${term.slug}`}
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
              >
                #{term.name}
                <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="py-12">
          <EmptyState title="No tags yet" />
        </div>
      )}
    </Container>
  );
}
