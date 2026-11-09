"use client";

import { useRef } from "react";
import { CopyButton } from "@/components/article/copy-button";

/** Replaces `<pre>` in rendered MDX to add a copy-to-clipboard button. */
export function CodeBlock(props: React.ComponentProps<"pre">) {
  const preRef = useRef<HTMLPreElement>(null);
  return (
    <div className="group/code relative">
      <pre ref={preRef} {...props} />
      <CopyButton
        getText={() => preRef.current?.querySelector("code")?.innerText ?? preRef.current?.innerText ?? ""}
        label="Copy code"
        className="absolute top-2 right-2 bg-background/80 opacity-0 backdrop-blur transition-opacity group-hover/code:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
      />
    </div>
  );
}
