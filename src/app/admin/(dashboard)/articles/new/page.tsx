import type { Metadata } from "next";
import { Suspense } from "react";
import { ArticleEditor } from "@/components/admin/editor/article-editor";
import { PageSkeleton } from "@/components/admin/page-skeleton";
import { requireAdminPage } from "@/modules/auth/guards";
import { getEditorialService } from "@/modules/content/container";

export const metadata: Metadata = { title: "New article" };

export default function NewArticlePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewArticleEditor />
    </Suspense>
  );
}

async function NewArticleEditor() {
  await requireAdminPage();
  const service = getEditorialService();
  const { categories } = await service.getOverview();
  return (
    <ArticleEditor
      mode="create"
      categories={categories}
      initial={{
        slug: "",
        sha: null,
        format: "mdx",
        published: false,
        values: service.newArticleValues(),
        body: "",
        issues: [],
      }}
    />
  );
}
