"use client";

import { History } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { restoreArticleAction } from "@/app/admin/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function RestoreButton({
  slug,
  commitSha,
  baseSha,
}: {
  slug: string;
  commitSha: string;
  baseSha: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const restore = () =>
    startTransition(async () => {
      const result = await restoreArticleAction({ slug, commitSha, baseSha });
      if (result.status === "restored") {
        router.push(`/admin/articles/${slug}`);
      } else {
        setMessage(result.message);
      }
    });

  return (
    <div className="flex items-center gap-3">
      {message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="sm" disabled={pending}>
            <History /> Restore this version
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore version {commitSha.slice(0, 7)}?</AlertDialogTitle>
            <AlertDialogDescription>
              The article’s current content is replaced by this version in a new commit. If it’s published, the public
              site updates too. You can always restore the current version again from history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={restore}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
