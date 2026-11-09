import { Eye } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { compileSafely } from "@/components/article/article-body";
import { ArticleView } from "@/components/article/article-view";
import { PageSkeleton } from "@/components/admin/page-skeleton";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { requireAdminPage } from "@/modules/auth/guards";
import { getContentService } from "@/modules/content/container";

export const metadata: Metadata = { title: "Preview" };

/** Full-page preview of the saved version (drafts included), rendered exactly like the public page. */
export default function PreviewPage({ params }: PageProps<"/admin/preview/[slug]">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Suspense fallback={<PageSkeleton />}>
          <Preview params={params} />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}

async function Preview({ params }: Pick<PageProps<"/admin/preview/[slug]">, "params">) {
  await requireAdminPage();
  const { slug } = await params;
  const index = await getContentService().loadIndex();
  const article = index.articles.find((candidate) => candidate.slug === slug);
  if (!article) notFound();
  const outcome = await compileSafely(article.body, article.format, article.path);
  return (
    <>
      <div className="sticky top-14 z-30 border-b bg-amber-100/90 px-4 py-2 text-center text-sm text-amber-900 backdrop-blur dark:bg-amber-500/20 dark:text-amber-100">
        <Eye className="mr-1.5 inline size-4" aria-hidden />
        Preview of the saved {article.published ? "published" : "draft"} version ·{" "}
        <Link href={`/admin/articles/${article.slug}`} className="underline">
          Back to editor
        </Link>
      </div>
      <ArticleView article={article} outcome={outcome} related={[]} />
    </>
  );
}
