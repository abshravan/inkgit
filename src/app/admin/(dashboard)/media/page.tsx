import type { Metadata } from "next";
import { Suspense } from "react";
import { MediaLibrary } from "@/components/admin/media-library";
import { AdminPageHeader, PageSkeleton } from "@/components/admin/page-skeleton";
import { requireAdminPage } from "@/modules/auth/guards";
import { getContentService, getMediaService } from "@/modules/content/container";

export const metadata: Metadata = { title: "Media" };

export default function MediaPage() {
  return (
    <>
      <AdminPageHeader
        title="Media"
        description="Images are stored outside Git and referenced from articles by URL. Metadata such as GPS location is removed on upload."
      />
      <Suspense fallback={<PageSkeleton />}>
        <MediaContent />
      </Suspense>
    </>
  );
}

async function MediaContent() {
  await requireAdminPage();
  const { articles } = await getContentService().loadIndex();
  const service = getMediaService();
  const items = await service.listWithUsage(articles);
  return <MediaLibrary items={items} maxBytes={service.maxBytes} />;
}
