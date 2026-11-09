"use client";

import { ExternalLink, FileText, Images, LayoutDashboard, PenLine, Plus, Tags } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "Overview", Icon: LayoutDashboard, exact: true },
  { href: "/admin/articles", label: "Articles", Icon: FileText, exact: false },
  { href: "/admin/articles/new", label: "New article", Icon: Plus, exact: true },
  { href: "/admin/taxonomy", label: "Categories & tags", Icon: Tags, exact: true },
  { href: "/admin/media", label: "Media", Icon: Images, exact: true },
];

/**
 * The pathname is request data on dynamic routes, so the active highlight
 * streams in behind Suspense; the fallback is the same nav without it.
 */
export function AdminSidebarNav() {
  return (
    <Suspense fallback={<NavList pathname={null} />}>
      <ActiveNavList />
    </Suspense>
  );
}

function ActiveNavList() {
  return <NavList pathname={usePathname()} />;
}

function NavList({ pathname }: { pathname: string | null }) {
  const isActive = (href: string, exact: boolean) =>
    pathname !== null &&
    (exact
      ? pathname === href
      : pathname === href || (pathname.startsWith(`${href}/`) && pathname !== "/admin/articles/new"));
  return (
    <nav aria-label="Admin" className="flex gap-1 md:flex-col">
      {items.map(({ href, label, Icon, exact }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(href, exact) ? "page" : undefined}
          className={cn(
            "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-accent",
            isActive(href, exact) ? "bg-accent font-medium text-foreground" : "text-muted-foreground",
          )}
        >
          <Icon className="size-4" aria-hidden />
          <span className="max-md:sr-only">{label}</span>
        </Link>
      ))}
      <Link
        href="/"
        target="_blank"
        className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent"
      >
        <ExternalLink className="size-4" aria-hidden />
        <span className="max-md:sr-only">View site</span>
      </Link>
    </nav>
  );
}

export function AdminBrand() {
  return (
    <Link href="/admin" className="flex items-center gap-2 font-semibold tracking-tight">
      <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <PenLine className="size-4" aria-hidden />
      </span>
      <span className="max-md:sr-only">InkGit</span>
    </Link>
  );
}
