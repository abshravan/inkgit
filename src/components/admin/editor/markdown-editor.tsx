"use client";

import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, placeholder as placeholderExtension } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { insertLink, toggleInline, type MarkdownCommand } from "./markdown-commands";

export interface MarkdownEditorHandle {
  run(command: MarkdownCommand): void;
  setValue(value: string): void;
  focus(): void;
}

/** Colors come from the site's CSS variables so the editor follows light/dark themes. */
const theme = EditorView.theme({
  "&": { fontSize: "0.9rem", backgroundColor: "transparent", color: "var(--foreground)", height: "100%" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.7", padding: "1rem 0" },
  ".cm-content": { caretColor: "var(--foreground)", padding: "0 1rem", maxWidth: "48rem" },
  ".cm-cursor": { borderLeftColor: "var(--foreground)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "color-mix(in oklch, var(--brand) 25%, transparent) !important",
  },
  ".cm-activeLine": { backgroundColor: "transparent" },
  ".cm-placeholder": { color: "var(--muted-foreground)" },
  ".cm-selectionMatch": { backgroundColor: "color-mix(in oklch, var(--brand) 12%, transparent)" },
  ".cm-panels": { backgroundColor: "var(--muted)", color: "var(--foreground)", borderColor: "var(--border)" },
});

const highlight = HighlightStyle.define([
  { tag: tags.heading1, fontWeight: "700", fontSize: "1.25em" },
  { tag: tags.heading2, fontWeight: "700", fontSize: "1.12em" },
  { tag: [tags.heading3, tags.heading4, tags.heading5, tags.heading6], fontWeight: "700" },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: [tags.link, tags.url], color: "var(--brand)" },
  { tag: [tags.monospace, tags.processingInstruction], color: "var(--muted-foreground)" },
  { tag: [tags.quote], color: "var(--muted-foreground)", fontStyle: "italic" },
  { tag: [tags.keyword, tags.tagName], color: "oklch(0.55 0.18 300)" },
  { tag: [tags.string, tags.attributeValue], color: "oklch(0.55 0.13 150)" },
  { tag: [tags.comment, tags.meta, tags.contentSeparator], color: "var(--muted-foreground)" },
]);

export function MarkdownEditor({
  initialValue,
  onChange,
  onSave,
  onFiles,
  ref,
  label = "Article body",
}: {
  initialValue: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  /** Image files pasted or dropped into the editor. */
  onFiles?: (files: File[]) => void;
  ref?: Ref<MarkdownEditorHandle>;
  label?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  // Latest callbacks without re-creating the editor on every render.
  const callbacks = useRef({ onChange, onSave, onFiles });
  useEffect(() => {
    callbacks.current = { onChange, onSave, onFiles };
  }, [onChange, onSave, onFiles]);

  useEffect(() => {
    if (!containerRef.current) return;
    const run = (command: MarkdownCommand) => (view: EditorView) => {
      view.dispatch(view.state.update(command(view.state)));
      return true;
    };
    const view = new EditorView({
      parent: containerRef.current,
      state: EditorState.create({
        doc: initialValue,
        extensions: [
          history(),
          EditorState.allowMultipleSelections.of(true),
          EditorView.lineWrapping,
          markdown({ base: markdownLanguage, codeLanguages: languages }),
          syntaxHighlighting(highlight),
          highlightSelectionMatches(),
          placeholderExtension("Start writing in Markdown…"),
          // Explicit tabindex so assistive tech (and axe) treat the scrollable editor as keyboard-reachable.
          EditorView.contentAttributes.of({
            "aria-label": label,
            "aria-multiline": "true",
            role: "textbox",
            tabindex: "0",
            spellcheck: "true",
            autocapitalize: "sentences",
          }),
          keymap.of([
            { key: "Mod-b", run: run(toggleInline("**")) },
            { key: "Mod-i", run: run(toggleInline("_")) },
            { key: "Mod-k", run: run(insertLink()) },
            { key: "Mod-e", run: run(toggleInline("`", "code")) },
            {
              key: "Mod-s",
              preventDefault: true,
              run: () => {
                callbacks.current.onSave?.();
                return true;
              },
            },
            ...defaultKeymap,
            ...historyKeymap,
            ...searchKeymap,
          ]),
          EditorView.domEventHandlers({
            paste(event) {
              const files = imageFiles(event.clipboardData?.files);
              if (!files.length || !callbacks.current.onFiles) return false;
              event.preventDefault();
              callbacks.current.onFiles(files);
              return true;
            },
            drop(event, view) {
              const files = imageFiles(event.dataTransfer?.files);
              if (!files.length || !callbacks.current.onFiles) return false;
              event.preventDefault();
              const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
              if (pos !== null) view.dispatch({ selection: { anchor: pos } });
              callbacks.current.onFiles(files);
              return true;
            },
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) callbacks.current.onChange(update.state.doc.toString());
          }),
          theme,
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // The editor is uncontrolled: `initialValue` only seeds it. Use `setValue` to replace content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      run(command) {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch(view.state.update(command(view.state)));
        view.focus();
      },
      setValue(value) {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
      },
      focus() {
        viewRef.current?.focus();
      },
    }),
    [],
  );

  return (
    <div
      ref={containerRef}
      className="min-h-[60vh] md:h-full md:min-h-0 [&_.cm-editor]:min-h-[60vh] md:[&_.cm-editor]:min-h-full"
    />
  );
}

function imageFiles(list: FileList | undefined | null): File[] {
  return list ? Array.from(list).filter((file) => file.type.startsWith("image/")) : [];
}
