import { EditorSelection, type EditorState, type TransactionSpec } from "@codemirror/state";

/**
 * Formatting commands as pure functions of editor state → transaction, so
 * they're unit-testable without a DOM. Every command supports multiple
 * selections and toggles off when the formatting is already present.
 */
export type MarkdownCommand = (state: EditorState) => TransactionSpec;

/** Wraps or unwraps each selection with an inline marker (`**`, `_`, `` ` ``). */
export function toggleInline(marker: string, placeholder = "text"): MarkdownCommand {
  return (state) =>
    state.changeByRange((range) => {
      const before = state.sliceDoc(range.from - marker.length, range.from);
      const after = state.sliceDoc(range.to, range.to + marker.length);
      if (before === marker && after === marker) {
        return {
          changes: [
            { from: range.from - marker.length, to: range.from, insert: "" },
            { from: range.to, to: range.to + marker.length, insert: "" },
          ],
          range: EditorSelection.range(range.from - marker.length, range.to - marker.length),
        };
      }
      const text = range.empty ? placeholder : state.sliceDoc(range.from, range.to);
      return {
        changes: { from: range.from, to: range.to, insert: `${marker}${text}${marker}` },
        range: EditorSelection.range(range.from + marker.length, range.from + marker.length + text.length),
      };
    });
}

const HEADING_PREFIX = /^#{1,6}\s+/;
const LIST_PREFIX = /^(\s*)([-*+]|\d+[.)])\s+/;

function selectedLines(state: EditorState, from: number, to: number) {
  const lines = [];
  for (let pos = state.doc.lineAt(from).number; pos <= state.doc.lineAt(to).number; pos++) {
    lines.push(state.doc.line(pos));
  }
  return lines;
}

/**
 * Toggles a line prefix (`> `, `- `, `1. `, `## `) on every selected line.
 * Headings replace an existing heading level instead of stacking.
 */
export function toggleLinePrefix(kind: "quote" | "bullet" | "ordered" | { heading: 1 | 2 | 3 }): MarkdownCommand {
  return (state) => {
    const ranges = state.selection.ranges;
    const lineNumbers = new Set<number>();
    const lines = ranges
      .flatMap((range) => selectedLines(state, range.from, range.to))
      .filter((line) => (lineNumbers.has(line.number) ? false : (lineNumbers.add(line.number), true)));

    const prefixFor = (index: number) =>
      kind === "quote"
        ? "> "
        : kind === "bullet"
          ? "- "
          : kind === "ordered"
            ? `${index + 1}. `
            : `${"#".repeat(kind.heading)} `;
    const existing = (): RegExp =>
      kind === "quote" ? /^>\s?/ : kind === "bullet" || kind === "ordered" ? LIST_PREFIX : HEADING_PREFIX;
    const hasSamePrefix = (text: string, index: number) =>
      kind === "ordered"
        ? /^\s*\d+[.)]\s+/.test(text)
        : kind === "bullet"
          ? /^\s*[-*+]\s+/.test(text)
          : kind === "quote"
            ? /^>/.test(text)
            : text.startsWith(prefixFor(index));

    const removeAll = lines.every((line, index) => hasSamePrefix(line.text, index));
    const changeSet = state.changes(
      lines.map((line, index) => {
        const match = existing().exec(line.text);
        const currentLength = match ? match[0].length : 0;
        return { from: line.from, to: line.from + currentLength, insert: removeAll ? "" : prefixFor(index) };
      }),
    );
    const first = lines[0];
    const last = lines.at(-1);
    // Keep the edited lines selected so the command can be toggled again.
    const selection =
      ranges.length === 1 && first && last
        ? EditorSelection.single(changeSet.mapPos(first.from, -1), changeSet.mapPos(last.to, 1))
        : state.selection.map(changeSet);
    return { changes: changeSet, selection };
  };
}

/** `[text](url)` with the URL placeholder selected for quick replacement. */
export function insertLink(image = false): MarkdownCommand {
  return (state) =>
    state.changeByRange((range) => {
      const label = range.empty ? (image ? "alt text" : "link text") : state.sliceDoc(range.from, range.to);
      const prefix = `${image ? "!" : ""}[${label}](`;
      const url = "https://";
      return {
        changes: { from: range.from, to: range.to, insert: `${prefix}${url})` },
        range: EditorSelection.range(range.from + prefix.length, range.from + prefix.length + url.length),
      };
    });
}

function blockInsertion(state: EditorState, at: number, block: string) {
  const line = state.doc.lineAt(at);
  const needsLeadingBreak = line.text.trim().length > 0;
  const before = needsLeadingBreak
    ? "\n\n"
    : line.number > 1 && state.doc.line(line.number - 1).text.trim()
      ? "\n"
      : "";
  return { insert: `${before}${block}\n`, offset: before.length };
}

/** Fenced code block around the selection (or a placeholder), language selected. */
export function insertCodeBlock(): MarkdownCommand {
  return (state) =>
    state.changeByRange((range) => {
      const code = range.empty ? "code" : state.sliceDoc(range.from, range.to);
      const lang = "ts";
      if (!range.empty) {
        const insert = `\`\`\`${lang}\n${code}\n\`\`\``;
        return {
          changes: { from: range.from, to: range.to, insert },
          range: EditorSelection.range(range.from + 3, range.from + 3 + lang.length),
        };
      }
      const { insert, offset } = blockInsertion(state, range.from, `\`\`\`${lang}\n${code}\n\`\`\``);
      const at = state.doc.lineAt(range.from).text.trim() ? state.doc.lineAt(range.from).to : range.from;
      return {
        changes: { from: at, insert },
        range: EditorSelection.range(at + offset + 3, at + offset + 3 + lang.length),
      };
    });
}

export function insertTable(): MarkdownCommand {
  const table = "| Column | Column |\n| ------ | ------ |\n| Cell   | Cell   |";
  return (state) => {
    const head = state.selection.main.head;
    const line = state.doc.lineAt(head);
    const at = line.text.trim() ? line.to : head;
    const { insert, offset } = blockInsertion(state, head, table);
    return {
      changes: { from: at, insert },
      selection: EditorSelection.range(at + offset + 2, at + offset + 8),
    };
  };
}
