import { describe, expect, it } from "vitest";
import { buildLineDiff } from "@/lib/diff";

describe("buildLineDiff", () => {
  it("reports added and removed lines with line numbers", () => {
    const { rows, added, removed } = buildLineDiff("a\nb\nc\n", "a\nB\nc\n");
    expect({ added, removed }).toEqual({ added: 1, removed: 1 });
    expect(rows).toEqual([
      { kind: "context", text: "a", oldLine: 1, newLine: 1 },
      { kind: "removed", text: "b", oldLine: 2, newLine: null },
      { kind: "added", text: "B", oldLine: null, newLine: 2 },
      { kind: "context", text: "c", oldLine: 3, newLine: 3 },
    ]);
  });

  it("collapses long unchanged runs but keeps context around changes", () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`);
    const changed = [...lines];
    changed[10] = "CHANGED";
    const { rows } = buildLineDiff(`${lines.join("\n")}\n`, `${changed.join("\n")}\n`, 2);
    expect(rows[0]).toEqual({ kind: "skip", count: 8 });
    expect(rows.filter((r) => r.kind === "context")).toHaveLength(4);
    expect(rows.at(-1)).toEqual({ kind: "skip", count: 7 });
  });

  it("handles identical and empty inputs", () => {
    expect(buildLineDiff("same\n", "same\n")).toMatchObject({ added: 0, removed: 0 });
    expect(buildLineDiff("", "new\n")).toMatchObject({ added: 1, removed: 0 });
  });
});
