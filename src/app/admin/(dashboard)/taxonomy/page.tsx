import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminPageHeader, PageSkeleton } from "@/components/admin/page-skeleton";
import { TaxonomyManager } from "@/components/admin/taxonomy-manager";
import { requireAdminPage } from "@/modules/auth/guards";
import { getTaxonomyService } from "@/modules/content/container";

export const metadata: Metadata = { title: "Categories & tags" };

export default function TaxonomyPage() {
  return (
    <>
      <AdminPageHeader
        title="Categories & tags"
        description="Renaming or deleting updates every affected article in a single commit."
      />
      <Suspense fallback={<PageSkeleton />}>
        <TaxonomyContent />
      </Suspense>
    </>
  );
}

async function TaxonomyContent() {
  await requireAdminPage();
  const overview = await getTaxonomyService().getOverview();
  return <TaxonomyManager overview={overview} />;
}
