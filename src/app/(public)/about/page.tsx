import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleBody, compileSafely } from "@/components/article/article-body";
import { Container } from "@/components/site/container";
import { PageHeader } from "@/components/site/page-header";
import { getPage } from "@/modules/content/queries";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("about");
  return {
    title: page?.title ?? "About",
    ...(page?.description && { description: page.description }),
    alternates: { canonical: "/about" },
  };
}

export default async function AboutPage() {
  const page = await getPage("about");
  if (!page) notFound();
  const outcome = await compileSafely(page.body, page.format, page.path);
  return (
    <Container className="max-w-3xl">
      <PageHeader title={page.title} {...(page.description && { description: page.description })} />
      <div className="prose-inkgit prose mt-10 max-w-none prose-neutral dark:prose-invert">
        <ArticleBody outcome={outcome} />
      </div>
    </Container>
  );
}
