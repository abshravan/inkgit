import { PenLine, Search } from "lucide-react";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { Container } from "./container";
import { NavLink } from "./nav-link";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Container className="flex h-14 items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <PenLine className="size-4" aria-hidden />
          </span>
          {siteConfig.name}
        </Link>
        <div className="flex min-w-0 items-center gap-1">
          <nav aria-label="Main" className="flex min-w-0 items-center overflow-x-auto">
            {siteConfig.nav.map((item) => (
              <NavLink key={item.href} href={item.href}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <Link
            href="/search"
            aria-label="Search"
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Search className="size-4" />
          </Link>
          <ThemeToggle />
        </div>
      </Container>
    </header>
  );
}
