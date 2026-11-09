"use client";

/**
 * An inline script that runs during HTML parsing (server render) but is inert
 * when React renders it in the browser (e.g. when an error/not-found boundary
 * re-renders the root layout). Avoids React's "script tag while rendering"
 * warning; the type mismatch is expected and suppressed. Pattern from the
 * Next.js guide "Preventing flash before hydration".
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
