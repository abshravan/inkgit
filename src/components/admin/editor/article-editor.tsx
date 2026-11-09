"use client";

import { ArrowLeft, Columns2, Eye, PenLine, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { deleteArticleAction, saveArticleAction } from "@/app/admin/actions";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteLocalDraft, loadLocalDraft, saveLocalDraft, type LocalDraft } from "@/lib/local-drafts";
import { cn } from "@/lib/utils";
import type { ArticleFormValues } from "@/modules/content/editable";
import { slugify } from "@/modules/content/slug";
import type { Category } from "@/modules/content/types";
import type { SaveArticleResult, SaveIntent } from "@/modules/publishing/types";
import { countWords, estimateReadingTime } from "@/modules/rendering/text-stats";
import { ConflictDialog, type ConflictState } from "./conflict-dialog";
import { EditorToolbar } from "./editor-toolbar";
import { FrontmatterPanel } from "./frontmatter-panel";
import { MarkdownEditor, type MarkdownEditorHandle } from "./markdown-editor";
import { PreviewPane } from "./preview-pane";

export interface EditorInitialState {
  slug: string;
  sha: string | null;
  format: "md" | "mdx";
  published: boolean;
  values: ArticleFormValues;
  body: string;
  issues: string[];
}

interface DraftData {
  values: ArticleFormValues;
  body: string;
  slug: string;
}

type ViewMode = "write" | "split" | "preview";
type Notice = { tone: "success" | "error" | "info"; text: string } | null;

const AUTOSAVE_MS = 1000;
const WORDS_PER_MINUTE = 225;

export function ArticleEditor({
  mode,
  initial,
  categories,
}: {
  mode: "create" | "edit";
  initial: EditorInitialState;
  categories: Category[];
}) {
  const router = useRouter();
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const [values, setValues] = useState(initial.values);
  const [body, setBody] = useState(initial.body);
  const [slug, setSlug] = useState(initial.slug);
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [baseSha, setBaseSha] = useState(initial.sha);
  const [published, setPublished] = useState(initial.published);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [notice, setNotice] = useState<Notice>(
    initial.issues.length ? { tone: "error", text: `This file has problems: ${initial.issues.join("; ")}` } : null,
  );
  const [conflict, setConflict] = useState<ConflictState | null>(null);
  const [restoreOffer, setRestoreOffer] = useState<LocalDraft<DraftData> | null>(null);
  const [localSavedAt, setLocalSavedAt] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("split");
  const [isSaving, startSaving] = useTransition();
  const draftKey = `article:${mode === "edit" ? initial.slug : "new"}`;

  const stats = useMemo(
    () => ({ words: countWords(body), minutes: estimateReadingTime(body, WORDS_PER_MINUTE) }),
    [body],
  );

  // ---- Local autosave (IndexedDB) -------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    void loadLocalDraft<DraftData>(draftKey).then((draft) => {
      if (cancelled || !draft) return;
      const differs =
        draft.data.body !== initial.body || JSON.stringify(draft.data.values) !== JSON.stringify(initial.values);
      if (differs) setRestoreOffer(draft);
      else void deleteLocalDraft(draftKey);
    });
    return () => {
      cancelled = true;
    };
  }, [draftKey, initial.body, initial.values]);

  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => {
      const savedAt = new Date().toISOString();
      void saveLocalDraft<DraftData>({ key: draftKey, baseSha, data: { values, body, slug }, savedAt }).then(() =>
        setLocalSavedAt(savedAt),
      );
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [dirty, values, body, slug, baseSha, draftKey]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // ---- Editing --------------------------------------------------------------------
  const onBodyChange = useCallback((next: string) => {
    setBody(next);
    setDirty(true);
  }, []);

  const onValuesChange = (next: ArticleFormValues) => {
    setValues(next);
    setDirty(true);
    if (!slugTouched && mode === "create") setSlug(slugify(next.title));
  };

  const restoreLocal = () => {
    if (!restoreOffer) return;
    setValues(restoreOffer.data.values);
    setBody(restoreOffer.data.body);
    editorRef.current?.setValue(restoreOffer.data.body);
    if (mode === "create") {
      setSlug(restoreOffer.data.slug);
      setSlugTouched(true);
    }
    setDirty(true);
    setRestoreOffer(null);
    if (restoreOffer.baseSha !== initial.sha) {
      setNotice({
        tone: "info",
        text: "Restored edits were based on an older version of this article. Saving will ask before overwriting newer changes.",
      });
      // Make the next save conflict-check against the version the edits started from.
      setBaseSha(restoreOffer.baseSha);
    }
  };

  const discardLocal = () => {
    void deleteLocalDraft(draftKey);
    setRestoreOffer(null);
  };

  // ---- Saving ---------------------------------------------------------------------
  const handleResult = (result: SaveArticleResult) => {
    switch (result.status) {
      case "saved": {
        setErrors({});
        setConflict(null);
        setDirty(false);
        setBaseSha(result.sha);
        setPublished(result.published);
        void deleteLocalDraft(draftKey);
        setLocalSavedAt(null);
        setNotice({
          tone: "success",
          text: result.published ? "Published. The public site is updated." : "Draft saved.",
        });
        // The editor already holds the saved state; only a new article needs its permanent URL.
        if (mode === "create") router.replace(`/admin/articles/${result.slug}`);
        return;
      }
      case "invalid":
        setErrors(result.fieldErrors);
        setNotice({
          tone: "error",
          text: result.formErrors[0] ?? "Some fields need attention before this can be saved.",
        });
        return;
      case "render-error":
        setNotice({
          tone: "error",
          text: `Can't publish: the content doesn't render${result.line ? ` (line ${result.line})` : ""}. ${result.message}`,
        });
        return;
      case "conflict":
        setConflict({ message: result.message, remote: result.remote });
        return;
      case "error":
        setNotice({ tone: "error", text: result.message });
    }
  };

  const lastIntent = useRef<SaveIntent>("save");
  const save = (intent: SaveIntent, overwrite?: { remoteSha: string | null }) => {
    lastIntent.current = intent;
    setNotice(null);
    startSaving(async () => {
      try {
        const result = await saveArticleAction({
          slug,
          baseSha,
          intent,
          values,
          body,
          ...(overwrite && { overwrite }),
        });
        handleResult(result);
      } catch {
        setNotice({ tone: "error", text: "Couldn't reach the server. Your edits are kept in this browser." });
      }
    });
  };

  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  const onShortcutSave = useCallback(() => saveRef.current("save"), []);

  const remove = () => {
    if (!baseSha) return;
    startSaving(async () => {
      const result = await deleteArticleAction({ slug, baseSha });
      if (result.status === "deleted") {
        await deleteLocalDraft(draftKey);
        setDirty(false);
        router.push("/admin/articles");
      } else {
        setNotice({ tone: "error", text: result.message });
      }
    });
  };

  const loadTheirs = () => {
    // Edits stay in IndexedDB; reloading fetches the latest version and offers a restore.
    setConflict(null);
    window.location.reload();
  };

  // ---- Render ---------------------------------------------------------------------
  const primaryLabel = published ? "Update" : "Publish";
  return (
    // On desktop the editor fills the viewport and each pane scrolls on its own,
    // so the actions and toolbar never scroll away while writing.
    <div className="flex min-h-0 flex-1 flex-col md:h-dvh">
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3 sm:px-6">
        <Button asChild variant="ghost" size="icon-sm" aria-label="Back to articles">
          <Link href="/admin/articles">
            <ArrowLeft />
          </Link>
        </Button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h1 className="truncate font-semibold">{values.title || "Untitled article"}</h1>
          <Badge variant={published ? "default" : "secondary"}>{published ? "Published" : "Draft"}</Badge>
          <span className="hidden text-xs text-muted-foreground sm:inline" aria-live="polite">
            {isSaving ? "Saving…" : dirty ? "Unsaved changes" : baseSha ? "All changes saved" : ""}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {mode === "edit" && baseSha && (
            <>
              <DeleteButton onConfirm={remove} disabled={isSaving} />
              <Button asChild variant="ghost" size="sm">
                <Link href={`/admin/preview/${slug}`} target="_blank">
                  <Eye /> Preview
                </Link>
              </Button>
            </>
          )}
          {published ? (
            <Button variant="outline" size="sm" disabled={isSaving} onClick={() => save("unpublish")}>
              Unpublish
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled={isSaving} onClick={() => save("save")}>
              Save draft
            </Button>
          )}
          <Button size="sm" disabled={isSaving} onClick={() => save("publish")}>
            {primaryLabel}
          </Button>
        </div>
      </header>

      {restoreOffer && (
        <div className="flex flex-wrap items-center gap-3 border-b bg-amber-500/10 px-4 py-2 text-sm sm:px-6">
          <span className="flex-1">
            Unsaved edits from {new Date(restoreOffer.savedAt).toLocaleString()} were found in this browser.
          </span>
          <Button size="sm" variant="outline" onClick={discardLocal}>
            Discard
          </Button>
          <Button size="sm" onClick={restoreLocal}>
            Restore
          </Button>
        </div>
      )}
      {notice && (
        <div
          role={notice.tone === "error" ? "alert" : "status"}
          className={cn(
            "flex items-start gap-3 border-b px-4 py-2 text-sm sm:px-6",
            notice.tone === "error" && "bg-destructive/10 text-destructive",
            notice.tone === "success" && "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
            notice.tone === "info" && "bg-sky-500/10",
          )}
        >
          <span className="flex-1">{notice.text}</span>
          <button type="button" className="text-xs underline" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="grid min-h-0 flex-1 md:overflow-hidden xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-label="Content" className="flex min-h-0 min-w-0 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-2 py-1.5 sm:px-4">
            <EditorToolbar onCommand={(command) => editorRef.current?.run(command)} />
            <div className="flex items-center gap-0.5 rounded-md border p-0.5" role="group" aria-label="View mode">
              {(
                [
                  ["write", PenLine, "Write"],
                  ["split", Columns2, "Split"],
                  ["preview", Eye, "Preview"],
                ] as const
              ).map(([value, Icon, label]) => (
                <Button
                  key={value}
                  variant={view === value ? "secondary" : "ghost"}
                  size="sm"
                  className={cn("h-7 px-2", value === "split" && "hidden lg:inline-flex")}
                  aria-pressed={view === value}
                  onClick={() => setView(value)}
                >
                  <Icon /> <span className="sr-only sm:not-sr-only">{label}</span>
                </Button>
              ))}
            </div>
          </div>
          <div className={cn("grid min-h-0 flex-1", view === "split" && "lg:grid-cols-2")}>
            <div
              className={cn(
                "min-h-0 min-w-0 border-r md:overflow-auto",
                view === "preview" && "hidden",
                view === "split" && "max-lg:border-r-0",
              )}
            >
              <MarkdownEditor
                ref={editorRef}
                initialValue={initial.body}
                onChange={onBodyChange}
                onSave={onShortcutSave}
              />
            </div>
            <div
              className={cn(
                "min-h-0 min-w-0 overflow-auto p-6",
                view === "write" && "hidden",
                view === "split" && "hidden lg:block",
              )}
              aria-label="Live preview"
            >
              {view !== "write" && <PreviewPane body={body} format={initial.format} />}
            </div>
          </div>
          <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2 text-xs text-muted-foreground tabular-nums">
            <span>{stats.words.toLocaleString()} words</span>
            <span>{stats.minutes} min read</span>
            <span>{initial.format.toUpperCase()}</span>
            {localSavedAt && <span>Backed up locally {new Date(localSavedAt).toLocaleTimeString()}</span>}
            {errors.body?.length ? <span className="text-destructive">{errors.body.join(" ")}</span> : null}
          </footer>
        </section>

        <aside aria-label="Article settings" className="border-t p-4 sm:p-6 xl:overflow-auto xl:border-t-0 xl:border-l">
          <FrontmatterPanel
            values={values}
            onChange={onValuesChange}
            slug={slug}
            onSlugChange={(next) => {
              setSlug(next);
              setSlugTouched(true);
              setDirty(true);
            }}
            slugEditable={mode === "create"}
            categories={categories}
            errors={errors}
          />
        </aside>
      </div>

      <ConflictDialog
        conflict={conflict}
        busy={isSaving}
        onClose={() => setConflict(null)}
        onLoadTheirs={loadTheirs}
        onOverwrite={() => conflict && save(lastIntent.current, { remoteSha: conflict.remote.sha })}
      />
    </div>
  );
}

function DeleteButton({ onConfirm, disabled }: { onConfirm: () => void; disabled: boolean }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={disabled} className="text-destructive hover:text-destructive">
          <Trash2 /> Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this article?</AlertDialogTitle>
          <AlertDialogDescription>
            The file is removed from the content repository. With Git history (Phase 3) it can be restored later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={onConfirm}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
