/**
 * Admins are identified by numeric GitHub user IDs, which never change —
 * unlike usernames, which can be renamed and later claimed by someone else.
 */
export function parseAdminIds(raw: string | undefined): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const part of (raw ?? "").split(",")) {
    const id = part.trim();
    if (!id) continue;
    if (!/^\d{1,20}$/.test(id)) {
      throw new Error(`ADMIN_GITHUB_IDS must contain numeric GitHub user IDs; got "${id}"`);
    }
    ids.add(id);
  }
  return ids;
}

export function isAllowedAdmin(githubId: string | null | undefined, allowlist: ReadonlySet<string>): boolean {
  return typeof githubId === "string" && allowlist.has(githubId);
}
