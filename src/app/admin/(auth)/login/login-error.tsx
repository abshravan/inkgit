"use client";

import { useSearchParams } from "next/navigation";

const MESSAGES: Record<string, string> = {
  AccessDenied: "This GitHub account isn’t allowed to manage this blog.",
  Configuration: "Sign-in is misconfigured on the server.",
};

export function LoginError() {
  const error = useSearchParams().get("error");
  if (!error) return null;
  return (
    <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
      {MESSAGES[error] ?? "Sign-in failed. Please try again."}
    </p>
  );
}
