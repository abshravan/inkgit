import { ArrowLeft, ExternalLink, GitCommitHorizontal } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DiffView } from "@/components/admin/diff-view";
import { RestoreButton } from "@/components/admin/restore-button";
import { AdminPageHeader, PageSkeleton } from "@/components/admin/page-skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireAdminPage } from "@/modules/auth/guards";
import { getEditorialService } from "@/modules/content/container";
import { isValidSlug } from "@/modules/content/slug";

export const metadata: Metadata = { title: "History" };

const dateTime = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

export default function HistoryPage(props: PageProps<"/admin/articles/[slug]/history">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <History {...props} />
    </Suspense>
  );
}

async function History({ params, searchParams }: PageProps<"/admin/articles/[slug]/history">) {
  await requireAdminPage();
  const { slug } = await params;
  if (!isValidSlug(slug)) notFound();
  const query = await searchParams;
  const cursor = typeof query.cursor === "string" ? query.cursor : null;
  const selected = typeof query.commit === "string" && /^[0-9a-f]{40}$/.test(query.commit) ? query.commit : null;

  const service = getEditorialService();
  const back = (
    <Button asChild variant="outline" size="sm">
      <Link href={`/admin/articles/${slug}`}>
        <ArrowLeft /> Back to editor
      </Link>
    </Button>
  );

  if (!service.historySupported) {
    return (
      <>
        <AdminPageHeader title="Version history" description={slug} actions={back} />
        <div className="p-6">
          <p className="max-w-xl rounded-lg border bg-muted/40 p-4 text-sm">
            Version history comes from Git. It’s available when content is stored on GitHub (
            <code>CONTENT_SOURCE=github</code>); the local folder source has no history.
          </p>
        </div>
      </>
    );
  }

  const history = await service.getHistory(slug, cursor);
  if (history.commits.length === 0 && !cursor) notFound();
  const activeSha = selected ?? history.commits[0]?.sha ?? null;
  const revision = activeSha ? await service.getRevision(slug, activeSha) : null;
  const isCurrent = revision !== null && revision.content === revision.current;

  return (
    <>
      <AdminPageHeader
        title="Version history"
        description={`posts/${slug} · every change is a Git commit`}
        actions={back}
      />
      <div className="grid min-h-0 flex-1 gap-6 p-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <nav aria-label="Commits" className="flex flex-col gap-1">
          {history.commits.map((commit) => (
            <Link
              key={commit.sha}
              href={`?commit=${commit.sha}${cursor ? `&cursor=${cursor}` : ""}`}
              aria-current={commit.sha === activeSha ? "true" : undefined}
              className={cn(
                "flex gap-3 rounded-md border border-transparent p-2.5 text-sm transition-colors hover:bg-accent",
                commit.sha === activeSha && "border-border bg-accent",
              )}
            >
              <GitCommitHorizontal className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0">
                <span className="block truncate font-medium">{commit.subject}</span>
                <span className="block text-xs text-muted-foreground">
                  {commit.authorName} · {commit.date ? dateTime.format(Date.parse(commit.date)) : ""} UTC ·{" "}
                  <code>{commit.sha.slice(0, 7)}</code>
                </span>
              </span>
            </Link>
          ))}
          <div className="flex gap-2 pt-2">
            {cursor && (
              <Button asChild variant="ghost" size="sm">
                <Link href="?">Newest</Link>
              </Button>
            )}
            {history.nextCursor && (
              <Button asChild variant="ghost" size="sm">
                <Link href={`?cursor=${history.nextCursor}`}>Older →</Link>
              </Button>
            )}
          </div>
        </nav>

        <section aria-label="Selected version" className="flex min-w-0 flex-col gap-4">
          {revision && activeSha ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-semibold">
                  Version <code className="text-sm">{activeSha.slice(0, 7)}</code>
                  {isCurrent && <span className="ml-2 text-sm font-normal text-muted-foreground">(current)</span>}
                </h2>
                {history.commits.find((c) => c.sha === activeSha)?.url && (
                  <a
                    href={history.commits.find((c) => c.sha === activeSha)!.url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                  >
                    View on GitHub <ExternalLink className="size-3.5" />
                  </a>
                )}
                <div className="ml-auto">
                  {revision.content !== null && !isCurrent && (
                    <RestoreButton slug={slug} commitSha={activeSha} baseSha={revision.currentSha} />
                  )}
                </div>
              </div>
              {revision.content === null ? (
                <p className="text-sm text-muted-foreground">This article didn’t exist at that commit.</p>
              ) : (
                <DiffView
                  oldText={revision.current ?? ""}
                  newText={revision.content}
                  oldLabel={revision.current === null ? "deleted" : "current version"}
                  newLabel={`version ${activeSha.slice(0, 7)}`}
                />
              )}
              <p className="text-xs text-muted-foreground">
                Restoring commits this version as a new change. Nothing in the history is rewritten.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Select a commit.</p>
          )}
        </section>
      </div>
    </>
  );
}
