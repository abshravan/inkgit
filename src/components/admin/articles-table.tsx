"use client";

import { Eye, Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import type { AdminArticleSummary } from "@/modules/publishing/types";
import { StatusBadge } from "./status-badge";

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "scheduled", label: "Scheduled" },
  { value: "draft", label: "Drafts" },
  { value: "attention", label: "Needs attention" },
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number]["value"];

const isStatusFilter = (value: string | null): value is StatusFilter => STATUS_FILTERS.some((f) => f.value === value);

export function ArticlesTable({ articles, categories }: { articles: AdminArticleSummary[]; categories: string[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const initialStatus = params.get("status");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>(isStatusFilter(initialStatus) ? initialStatus : "all");
  const [category, setCategory] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return articles
      .filter((article) =>
        status === "all" ? true : status === "attention" ? article.issues.length > 0 : article.status === status,
      )
      .filter((article) => !category || article.categories.includes(category))
      .filter(
        (article) =>
          !needle ||
          article.title.toLowerCase().includes(needle) ||
          article.slug.includes(needle) ||
          article.tags.some((tag) => tag.toLowerCase().includes(needle)),
      )
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  }, [articles, query, status, category]);

  const setStatusFilter = (value: StatusFilter) => {
    setStatus(value);
    const next = new URLSearchParams(params);
    if (value === "all") next.delete("status");
    else next.set("status", value);
    router.replace(`?${next.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Search title, slug or tag"
            aria-label="Search articles"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-0.5 rounded-md border p-0.5" role="group" aria-label="Filter by status">
          {STATUS_FILTERS.map((filter) => (
            <Button
              key={filter.value}
              size="sm"
              variant={status === filter.value ? "secondary" : "ghost"}
              className="h-7 px-2.5"
              aria-pressed={status === filter.value}
              onClick={() => setStatusFilter(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </div>
        {categories.length > 0 && (
          <select
            aria-label="Filter by category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30"
          >
            <option value="">All categories</option>
            {categories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}
        <span className="ml-auto text-sm text-muted-foreground tabular-nums">
          {filtered.length} of {articles.length}
        </span>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Categories</TableHead>
              <TableHead className="hidden lg:table-cell">Tags</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="hidden sm:table-cell">Words</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                  {articles.length === 0 ? "No articles yet." : "No articles match these filters."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((article) => (
                <TableRow key={article.path}>
                  <TableCell className="max-w-[22rem] pl-4 whitespace-normal">
                    <Link href={`/admin/articles/${article.slug}`} className="font-medium hover:underline">
                      {article.title}
                    </Link>
                    <p className="font-mono text-xs text-muted-foreground">{article.slug}</p>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={article.status} />
                    {article.issues.length > 0 && article.status !== "invalid" && (
                      <span
                        className="ml-2 text-xs text-amber-700 dark:text-amber-400"
                        title={article.issues.map((i) => i.message).join("\n")}
                      >
                        {article.issues.length} warning{article.issues.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {article.categories.join(", ") || "—"}
                  </TableCell>
                  <TableCell className="hidden max-w-[14rem] truncate text-muted-foreground lg:table-cell">
                    {article.tags.join(", ") || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {article.date ? formatDate(article.date) : "—"}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground tabular-nums sm:table-cell">
                    {article.wordCount?.toLocaleString() ?? "—"}
                  </TableCell>
                  <TableCell>
                    {article.status !== "invalid" && (
                      <Button asChild variant="ghost" size="icon-sm" aria-label={`Preview ${article.title}`}>
                        <Link
                          href={
                            article.status === "published" ? `/blog/${article.slug}` : `/admin/preview/${article.slug}`
                          }
                          target="_blank"
                        >
                          <Eye />
                        </Link>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
