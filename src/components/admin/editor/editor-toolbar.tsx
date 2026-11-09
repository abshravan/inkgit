"use client";

import {
  Bold,
  Code,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link,
  List,
  ListOrdered,
  Quote,
  SquareCode,
  Strikethrough,
  Table,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  insertCodeBlock,
  insertLink,
  insertTable,
  toggleInline,
  toggleLinePrefix,
  type MarkdownCommand,
} from "./markdown-commands";

interface ToolbarItem {
  label: string;
  shortcut?: string;
  Icon: LucideIcon;
  command: MarkdownCommand;
}

const groups: ToolbarItem[][] = [
  [
    { label: "Heading 2", Icon: Heading2, command: toggleLinePrefix({ heading: 2 }) },
    { label: "Heading 3", Icon: Heading3, command: toggleLinePrefix({ heading: 3 }) },
  ],
  [
    { label: "Bold", shortcut: "Mod+B", Icon: Bold, command: toggleInline("**") },
    { label: "Italic", shortcut: "Mod+I", Icon: Italic, command: toggleInline("_") },
    { label: "Strikethrough", Icon: Strikethrough, command: toggleInline("~~") },
    { label: "Inline code", shortcut: "Mod+E", Icon: Code, command: toggleInline("`", "code") },
  ],
  [
    { label: "Link", shortcut: "Mod+K", Icon: Link, command: insertLink() },
    { label: "Image", Icon: ImageIcon, command: insertLink(true) },
  ],
  [
    { label: "Quote", Icon: Quote, command: toggleLinePrefix("quote") },
    { label: "Bulleted list", Icon: List, command: toggleLinePrefix("bullet") },
    { label: "Numbered list", Icon: ListOrdered, command: toggleLinePrefix("ordered") },
    { label: "Code block", Icon: SquareCode, command: insertCodeBlock() },
    { label: "Table", Icon: Table, command: insertTable() },
  ],
];

export function EditorToolbar({ onCommand }: { onCommand: (command: MarkdownCommand) => void }) {
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5">
      {groups.map((group, index) => (
        <div key={index} className="flex items-center gap-0.5 border-r pr-1 last:border-r-0 [&:not(:first-child)]:pl-1">
          {group.map(({ label, shortcut, Icon, command }) => {
            const title = shortcut ? `${label} (${shortcut.replace("Mod", isMac ? "⌘" : "Ctrl")})` : label;
            return (
              <Button
                key={label}
                type="button"
                variant="ghost"
                size="icon-sm"
                title={title}
                aria-label={label}
                // Keep focus (and the selection) in the editor.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onCommand(command)}
              >
                <Icon />
              </Button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
