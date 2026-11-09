export type CommitAction = "create" | "update" | "publish" | "unpublish" | "delete" | "restore" | "rename" | "taxonomy";

/**
 * Conventional commit messages for content changes, e.g.
 * `content(publish): hello-world`. The trailer marks commits made via InkGit.
 */
export function commitMessage(
  action: CommitAction,
  subjectTarget: string,
  options: { draft?: boolean; overwrite?: boolean; fromCommit?: string; fromSlug?: string } = {},
): string {
  const scope = (action === "update" || action === "create") && options.draft ? "draft" : action;
  let subject = `content(${scope}): ${subjectTarget}`;
  if (action === "restore" && options.fromCommit) subject += ` to ${options.fromCommit.slice(0, 7)}`;
  if (action === "rename" && options.fromSlug) subject += ` (was ${options.fromSlug})`;
  const notes = options.overwrite ? "\n\nOverwrote changes made outside InkGit after an explicit author decision." : "";
  return `${subject}${notes}\n\nVia: InkGit`;
}
