"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/utils";

/**
 * On dynamic routes the pathname is request data, so the active state streams
 * in behind Suspense; the fallback renders the same link without it.
 */
export function NavLink(props: { href: string; children: React.ReactNode }) {
  return (
    <Suspense fallback={<NavLinkView {...props} active={false} />}>
      <ActiveNavLink {...props} />
    </Suspense>
  );
}

function ActiveNavLink(props: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  return <NavLinkView {...props} active={pathname === props.href || pathname.startsWith(`${props.href}/`)} />;
}

function NavLinkView({ href, children, active }: { href: string; children: React.ReactNode; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-md px-2 py-1.5 text-sm whitespace-nowrap transition-colors hover:text-foreground sm:px-3",
        active ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {children}
    </Link>
  );
}
