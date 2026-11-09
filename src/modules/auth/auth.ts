import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { getServerEnv } from "@/lib/env";
import { isAllowedAdmin } from "./admin-allowlist";

declare module "next-auth" {
  interface Session {
    user: { githubId: string; login: string; name?: string | null; email?: string | null; image?: string | null };
  }
}

/**
 * Auth.js configuration. GitHub OAuth is used for identity only: the token is
 * never stored or used for repository access (that uses a server-side
 * credential in Phase 3). Sessions are encrypted JWT cookies, no database.
 */
export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const env = getServerEnv();
  return {
    providers: [GitHub],
    session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
    trustHost: true,
    pages: { signIn: "/admin/login", error: "/admin/login" },
    callbacks: {
      // Reject non-admins at sign-in so they never receive a session.
      signIn({ account }) {
        return account?.provider === "github" && isAllowedAdmin(account.providerAccountId, env.adminGithubIds);
      },
      jwt({ token, account, profile }) {
        if (account?.provider === "github") {
          token.githubId = account.providerAccountId;
          token.login = typeof profile?.login === "string" ? profile.login : "";
        }
        return token;
      },
      session({ session, token }) {
        session.user.githubId = typeof token.githubId === "string" ? token.githubId : "";
        session.user.login = typeof token.login === "string" ? token.login : "";
        return session;
      },
    },
  };
});
