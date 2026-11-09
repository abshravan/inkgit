import { z } from "zod";

/**
 * The editor's view of article frontmatter. Isomorphic (no server imports) so
 * the client form and the server action validate against the same shape.
 *
 * `published` is intentionally absent: status changes only through explicit
 * publish/unpublish intents, never through a form field.
 */
export const articleFormSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().min(1, "Description is required").max(300),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD"),
  author: z.string().trim().max(100).default(""),
  tags: z.array(z.string().trim().min(1).max(60)).max(10, "At most 10 tags").default([]),
  categories: z.array(z.string().trim().min(1).max(60)).max(5, "At most 5 categories").default([]),
  coverImage: z.string().trim().max(2048).default(""),
  coverAlt: z.string().trim().max(300).default(""),
  featured: z.boolean().default(false),
});

export type ArticleFormValues = z.infer<typeof articleFormSchema>;

/** Frontmatter keys managed by the editor; anything else is preserved untouched. */
export const MANAGED_KEYS = [
  "title",
  "slug",
  "description",
  "date",
  "updatedAt",
  "author",
  "tags",
  "categories",
  "coverImage",
  "coverAlt",
  "published",
  "featured",
  "canonicalUrl",
  "redirectFrom",
] as const;

export function emptyFormValues(today: string): ArticleFormValues {
  return {
    title: "",
    description: "",
    date: today,
    author: "",
    tags: [],
    categories: [],
    coverImage: "",
    coverAlt: "",
    featured: false,
  };
}

const asString = (value: unknown): string => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
};

const asStringList = (value: unknown): string[] =>
  typeof value === "string"
    ? [value]
    : Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];

/**
 * Lenient conversion from raw (possibly invalid) frontmatter so authors can
 * open and fix broken files in the editor.
 */
export function formValuesFromData(data: Record<string, unknown>, fallbackDate: string): ArticleFormValues {
  const date = asString(data.date);
  return {
    title: asString(data.title),
    description: asString(data.description),
    date: /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 10) : fallbackDate,
    author: asString(data.author),
    tags: asStringList(data.tags),
    categories: asStringList(data.categories),
    coverImage: asString(data.coverImage),
    coverAlt: asString(data.coverAlt),
    featured: data.featured === true,
  };
}

/** Splits a comma-separated input ("AI, LLM") into trimmed, de-duplicated labels. */
export function parseLabelList(input: string): string[] {
  const seen = new Set<string>();
  return input
    .split(",")
    .map((label) => label.trim())
    .filter((label) => {
      const key = label.toLowerCase();
      if (!label || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
