"use client";

import { Button } from "@/components/ui/button";

/** Last-resort boundary if rendered MDX throws at runtime (compile errors are handled earlier). */
export default function ArticleError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="text-xl font-semibold">This article failed to load</h1>
      <p className="text-sm text-muted-foreground">Something went wrong while rendering it.</p>
      <Button variant="outline" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
