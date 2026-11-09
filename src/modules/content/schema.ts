import { z } from "zod";
import { MAX_SLUG_LENGTH, SLUG_PATTERN } from "./slug";

/**
 * Content schema v1. Single source of truth for frontmatter validation —
 * used by the public site, the editor (Phase 2) and the publish pipeline.
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * YAML parses unquoted dates (`date: 2026-11-09`) into `Date` objects while
 * quoted ones stay strings. Accept both and normalize to an ISO string.
 */
const contentDate = z.preprocess(
  (value) => (value instanceof Date && !Number.isNaN(value.getTime()) ? value.toISOString().slice(0, 10) : value),
  z
    .string({ error: "must be a date like 2026-11-09" })
    .refine((value) => (DATE_ONLY.test(value) || z.iso.datetime({ offset: true }).safeParse(value).success) && !Number.isNaN(Date.parse(value)), {
      message: "must be a valid date (YYYY-MM-DD or ISO 8601 date-time)",
    }),
);

/** `/images/x.png` (site-relative, no traversal) or an absolute https URL. */
const assetUrl = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine(
    (value) => {
      if (value.startsWith("/")) return !value.startsWith("//") && !value.split("/").includes("..");
      try {
        return new URL(value).protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "must be a site-relative path (/images/...) or an https:// URL" },
  );

const label = z.string().trim().min(1, "must not be empty").max(60, "must be at most 60 characters");

/** Accepts a single string or a list; YAML authors write both. */
const labelList = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" ? [value] : value ?? []),
    z.array(label).max(max, `must have at most ${max} entries`),
  );

export const articleFrontmatterSchema = z
  .object({
    title: z.string().trim().min(1, "is required").max(200),
    slug: z
      .string()
      .max(MAX_SLUG_LENGTH)
      .regex(SLUG_PATTERN, "must be lowercase kebab-case (e.g. my-first-post)")
      .optional(),
    description: z.string().trim().min(1, "is required").max(300),
    date: contentDate,
    updatedAt: contentDate.optional(),
    author: z.string().trim().min(1).max(100).optional(),
    tags: labelList(10),
    categories: labelList(5),
    coverImage: assetUrl.optional(),
    coverAlt: z.string().trim().max(300).optional(),
    published: z.boolean().default(false),
    featured: z.boolean().default(false),
    canonicalUrl: z.url({ protocol: /^https$/ }).optional(),
    redirectFrom: z.array(z.string().regex(SLUG_PATTERN)).max(20).default([]),
  })
  .refine((fm) => !fm.updatedAt || Date.parse(fm.updatedAt) >= Date.parse(fm.date), {
    message: "updatedAt must not be earlier than date",
    path: ["updatedAt"],
  });

export type ArticleFrontmatter = z.infer<typeof articleFrontmatterSchema>;

export const pageFrontmatterSchema = z.object({
  title: z.string().trim().min(1, "is required").max(200),
  description: z.string().trim().max(300).optional(),
  updatedAt: contentDate.optional(),
});

export type PageFrontmatter = z.infer<typeof pageFrontmatterSchema>;

export const taxonomySchema = z.object({
  categories: z
    .array(
      z.object({
        name: label,
        slug: z.string().regex(SLUG_PATTERN).optional(),
        description: z.string().trim().max(300).optional(),
      }),
    )
    .default([]),
});

export type TaxonomyFile = z.infer<typeof taxonomySchema>;
