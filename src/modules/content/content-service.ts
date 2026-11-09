import type { GitReader } from "@/modules/git/types";
import { buildContentIndex, parseTaxonomy, TAXONOMY_PATH } from "./build-index";
import { parseArticle, parsePage, type ArticleParseOptions, type ParsedArticle } from "./parse";
import { slugFromFilename } from "./slug";
import type { ContentIndex, ContentIssue, Page } from "./types";

export const POSTS_DIR = "posts/";
export const PAGES_DIR = "pages/";

/**
 * Application service that turns raw repository files into domain content.
 * Depends only on the `GitReader` abstraction, never on a concrete provider.
 */
export class ContentService {
  constructor(
    private readonly reader: GitReader,
    private readonly options: ArticleParseOptions,
  ) {}

  async loadIndex(): Promise<ContentIndex> {
    const [entries, taxonomyFile] = await Promise.all([
      this.reader.listFiles(POSTS_DIR),
      this.reader.readFile(TAXONOMY_PATH),
    ]);
    const taxonomy = parseTaxonomy(taxonomyFile?.content ?? null);
    const issues: ContentIssue[] = [...taxonomy.issues];
    const articles: ParsedArticle[] = [];

    const contentEntries = entries.filter((entry) => slugFromFilename(entry.path.slice(POSTS_DIR.length)));
    const files = await Promise.all(contentEntries.map((entry) => this.reader.readFile(entry.path)));
    for (const file of files) {
      if (!file) continue; // deleted between list and read
      const result = parseArticle(file, this.options);
      if (result.ok) {
        articles.push(result.value.article);
        issues.push(...result.value.warnings);
      } else {
        issues.push(...result.error);
      }
    }

    const index = buildContentIndex({ articles, curatedCategories: taxonomy.categories, issues });
    for (const issue of index.issues) {
      const log = issue.severity === "error" ? console.error : console.warn;
      log(`[inkgit:content] ${issue.severity} in ${issue.path}: ${issue.message}`);
    }
    return index;
  }

  async loadPage(slug: string): Promise<Page | null> {
    for (const extension of ["mdx", "md"] as const) {
      const file = await this.reader.readFile(`${PAGES_DIR}${slug}.${extension}`);
      if (!file) continue;
      const result = parsePage(file);
      if (result.ok) return result.value;
      for (const issue of result.error) console.error(`[inkgit:content] error in ${issue.path}: ${issue.message}`);
      return null;
    }
    return null;
  }
}
