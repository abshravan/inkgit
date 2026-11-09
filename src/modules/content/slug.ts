/** Lowercase kebab-case: letters/digits separated by single hyphens. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_SLUG_LENGTH = 100;

export function isValidSlug(value: string): boolean {
  return value.length <= MAX_SLUG_LENGTH && SLUG_PATTERN.test(value);
}

/**
 * Converts a human label ("Next.js & React") into a URL slug ("next-js-react").
 * Used for tags and categories, whose display labels are free-form.
 */
export function slugify(label: string): string {
  return label
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\+/g, " plus ")
    .replace(/#/g, " sharp ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
}

const CONTENT_FILE_PATTERN = /^([^/]+)\.(mdx|md)$/;

/** Extracts the slug from a content filename (`hello-world.mdx` → `hello-world`). */
export function slugFromFilename(filename: string): { slug: string; format: "md" | "mdx" } | null {
  const match = CONTENT_FILE_PATTERN.exec(filename);
  if (!match || !match[1] || !match[2]) return null;
  return { slug: match[1], format: match[2] as "md" | "mdx" };
}
