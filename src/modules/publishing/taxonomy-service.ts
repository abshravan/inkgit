import { parse as parseYaml, stringify } from "yaml";
import { TAXONOMY_PATH } from "@/modules/content/build-index";
import type { ContentService } from "@/modules/content/content-service";
import { splitFrontmatter } from "@/modules/content/parse";
import { taxonomySchema } from "@/modules/content/schema";
import { serializeArticle } from "@/modules/content/serialize";
import { slugify } from "@/modules/content/slug";
import type { Article } from "@/modules/content/types";
import {
  ConflictError,
  GitProviderError,
  type CommitAuthor,
  type FileChange,
  type GitProvider,
} from "@/modules/git/types";
import { commitMessage } from "./commit-messages";

export interface TaxonomyOverview {
  categories: Array<{ slug: string; name: string; description: string; count: number }>;
  tags: Array<{ slug: string; name: string; count: number }>;
  /** Blob SHA of taxonomy.yml (null if it doesn't exist yet). */
  taxonomySha: string | null;
  /** True when categories come from articles because taxonomy.yml is missing. */
  derived: boolean;
}

export type TaxonomyOperation =
  | { type: "add-category"; name: string; description: string }
  | { type: "update-category"; slug: string; name: string; description: string }
  | { type: "delete-category"; slug: string }
  | { type: "rename-tag"; slug: string; name: string }
  | { type: "delete-tag"; slug: string };

export type TaxonomyResult =
  | { status: "saved"; filesChanged: number }
  | { status: "invalid"; message: string }
  | { status: "conflict"; message: string }
  | { status: "error"; message: string };

interface CategoryEntry {
  name: string;
  slug?: string;
  description?: string;
}

/**
 * Manages categories (curated in taxonomy.yml) and tags (free-form, stored on
 * articles). Renames and deletions rewrite every affected article and the
 * taxonomy file in a single atomic commit, so the repository never holds a
 * half-applied change.
 */
export class TaxonomyService {
  constructor(
    private readonly provider: GitProvider,
    private readonly content: ContentService,
  ) {}

  async getOverview(): Promise<TaxonomyOverview> {
    const [index, file] = await Promise.all([this.content.loadIndex(), this.provider.readFile(TAXONOMY_PATH)]);
    const counts = (pick: (a: Article) => Array<{ slug: string }>) => {
      const map = new Map<string, number>();
      for (const article of index.articles)
        for (const term of pick(article)) map.set(term.slug, (map.get(term.slug) ?? 0) + 1);
      return map;
    };
    const categoryCounts = counts((a) => a.categories);
    const tagCounts = counts((a) => a.tags);
    const tagNames = new Map<string, string>();
    for (const article of index.articles)
      for (const tag of article.tags) if (!tagNames.has(tag.slug)) tagNames.set(tag.slug, tag.name);
    return {
      categories: index.categories.map((category) => ({
        slug: category.slug,
        name: category.name,
        description: category.description ?? "",
        count: categoryCounts.get(category.slug) ?? 0,
      })),
      tags: [...tagNames]
        .map(([slug, name]) => ({ slug, name, count: tagCounts.get(slug) ?? 0 }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
      taxonomySha: file?.sha ?? null,
      derived: file === null,
    };
  }

  async apply(operation: TaxonomyOperation, author: CommitAuthor): Promise<TaxonomyResult> {
    try {
      const changes = await this.plan(operation);
      if ("invalid" in changes) return { status: "invalid", message: changes.invalid };
      if (changes.list.length === 0) return { status: "saved", filesChanged: 0 };
      await this.provider.commit({
        message: commitMessage("taxonomy", describe(operation)),
        author,
        changes: changes.list,
      });
      return { status: "saved", filesChanged: changes.list.length };
    } catch (error) {
      if (error instanceof ConflictError) {
        return { status: "conflict", message: "Content changed while updating. Reload the page and try again." };
      }
      if (error instanceof GitProviderError) return { status: "error", message: error.message };
      throw error;
    }
  }

  private async plan(operation: TaxonomyOperation): Promise<{ list: FileChange[] } | { invalid: string }> {
    const index = await this.content.loadIndex();
    const taxonomyFile = await this.provider.readFile(TAXONOMY_PATH);
    let categories: CategoryEntry[] = taxonomyFile ? this.parseCategories(taxonomyFile.content) : index.categories;
    const list: FileChange[] = [];

    const rewriteArticles = async (kind: "tags" | "categories", fromSlug: string, to: string | null) => {
      for (const article of index.articles) {
        const terms = kind === "tags" ? article.tags : article.categories;
        if (!terms.some((term) => term.slug === fromSlug)) continue;
        const file = await this.provider.readFile(article.path);
        if (!file || file.sha !== article.sha) throw new ConflictError(article.path, article.sha, file?.sha ?? null);
        const split = splitFrontmatter(file);
        if (!split.ok) continue;
        const raw = split.value.data[kind];
        const labels =
          typeof raw === "string"
            ? [raw]
            : Array.isArray(raw)
              ? raw.filter((v): v is string => typeof v === "string")
              : [];
        const next: string[] = [];
        for (const label of labels) {
          const value = slugify(label) === fromSlug || label.toLowerCase() === fromSlug ? to : label;
          if (value && !next.some((existing) => slugify(existing) === slugify(value))) next.push(value);
        }
        list.push({
          op: "upsert",
          path: file.path,
          content: serializeArticle({ ...split.value.data, [kind]: next }, split.value.body),
          expectedSha: file.sha,
        });
      }
    };

    switch (operation.type) {
      case "add-category": {
        const name = operation.name.trim();
        const slug = slugify(name);
        if (!slug) return { invalid: "Enter a category name." };
        if (categories.some((c) => (c.slug ?? slugify(c.name)) === slug))
          return { invalid: `"${name}" already exists.` };
        categories = [
          ...categories,
          { name, ...(operation.description.trim() && { description: operation.description.trim() }) },
        ];
        break;
      }
      case "update-category": {
        const target = categories.find((c) => (c.slug ?? slugify(c.name)) === operation.slug);
        if (!target) return { invalid: "That category no longer exists." };
        const name = operation.name.trim();
        const newSlug = slugify(name);
        if (!newSlug) return { invalid: "Enter a category name." };
        if (newSlug !== operation.slug && categories.some((c) => (c.slug ?? slugify(c.name)) === newSlug)) {
          return { invalid: `"${name}" already exists. Delete one of them instead.` };
        }
        // Renaming changes the slug (and URL); a description-only edit keeps it.
        const keepSlug = name === target.name && target.slug ? { slug: target.slug } : {};
        categories = categories.map((c) =>
          c === target
            ? { name, ...keepSlug, ...(operation.description.trim() && { description: operation.description.trim() }) }
            : c,
        );
        if (name !== target.name) await rewriteArticles("categories", operation.slug, name);
        break;
      }
      case "delete-category": {
        if (!categories.some((c) => (c.slug ?? slugify(c.name)) === operation.slug))
          return { invalid: "That category no longer exists." };
        categories = categories.filter((c) => (c.slug ?? slugify(c.name)) !== operation.slug);
        await rewriteArticles("categories", operation.slug, null);
        break;
      }
      case "rename-tag": {
        const name = operation.name.trim();
        if (!slugify(name)) return { invalid: "Enter a tag name." };
        if (name.length > 60) return { invalid: "Tags are limited to 60 characters." };
        await rewriteArticles("tags", operation.slug, name);
        return { list };
      }
      case "delete-tag":
        await rewriteArticles("tags", operation.slug, null);
        return { list };
    }

    const yaml = `# Curated categories. Managed by InkGit; articles reference them by name.\n${stringify(
      {
        categories: categories.map(({ name, slug, description }) => ({
          name,
          // Keep explicit slugs so category URLs don't change on unrelated edits.
          ...(slug && slug !== slugify(name) && { slug }),
          ...(description && { description }),
        })),
      },
      { lineWidth: 0 },
    )}`;
    const validated = taxonomySchema.safeParse({ categories });
    if (!validated.success) return { invalid: validated.error.issues[0]?.message ?? "Invalid taxonomy" };
    list.unshift({ op: "upsert", path: TAXONOMY_PATH, content: yaml, expectedSha: taxonomyFile?.sha ?? null });
    return { list };
  }

  private parseCategories(source: string): CategoryEntry[] {
    let raw: unknown = {};
    try {
      raw = parseYaml(source) ?? {};
    } catch {
      throw new GitProviderError("taxonomy.yml is not valid YAML; fix it before editing categories", "io");
    }
    const parsed = taxonomySchema.safeParse(raw);
    if (!parsed.success) throw new GitProviderError("taxonomy.yml is invalid; fix it before editing categories", "io");
    return parsed.data.categories;
  }
}

function describe(operation: TaxonomyOperation): string {
  switch (operation.type) {
    case "add-category":
      return `add category ${operation.name}`;
    case "update-category":
      return `update category ${operation.slug}`;
    case "delete-category":
      return `delete category ${operation.slug}`;
    case "rename-tag":
      return `rename tag ${operation.slug} to ${operation.name}`;
    case "delete-tag":
      return `delete tag ${operation.slug}`;
  }
}
