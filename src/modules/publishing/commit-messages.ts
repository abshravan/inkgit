export type CommitAction = "create" | "update" | "publish" | "unpublish" | "delete";

/**
 * Conventional commit messages for content changes, e.g.
 * `content(publish): hello-world`. The trailer marks commits made via InkGit.
 */
export function commitMessage(
  action: CommitAction,
  slug: string,
  options: { draft?: boolean; overwrite?: boolean } = {},
): string {
  const scope =
    action === "update" && options.draft ? "draft" : action === "create" && options.draft ? "draft" : action;
  const subject = `content(${scope}): ${slug}`;
  const notes = options.overwrite ? "\n\nOverwrote changes made outside InkGit after an explicit author decision." : "";
  return `${subject}${notes}\n\nVia: InkGit`;
}
