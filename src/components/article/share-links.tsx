"use client";

import { LinkedInIcon, XIcon } from "@/components/site/brand-icons";
import { CopyButton } from "./copy-button";

const linkClass =
  "flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

export function ShareLinks({ url, title }: { url: string; title: string }) {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  return (
    <div className="flex items-center gap-1">
      <span className="mr-1 text-sm text-muted-foreground">Share</span>
      <a
        className={linkClass}
        href={`https://x.com/intent/post?url=${encodedUrl}&text=${encodedTitle}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on X"
      >
        <XIcon className="size-4" />
      </a>
      <a
        className={linkClass}
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on LinkedIn"
      >
        <LinkedInIcon className="size-4" />
      </a>
      <CopyButton getText={() => url} label="Copy link" />
    </div>
  );
}
