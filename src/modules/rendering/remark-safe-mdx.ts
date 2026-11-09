import type { Root } from "mdast";
import type { Plugin } from "unified";
import { SKIP, visit } from "unist-util-visit";
import type { VFile } from "vfile";
import { isSafeUrl } from "./url-safety";

/**
 * "Safe MDX": MDX compiles to JavaScript, so content from a repository must
 * not be able to run code. This plugin, which runs before compilation:
 *
 * - removes `import`/`export` statements and `{expressions}`,
 * - keeps only allowlisted JSX components and HTML tags (others are unwrapped
 *   to their children; dangerous tags are dropped with their contents),
 * - removes event handlers, `style`, expression and spread attributes,
 * - drops links/images with unsafe URL schemes.
 *
 * Every removal is reported as a vfile warning so authors can see it.
 */

export const ALLOWED_COMPONENTS = new Set(["Callout"]);

const ALLOWED_HTML_TAGS = new Set([
  "a",
  "abbr",
  "b",
  "blockquote",
  "br",
  "caption",
  "cite",
  "code",
  "dd",
  "del",
  "details",
  "dfn",
  "div",
  "dl",
  "dt",
  "em",
  "figcaption",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "ins",
  "kbd",
  "li",
  "mark",
  "ol",
  "p",
  "picture",
  "pre",
  "q",
  "s",
  "samp",
  "small",
  "source",
  "span",
  "strong",
  "sub",
  "summary",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "time",
  "tr",
  "u",
  "ul",
  "var",
  "video",
]);

/** Removed together with their children: their contents are never prose. */
const DROPPED_TAGS = new Set([
  "script",
  "style",
  "iframe",
  "frame",
  "frameset",
  "object",
  "embed",
  "applet",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "option",
  "link",
  "meta",
  "base",
  "noscript",
  "template",
  "svg",
  "math",
]);

const URL_ATTRIBUTES = new Set(["href", "src", "srcset", "poster", "cite", "action", "formaction", "xlink:href"]);
const BLOCKED_ATTRIBUTES = new Set(["style", "srcdoc", "dangerouslysetinnerhtml", "ref", "key", "is"]);

interface JsxAttribute {
  type: "mdxJsxAttribute" | "mdxJsxExpressionAttribute";
  name?: string;
  value?: string | null | { type: string };
}

interface JsxElementLike {
  type: "mdxJsxFlowElement" | "mdxJsxTextElement";
  name: string | null;
  attributes: JsxAttribute[];
  children: Root["children"];
}

type AnyNode = { type: string; children?: AnyNode[]; url?: string };

/**
 * unist-util-visit's generic types can't express "any MDX node" across both
 * mdast and the MDX extensions, so walk with a deliberately loose node shape.
 */
type LooseVisitor = (
  node: AnyNode,
  index: number | undefined,
  parent: AnyNode | undefined,
) => void | [typeof SKIP, number];
const walk = visit as unknown as (tree: AnyNode, visitor: LooseVisitor) => void;

const REMOVED_NODE_TYPES: Record<string, string> = {
  mdxjsEsm: "import/export statements are not allowed and were removed",
  mdxFlowExpression: "JavaScript expressions are not allowed and were removed",
  mdxTextExpression: "JavaScript expressions are not allowed and were removed",
};

export const remarkSafeMdx: Plugin<[], Root> = () => (tree: Root, file: VFile) => {
  walk(tree as unknown as AnyNode, (node, index, parent) => {
    if (!parent || index === undefined || !parent.children) return;

    const removalReason = REMOVED_NODE_TYPES[node.type];
    if (removalReason) {
      file.message(removalReason, { place: positionOf(node) });
      parent.children.splice(index, 1);
      return [SKIP, index];
    }

    if (node.type === "link" || node.type === "image" || node.type === "definition") {
      if (node.url !== undefined && !isSafeUrl(node.url)) {
        file.message(`Unsafe URL removed: ${node.url.slice(0, 80)}`, { place: positionOf(node) });
        node.url = "#";
      }
      return;
    }

    if (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") {
      const element = node as unknown as JsxElementLike;
      const name = element.name;
      if (name === null) return; // fragment: children are still visited

      const lower = name.toLowerCase();
      if (DROPPED_TAGS.has(lower)) {
        file.message(`<${name}> is not allowed and was removed`, { place: positionOf(node) });
        parent.children.splice(index, 1);
        return [SKIP, index];
      }
      const isAllowed = ALLOWED_COMPONENTS.has(name) || (name === lower && ALLOWED_HTML_TAGS.has(name));
      if (!isAllowed) {
        file.message(`<${name}> is not an allowed component; its content was kept`, { place: positionOf(node) });
        parent.children.splice(index, 1, ...((element.children as unknown as AnyNode[]) ?? []));
        return [SKIP, index];
      }
      element.attributes = sanitizeAttributes(element.attributes, name, file, node);
    }
    return undefined;
  });
};

function sanitizeAttributes(
  attributes: JsxAttribute[],
  elementName: string,
  file: VFile,
  node: AnyNode,
): JsxAttribute[] {
  const kept: JsxAttribute[] = [];
  for (const attribute of attributes) {
    const name = attribute.name;
    const reject = (reason: string) => file.message(`<${elementName}> ${reason}`, { place: positionOf(node) });
    if (attribute.type !== "mdxJsxAttribute" || !name) {
      reject("spread attributes are not allowed");
      continue;
    }
    const lower = name.toLowerCase();
    if (lower.startsWith("on") || BLOCKED_ATTRIBUTES.has(lower)) {
      reject(`attribute "${name}" is not allowed`);
      continue;
    }
    if (attribute.value !== null && attribute.value !== undefined && typeof attribute.value !== "string") {
      reject(`attribute "${name}" uses an expression, which is not allowed`);
      continue;
    }
    if (URL_ATTRIBUTES.has(lower) && typeof attribute.value === "string" && !isSafeUrl(attribute.value)) {
      reject(`attribute "${name}" has an unsafe URL`);
      continue;
    }
    // Authors often paste HTML: map `class`/`for` to their React names.
    const reactName = lower === "class" ? "className" : lower === "for" ? "htmlFor" : name;
    kept.push({ ...attribute, name: reactName });
  }
  return kept;
}

function positionOf(node: AnyNode) {
  return (node as { position?: import("unist").Position }).position;
}
