"use client";

import { LoaderCircle, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { renderPreviewAction, type PreviewResult } from "@/app/admin/actions";

const DEBOUNCE_MS = 400;

/**
 * Live preview rendered on the server by the production pipeline. Requests
 * are debounced and out-of-order responses are discarded.
 */
export function PreviewPane({ body, format }: { body: string; format: "md" | "mdx" }) {
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;
    const timer = setTimeout(() => {
      startTransition(async () => {
        try {
          const next = await renderPreviewAction({ body, format });
          if (id === requestId.current) setResult(next);
        } catch {
          if (id === requestId.current) setResult({ ok: false, message: "Preview failed to load." });
        }
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [body, format]);

  return (
    <div className="relative">
      {isPending && (
        <LoaderCircle
          className="absolute top-0 right-0 size-4 animate-spin text-muted-foreground"
          aria-label="Updating preview"
        />
      )}
      {result && !result.ok && (
        <div
          role="alert"
          className="mb-4 flex gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <p>
            {result.line ? `Line ${result.line}: ` : ""}
            {result.message}
          </p>
        </div>
      )}
      {result?.ok && result.warnings.length > 0 && (
        <ul className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300">
          {result.warnings.map((warning, index) => (
            <li key={index}>{warning}</li>
          ))}
        </ul>
      )}
      {result?.ok ? (
        <div className="prose-inkgit prose max-w-none prose-neutral dark:prose-invert">{result.content}</div>
      ) : !result ? (
        <p className="text-sm text-muted-foreground">Rendering preview…</p>
      ) : null}
    </div>
  );
}
