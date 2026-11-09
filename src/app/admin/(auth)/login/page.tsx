import { PenLine } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { signInWithGitHubAction } from "@/app/admin/actions";
import { GitHubIcon } from "@/components/site/brand-icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getServerEnv } from "@/lib/env";
import { LoginError } from "./login-error";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  const { authConfigured } = getServerEnv();
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <span className="mx-auto mb-2 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <PenLine className="size-5" aria-hidden />
          </span>
          <CardTitle className="text-xl">InkGit Admin</CardTitle>
          <CardDescription>Sign in to write and publish.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Suspense>
            <LoginError />
          </Suspense>
          {authConfigured ? (
            <form action={signInWithGitHubAction}>
              <Button type="submit" className="w-full">
                <GitHubIcon className="size-4" /> Continue with GitHub
              </Button>
            </form>
          ) : (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <p className="font-medium">Sign-in isn’t configured yet.</p>
              <p className="mt-1 text-muted-foreground">
                Set <code>AUTH_SECRET</code>, <code>AUTH_GITHUB_ID</code>, <code>AUTH_GITHUB_SECRET</code> and{" "}
                <code>ADMIN_GITHUB_IDS</code> — see the README.
              </p>
            </div>
          )}
          <Link href="/" className="text-center text-sm text-muted-foreground hover:text-foreground">
            ← Back to the site
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
