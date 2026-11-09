import type { Element, Root } from "hast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";

export interface TocEntry {
  id: string;
  text: string;
  depth: 2 | 3;
}

declare module "vfile" {
  interface DataMap {
    toc: TocEntry[];
  }
}

function textOf(node: Element | Root): string {
  let text = "";
  visit(node, "text", (child) => {
    text += child.value;
  });
  return text.trim();
}

/**
 * Collects h2/h3 headings into `file.data.toc`. Must run after `rehype-slug`
 * (so ids exist) and before autolinking (so anchor glyphs aren't included).
 */
export const rehypeCollectToc: Plugin<[], Root> = () => (tree: Root, file: VFile) => {
  const toc: TocEntry[] = [];
  visit(tree, "element", (node) => {
    if (node.tagName !== "h2" && node.tagName !== "h3") return;
    const id = node.properties?.id;
    const text = textOf(node);
    if (typeof id === "string" && text) toc.push({ id, text, depth: node.tagName === "h2" ? 2 : 3 });
  });
  file.data.toc = toc;
};
