import { TriangleAlert } from "lucide-react";
import { cacheLife } from "next/cache";
import { MdxContent } from "@/components/mdx/mdx-content";
import { compileContent, ContentRenderError, type CompiledContent } from "@/modules/rendering/pipeline";

export type CompileOutcome = { ok: true; compiled: CompiledContent } | { ok: false; message: string };

/**
 * Compiles content without throwing: a malformed article renders a notice
 * instead of breaking the page (and the build).
 *
 * Cached for the maximum lifetime because the result is a pure function of
 * its inputs — new content means a new cache key.
 */
export async function compileSafely(source: string, format: "md" | "mdx", path: string): Promise<CompileOutcome> {
  "use cache";
  cacheLife("max");
  try {
    const compiled = await compileContent(source, format);
    for (const warning of compiled.warnings) console.warn(`[inkgit:render] ${path}: ${warning}`);
    return { ok: true, compiled };
  } catch (error) {
    const message = error instanceof ContentRenderError ? error.message : "Unknown rendering error";
    console.error(`[inkgit:render] ${path}: ${message}`);
    return { ok: false, message };
  }
}

export function ArticleBody({ outcome }: { outcome: CompileOutcome }) {
  if (!outcome.ok) {
    return (
      <div
        role="alert"
        className="not-prose flex gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm"
      >
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
        <p>This content could not be rendered. The author has been notified in the build logs.</p>
      </div>
    );
  }
  return <MdxContent code={outcome.compiled.code} />;
}
