import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArticlesTable } from "@/components/admin/articles-table";
import { AdminPageHeader, PageSkeleton } from "@/components/admin/page-skeleton";
import { Button } from "@/components/ui/button";
import { requireAdminPage } from "@/modules/auth/guards";
import { getEditorialService } from "@/modules/content/container";

export const metadata: Metadata = { title: "Articles" };

export default function ArticlesPage() {
  return (
    <>
      <AdminPageHeader
        title="Articles"
        description="Drafts and published articles in your content repository."
        actions={
          <Button asChild size="sm">
            <Link href="/admin/articles/new">
              <Plus /> New article
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<PageSkeleton />}>
        <ArticlesContent />
      </Suspense>
    </>
  );
}

async function ArticlesContent() {
  await requireAdminPage();
  const { articles, categories } = await getEditorialService().getOverview();
  return (
    <div className="p-6">
      <ArticlesTable articles={articles} categories={categories.map((category) => category.name)} />
    </div>
  );
}
