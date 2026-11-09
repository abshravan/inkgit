import "server-only";
import { run } from "@mdx-js/mdx";
import type { MDXComponents } from "mdx/types";
import * as runtime from "react/jsx-runtime";
import { mdxComponents } from "./mdx-components";

/**
 * Evaluates compiled MDX on the server. The code is produced by our own
 * pipeline with imports/expressions stripped (see remark-safe-mdx), and only
 * the allowlisted `mdxComponents` are in scope.
 */
export async function MdxContent({ code, components }: { code: string; components?: MDXComponents }) {
  const { default: Content } = await run(code, { ...runtime, baseUrl: import.meta.url });
  return <Content components={{ ...mdxComponents, ...components }} />;
}
