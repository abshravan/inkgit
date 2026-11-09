import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArticleEditor } from "@/components/admin/editor/article-editor";
import { PageSkeleton } from "@/components/admin/page-skeleton";
import { requireAdminPage } from "@/modules/auth/guards";
import { getEditorialService } from "@/modules/content/container";

export const metadata: Metadata = { title: "Edit article" };

export default function EditArticlePage({ params }: PageProps<"/admin/articles/[slug]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EditArticle params={params} />
    </Suspense>
  );
}

async function EditArticle({ params }: Pick<PageProps<"/admin/articles/[slug]">, "params">) {
  await requireAdminPage();
  const { slug } = await params;
  const service = getEditorialService();
  const [article, overview] = await Promise.all([service.loadForEdit(slug), service.getOverview()]);
  if (!article) notFound();
  return <ArticleEditor mode="edit" categories={overview.categories} initial={article} />;
}
