"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { TocEntry } from "@/modules/rendering/rehype-collect-toc";

/** Highlights the heading currently in view using IntersectionObserver (no scroll handlers). */
function useActiveHeading(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const elements = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => el !== null);
    if (!elements.length) return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const first = ids.find((id) => visible.has(id));
        if (first) setActive(first);
      },
      { rootMargin: "-80px 0px -65% 0px" },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ids]);
  return active;
}

export function TableOfContents({ entries }: { entries: TocEntry[] }) {
  const active = useActiveHeading(entries.map((entry) => entry.id));
  if (entries.length < 2) return null;
  return (
    <nav aria-label="Table of contents" className="text-sm">
      <p className="mb-3 font-medium">On this page</p>
      <ul className="flex flex-col gap-2 border-l">
        {entries.map((entry) => (
          <li key={entry.id}>
            <a
              href={`#${entry.id}`}
              aria-current={active === entry.id ? "location" : undefined}
              className={cn(
                "-ml-px block border-l border-transparent pl-3 leading-snug text-muted-foreground transition-colors hover:text-foreground",
                entry.depth === 3 && "pl-6",
                active === entry.id && "border-foreground text-foreground",
              )}
            >
              {entry.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
