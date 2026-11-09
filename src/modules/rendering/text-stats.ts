/**
 * Isomorphic text statistics (safe for client and server) so the editor's
 * live counters match what the public site shows.
 */

const FENCED_CODE = /^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[ \t]*$/gm;
const INLINE_CODE = /`[^`\n]*`/g;
const IMAGE = /!\[([^\]]*)\]\([^)]*\)/g;
const LINK = /\[([^\]]*)\]\([^)]*\)/g;
const HTML_OR_JSX_TAG = /<\/?[A-Za-z][^>]*>/g;
const MDX_ESM_LINE = /^(import|export)\s.*$/gm;
/** Emphasis markers wrap words, so they are removed without adding whitespace. */
// Underscores only count as emphasis outside words, so snake_case survives.
const EMPHASIS_MARKERS = /(\*{1,3}|~~)(?=\S)|(?<=\S)(\*{1,3}|~~)|(?<!\w)_{1,3}(?=\S)|(?<=\S)_{1,3}(?!\w)/g;
const MARKDOWN_SYMBOLS = /(^|\s)[#>*|\-=]+(?=\s|$)|\|/g;

/** Removes Markdown/MDX syntax, keeping readable prose. */
export function toPlainText(markdown: string): string {
  return markdown
    .replace(FENCED_CODE, " ")
    .replace(MDX_ESM_LINE, " ")
    .replace(IMAGE, "$1")
    .replace(LINK, "$1")
    .replace(INLINE_CODE, (code) => code.slice(1, -1))
    .replace(HTML_OR_JSX_TAG, " ")
    .replace(EMPHASIS_MARKERS, "")
    .replace(MARKDOWN_SYMBOLS, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function countWords(markdown: string): number {
  const text = toPlainText(markdown);
  if (!text) return 0;
  return text.split(" ").filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

/** Counts code blocks separately: readers skim code at roughly a third of prose speed. */
function countCodeWords(markdown: string): number {
  const blocks = markdown.match(FENCED_CODE) ?? [];
  return blocks.reduce((total, block) => total + block.split(/\s+/).filter(Boolean).length, 0);
}

export function estimateReadingTime(markdown: string, wordsPerMinute: number): number {
  const proseMinutes = countWords(markdown) / wordsPerMinute;
  const codeMinutes = countCodeWords(markdown) / (wordsPerMinute * 3);
  return Math.max(1, Math.round(proseMinutes + codeMinutes));
}

export function createExcerpt(markdown: string, maxLength = 200): string {
  const firstParagraph =
    markdown
      .replace(FENCED_CODE, "")
      .split(/\n\s*\n/)
      .map((block) => block.trim())
      .find(
        (block) => block && !block.startsWith("#") && !block.startsWith("<") && !/^(import|export)\s/.test(block),
      ) ?? "";
  const text = toPlainText(firstParagraph);
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), maxLength * 0.6)).trimEnd()}…`;
}
