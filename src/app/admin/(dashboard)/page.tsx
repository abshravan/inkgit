import { CalendarClock, CircleAlert, FileCheck2, FilePen, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminPageHeader, PageSkeleton } from "@/components/admin/page-skeleton";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { requireAdminPage } from "@/modules/auth/guards";
import { describeContentSource, getEditorialService } from "@/modules/content/container";

export const metadata: Metadata = { title: "Overview" };

export default function OverviewPage() {
  return (
    <>
      <AdminPageHeader
        title="Overview"
        description="Your content at a glance."
        actions={
          <Button asChild size="sm">
            <Link href="/admin/articles/new">
              <Plus /> New article
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<PageSkeleton />}>
        <OverviewContent />
      </Suspense>
    </>
  );
}

async function OverviewContent() {
  await requireAdminPage();
  const { articles, globalIssues } = await getEditorialService().getOverview();
  const source = describeContentSource();
  const published = articles.filter((article) => article.status === "published");
  const drafts = articles.filter((article) => article.status === "draft");
  const scheduled = articles.filter((article) => article.status === "scheduled");
  const needsAttention = articles.filter((article) => article.issues.length > 0);
  const recent = [...articles]
    .filter((article) => article.status !== "invalid")
    .sort((a, b) => (b.updatedAt ?? b.date ?? "").localeCompare(a.updatedAt ?? a.date ?? ""))
    .slice(0, 6);

  const stats = [
    { label: "Published", value: published.length, Icon: FileCheck2, href: "/admin/articles?status=published" },
    { label: "Scheduled", value: scheduled.length, Icon: CalendarClock, href: "/admin/articles?status=scheduled" },
    { label: "Drafts", value: drafts.length, Icon: FilePen, href: "/admin/articles?status=draft" },
    {
      label: "Need attention",
      value: needsAttention.length + globalIssues.length,
      Icon: CircleAlert,
      href: "/admin/articles?status=attention",
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <p className="text-sm text-muted-foreground">
        Content source:{" "}
        {source.url ? (
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-foreground hover:underline"
          >
            {source.label}
          </a>
        ) : (
          <span className="font-mono text-foreground">{source.label}</span>
        )}
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, Icon, href }) => (
          <Link
            key={label}
            href={href}
            className="rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Card className="gap-2 py-5 transition-colors hover:border-foreground/20">
              <CardHeader className="flex flex-row items-center justify-between px-5">
                <CardDescription>{label}</CardDescription>
                <Icon className="size-4 text-muted-foreground" aria-hidden />
              </CardHeader>
              <CardContent className="px-5 text-3xl font-semibold tabular-nums">{value}</CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recently updated</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length ? (
              <ul className="divide-y">
                {recent.map((article) => (
                  <li key={article.path} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <Link
                        href={`/admin/articles/${article.slug}`}
                        className="block truncate font-medium hover:underline"
                      >
                        {article.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(article.updatedAt ?? article.date ?? "")}
                      </p>
                    </div>
                    <StatusBadge status={article.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No articles yet. Create your first one.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Content health</CardTitle>
            <CardDescription>
              Problems found while reading the repository. Invalid files are hidden from the public site.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {needsAttention.length === 0 && globalIssues.length === 0 ? (
              <p className="text-sm text-muted-foreground">Everything looks good.</p>
            ) : (
              <ul className="flex flex-col gap-3 text-sm">
                {globalIssues.map((issue, index) => (
                  <li key={`global-${index}`} className="rounded-md border p-3">
                    <p className="font-mono text-xs">{issue.path}</p>
                    <p
                      className={issue.severity === "error" ? "text-destructive" : "text-amber-700 dark:text-amber-400"}
                    >
                      {issue.message}
                    </p>
                  </li>
                ))}
                {needsAttention.map((article) => (
                  <li key={article.path} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/admin/articles/${article.slug}`} className="font-mono text-xs hover:underline">
                        {article.path}
                      </Link>
                      <StatusBadge status={article.status} />
                    </div>
                    <ul className="mt-1 list-disc pl-5">
                      {article.issues.map((issue, index) => (
                        <li
                          key={index}
                          className={
                            issue.severity === "error" ? "text-destructive" : "text-amber-700 dark:text-amber-400"
                          }
                        >
                          {issue.message}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
