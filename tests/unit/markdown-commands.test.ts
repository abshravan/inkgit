import { EditorSelection, EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import {
  insertCodeBlock,
  insertLink,
  insertTable,
  toggleInline,
  toggleLinePrefix,
  type MarkdownCommand,
} from "@/components/admin/editor/markdown-commands";

/** Applies a command; `[` and `]` in the input mark the selection. */
function run(input: string, command: MarkdownCommand) {
  const from = input.indexOf("[");
  const to = input.indexOf("]") - 1;
  const doc = input.replace("[", "").replace("]", "");
  const state = EditorState.create({
    doc,
    selection: EditorSelection.single(from, to),
    extensions: [EditorState.allowMultipleSelections.of(true)],
  });
  const next = state.update(command(state)).state;
  const { from: f, to: t } = next.selection.main;
  const text = next.doc.toString();
  return `${text.slice(0, f)}[${text.slice(f, t)}]${text.slice(t)}`;
}

describe("markdown commands", () => {
  it("wraps and unwraps inline formatting", () => {
    expect(run("say [hello] now", toggleInline("**"))).toBe("say **[hello]** now");
    expect(run("say **[hello]** now", toggleInline("**"))).toBe("say [hello] now");
    expect(run("x[]", toggleInline("_"))).toBe("x_[text]_");
  });

  it("toggles line prefixes across a multi-line selection", () => {
    expect(run("[a\nb]", toggleLinePrefix("bullet"))).toBe("[- a\n- b]");
    expect(run("[- a\n- b]", toggleLinePrefix("bullet"))).toBe("[a\nb]");
    expect(run("[a\nb]", toggleLinePrefix("ordered"))).toBe("[1. a\n2. b]");
    expect(run("[a]", toggleLinePrefix("quote"))).toBe("[> a]");
  });

  it("replaces heading levels instead of stacking them", () => {
    expect(run("[Title]", toggleLinePrefix({ heading: 2 }))).toBe("[## Title]");
    expect(run("## [Title]", toggleLinePrefix({ heading: 3 }))).toBe("[### Title]");
    expect(run("[## Title]", toggleLinePrefix({ heading: 2 }))).toBe("[Title]");
  });

  it("inserts links and images with the URL selected", () => {
    expect(run("see [docs]", insertLink())).toBe("see [docs]([https://])");
    expect(run("[]", insertLink(true))).toBe("![alt text]([https://])");
  });

  it("fences code and inserts tables as separate blocks", () => {
    expect(run("[let a = 1]", insertCodeBlock())).toBe("```[ts]\nlet a = 1\n```");
    expect(run("Intro[]", insertCodeBlock())).toBe("Intro\n\n```[ts]\ncode\n```\n");
    expect(run("Intro[]", insertTable())).toContain("Intro\n\n| [Column] | Column |");
  });
});
