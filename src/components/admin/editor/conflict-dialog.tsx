"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DiffView } from "../diff-view";

export interface ConflictState {
  message: string;
  remote: { sha: string | null; content: string | null };
}

/**
 * Shown when a save is rejected because the file changed elsewhere. Nothing is
 * overwritten unless the author explicitly chooses to.
 */
export function ConflictDialog({
  conflict,
  onClose,
  onLoadTheirs,
  onOverwrite,
  busy,
  mine,
}: {
  conflict: ConflictState | null;
  /** The editor's content serialized like a file, for the diff. */
  mine: string;
  onClose: () => void;
  onLoadTheirs: () => void;
  onOverwrite: () => void;
  busy: boolean;
}) {
  return (
    <AlertDialog open={conflict !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="sm:max-w-3xl">
        <AlertDialogHeader>
          <AlertDialogTitle>This article changed somewhere else</AlertDialogTitle>
          <AlertDialogDescription>
            {conflict?.message} Your edits are still in the editor and backed up in this browser.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {conflict?.remote.content !== null && conflict?.remote.content !== undefined ? (
          <div className="max-h-[50vh] overflow-auto">
            <DiffView
              oldText={conflict.remote.content}
              newText={mine}
              oldLabel="in the repository"
              newLabel="your version"
            />
          </div>
        ) : (
          <p className="text-sm">The file no longer exists in the repository.</p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Keep editing</AlertDialogCancel>
          {conflict?.remote.content !== null && (
            <Button variant="outline" onClick={onLoadTheirs} disabled={busy}>
              Load their version
            </Button>
          )}
          <Button variant="destructive" onClick={onOverwrite} disabled={busy}>
            {conflict?.remote.content === null ? "Recreate with my version" : "Overwrite with my version"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
