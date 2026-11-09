/**
 * Validates a content folder exactly like the site does: frontmatter schema,
 * taxonomy, slugs, and a full MDX compile with the production pipeline.
 *
 *   pnpm content:check [dir] [--strict]
 *
 * Exits with 1 on errors (and on warnings with --strict), so it can gate pull
 * requests on the content repository. See docs/content-repo-workflow.yml.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { ContentService } from "@/modules/content/content-service";
import { LocalFsProvider } from "@/modules/git/local/local-fs-provider";
import { compileContent, ContentRenderError } from "@/modules/rendering/pipeline";

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const strict = args.includes("--strict");
  const dir = path.resolve(args.find((arg) => !arg.startsWith("--")) ?? "content");
  const service = new ContentService(new LocalFsProvider(dir), { defaultAuthor: "Author", wordsPerMinute: 225 });

  // The service logs issues itself; keep CLI output to a single report.
  const silence = () => {};
  const original = { error: console.error, warn: console.warn };
  console.error = silence;
  console.warn = silence;
  const index = await service.loadIndex();
  console.error = original.error;
  console.warn = original.warn;

  const issues = [...index.issues];
  for (const article of index.articles) {
    try {
      const compiled = await compileContent(article.body, article.format);
      for (const warning of compiled.warnings)
        issues.push({ path: article.path, severity: "warning", message: warning });
    } catch (error) {
      // Compiler lines are relative to the body; report them as file lines.
      const raw = readFileSync(path.join(dir, article.path), "utf8");
      const bodyStart = raw.indexOf(article.body.slice(0, 40));
      const offset = bodyStart > 0 ? raw.slice(0, bodyStart).split("\n").length - 1 : 0;
      const line = error instanceof ContentRenderError && error.line ? ` (line ${error.line + offset})` : "";
      const message = error instanceof Error ? error.message : String(error);
      issues.push({
        path: article.path,
        severity: article.published ? "error" : "warning",
        message: `MDX does not compile${line}: ${message}`,
      });
    }
  }

  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  for (const issue of issues.sort((a, b) => a.path.localeCompare(b.path))) {
    console.log(`${issue.severity === "error" ? "✖" : "⚠"} ${issue.path}: ${issue.message}`);
  }
  const published = index.articles.filter((article) => article.published).length;
  console.log(
    `\n${index.articles.length} articles (${published} published), ${errors.length} error(s), ${warnings.length} warning(s) in ${path.relative(process.cwd(), dir) || "."}`,
  );
  return errors.length > 0 || (strict && warnings.length > 0) ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error);
    process.exit(2);
  },
);
