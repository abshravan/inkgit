import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getServerEnv } from "@/lib/env";
import type { CommitAuthor } from "@/modules/git/types";
import { isAllowedAdmin } from "./admin-allowlist";
import { auth } from "./auth";

export interface AdminUser {
  githubId: string;
  login: string;
  name: string;
  email: string | null;
  image: string | null;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("You must be signed in as an admin to do this.");
    this.name = "UnauthorizedError";
  }
}

/**
 * Data Access Layer entry point. Re-checks the allowlist on every call, so
 * removing an ID from ADMIN_GITHUB_IDS revokes access immediately, even for
 * sessions issued earlier.
 */
export async function getAdmin(): Promise<AdminUser | null> {
  // Always evaluate per request. Without this, a build without auth env vars
  // would return early, never touch request data, and Next.js would prerender
  // the "not authorized" result into a static page.
  await connection();
  const env = getServerEnv();
  if (!env.authConfigured) return null;
  const session = await auth();
  const user = session?.user;
  if (!user || !isAllowedAdmin(user.githubId, env.adminGithubIds)) return null;
  return {
    githubId: user.githubId,
    login: user.login,
    name: user.name || user.login || "Admin",
    email: user.email ?? null,
    image: user.image ?? null,
  };
}

/** For admin pages: redirects to the login page when not authorized. */
export async function requireAdminPage(): Promise<AdminUser> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

/** For server actions and route handlers: throws when not authorized. */
export async function requireAdminAction(): Promise<AdminUser> {
  const admin = await getAdmin();
  if (!admin) throw new UnauthorizedError();
  return admin;
}

/** Commits are attributed to the signed-in author (GitHub noreply email fallback). */
export function commitAuthorFor(admin: AdminUser): CommitAuthor {
  return {
    name: admin.name,
    email: admin.email ?? `${admin.githubId}+${admin.login || "inkgit"}@users.noreply.github.com`,
  };
}
