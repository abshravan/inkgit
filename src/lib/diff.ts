import { diffLines } from "diff";

export type DiffRow =
  | { kind: "context" | "added" | "removed"; text: string; oldLine: number | null; newLine: number | null }
  | { kind: "skip"; count: number };

export interface DiffSummary {
  rows: DiffRow[];
  added: number;
  removed: number;
}

/**
 * Line diff for display. Unchanged runs longer than `2 × context` lines are
 * collapsed into a "skip" row, like `git diff`.
 */
export function buildLineDiff(oldText: string, newText: string, context = 3): DiffSummary {
  const parts = diffLines(oldText, newText);
  const all: Array<Exclude<DiffRow, { kind: "skip" }>> = [];
  let oldLine = 1;
  let newLine = 1;
  let added = 0;
  let removed = 0;
  for (const part of parts) {
    if (!part.value) continue;
    const lines = part.value.replace(/\n$/, "").split("\n");
    for (const text of lines) {
      if (part.added) {
        all.push({ kind: "added", text, oldLine: null, newLine: newLine++ });
        added++;
      } else if (part.removed) {
        all.push({ kind: "removed", text, oldLine: oldLine++, newLine: null });
        removed++;
      } else {
        all.push({ kind: "context", text, oldLine: oldLine++, newLine: newLine++ });
      }
    }
  }

  const rows: DiffRow[] = [];
  const changed = all.map((row) => row.kind !== "context");
  let index = 0;
  while (index < all.length) {
    if (changed[index]) {
      rows.push(all[index]!);
      index++;
      continue;
    }
    let end = index;
    while (end < all.length && !changed[end]) end++;
    const run = all.slice(index, end);
    const keepStart = index === 0 ? 0 : context;
    const keepEnd = end === all.length ? 0 : context;
    if (run.length > keepStart + keepEnd + 1) {
      rows.push(
        ...run.slice(0, keepStart),
        { kind: "skip", count: run.length - keepStart - keepEnd },
        ...run.slice(run.length - keepEnd),
      );
    } else {
      rows.push(...run);
    }
    index = end;
  }
  return { rows, added, removed };
}
