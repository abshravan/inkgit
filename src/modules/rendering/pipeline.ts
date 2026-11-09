import "server-only";
import { compile } from "@mdx-js/mdx";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode, { type Options as PrettyCodeOptions } from "rehype-pretty-code";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { VFile } from "vfile";
import { rehypeCollectToc, type TocEntry } from "./rehype-collect-toc";
import { remarkSafeMdx } from "./remark-safe-mdx";

export type { TocEntry };

export interface CompiledContent {
  /** Function-body JavaScript produced by MDX, evaluated by `MdxContent`. */
  code: string;
  toc: TocEntry[];
  /** Sanitizer and compiler warnings, e.g. a removed `<script>`. */
  warnings: string[];
}

export class ContentRenderError extends Error {
  constructor(
    message: string,
    readonly line?: number,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "ContentRenderError";
  }
}

const prettyCodeOptions: PrettyCodeOptions = {
  // High-contrast light theme: github-light's orange tokens fail WCAG AA (≈3:1).
  theme: { light: "github-light-high-contrast", dark: "github-dark-dimmed" },
  keepBackground: false,
  defaultLang: { block: "plaintext", inline: "plaintext" },
};

/**
 * The single Markdown/MDX → JS pipeline used by the public site, previews,
 * and pre-publish validation, so what authors preview is exactly what ships.
 */
export async function compileContent(source: string, format: "md" | "mdx"): Promise<CompiledContent> {
  const file = new VFile({ value: source, path: `content.${format}` });
  try {
    const output = await compile(file, {
      format,
      outputFormat: "function-body",
      development: false,
      remarkPlugins: [remarkGfm, remarkSafeMdx],
      rehypePlugins: [
        rehypeSlug,
        rehypeCollectToc,
        [
          rehypeAutolinkHeadings,
          {
            behavior: "append",
            properties: { className: ["heading-anchor"], ariaHidden: "true", tabIndex: -1 },
            content: { type: "text", value: "#" },
          },
        ],
        [rehypePrettyCode, prettyCodeOptions],
      ],
    });
    return {
      code: String(output),
      toc: output.data.toc ?? [],
      warnings: output.messages.map((message) => message.reason),
    };
  } catch (error) {
    const place = (error as { place?: { line?: number; start?: { line?: number } } }).place;
    const line = place?.line ?? place?.start?.line;
    const reason = error instanceof Error ? error.message : String(error);
    throw new ContentRenderError(reason, line, { cause: error });
  }
}
