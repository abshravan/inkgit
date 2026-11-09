import { stringify } from "yaml";
import { MANAGED_KEYS } from "./editable";

/**
 * Canonical on-disk format for articles. Key order is fixed so commits only
 * show meaningful diffs; unknown keys are preserved after the managed ones.
 */
export function serializeArticle(frontmatter: Record<string, unknown>, body: string): string {
  const ordered: Record<string, unknown> = {};
  const keys = [
    ...MANAGED_KEYS.filter((key) => key in frontmatter),
    ...Object.keys(frontmatter)
      .filter((key) => !(MANAGED_KEYS as readonly string[]).includes(key))
      .sort(),
  ];
  for (const key of keys) {
    const value = frontmatter[key];
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    ordered[key] = value instanceof Date ? value.toISOString().slice(0, 10) : value;
  }
  const yaml = stringify(ordered, { lineWidth: 0, defaultStringType: "QUOTE_DOUBLE", defaultKeyType: "PLAIN" });
  const normalizedBody = body.replace(/\r\n/g, "\n").replace(/^\n+/, "").replace(/\s*$/, "\n");
  return `---\n${yaml}---\n\n${normalizedBody}`;
}
