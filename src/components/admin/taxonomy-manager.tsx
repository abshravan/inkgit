"use client";

import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { taxonomyAction } from "@/app/admin/actions";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { TaxonomyOperation, TaxonomyOverview } from "@/modules/publishing/taxonomy-service";

type Notice = { tone: "success" | "error"; text: string } | null;

export function TaxonomyManager({ overview }: { overview: TaxonomyOverview }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<Notice>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const run = (operation: TaxonomyOperation, onDone?: () => void) => {
    setNotice(null);
    startTransition(async () => {
      const result = await taxonomyAction(operation);
      if (result.status === "saved") {
        setNotice({
          tone: "success",
          text: result.filesChanged
            ? `Saved — ${result.filesChanged} file${result.filesChanged === 1 ? "" : "s"} changed in one commit.`
            : "Nothing to change.",
        });
        setEditing(null);
        onDone?.();
        router.refresh();
      } else {
        setNotice({ tone: "error", text: result.message });
      }
    });
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            notice.tone === "error"
              ? "border-destructive/40 bg-destructive/5 text-destructive"
              : "border-emerald-500/40 bg-emerald-500/5",
          )}
        >
          {notice.text}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
            <CardDescription>
              Curated in <code>taxonomy.yml</code>.
              {overview.derived && " The file doesn’t exist yet; it’s created on the first change."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ul className="divide-y rounded-md border">
              {overview.categories.length === 0 && (
                <li className="p-3 text-sm text-muted-foreground">No categories yet.</li>
              )}
              {overview.categories.map((category) =>
                editing === `category:${category.slug}` ? (
                  <CategoryEditor
                    key={category.slug}
                    initialName={category.name}
                    initialDescription={category.description}
                    pending={pending}
                    onCancel={() => setEditing(null)}
                    onSave={(name, description) =>
                      run({ type: "update-category", slug: category.slug, name, description })
                    }
                  />
                ) : (
                  <li key={category.slug} className="flex items-start gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {category.name}{" "}
                        <span className="text-xs font-normal text-muted-foreground tabular-nums">
                          {category.count} article{category.count === 1 ? "" : "s"}
                        </span>
                      </p>
                      {category.description && <p className="text-sm text-muted-foreground">{category.description}</p>}
                      <p className="font-mono text-xs text-muted-foreground">/categories/{category.slug}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit ${category.name}`}
                      onClick={() => setEditing(`category:${category.slug}`)}
                    >
                      <Pencil />
                    </Button>
                    <ConfirmDelete
                      label={category.name}
                      count={category.count}
                      kind="category"
                      disabled={pending}
                      onConfirm={() => run({ type: "delete-category", slug: category.slug })}
                    />
                  </li>
                ),
              )}
            </ul>
            <AddCategory
              pending={pending}
              onAdd={(name, description, reset) => run({ type: "add-category", name, description }, reset)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tags</CardTitle>
            <CardDescription>
              Free-form labels on articles. Renaming a tag to an existing one merges them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y rounded-md border">
              {overview.tags.length === 0 && <li className="p-3 text-sm text-muted-foreground">No tags yet.</li>}
              {overview.tags.map((tag) =>
                editing === `tag:${tag.slug}` ? (
                  <TagEditor
                    key={tag.slug}
                    initialName={tag.name}
                    pending={pending}
                    onCancel={() => setEditing(null)}
                    onSave={(name) => run({ type: "rename-tag", slug: tag.slug, name })}
                  />
                ) : (
                  <li key={tag.slug} className="flex items-center gap-3 p-3">
                    <span className="min-w-0 flex-1">
                      #{tag.name}{" "}
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {tag.count} article{tag.count === 1 ? "" : "s"}
                      </span>
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Rename ${tag.name}`}
                      onClick={() => setEditing(`tag:${tag.slug}`)}
                    >
                      <Pencil />
                    </Button>
                    <ConfirmDelete
                      label={`#${tag.name}`}
                      count={tag.count}
                      kind="tag"
                      disabled={pending}
                      onConfirm={() => run({ type: "delete-tag", slug: tag.slug })}
                    />
                  </li>
                ),
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CategoryEditor(props: {
  initialName: string;
  initialDescription: string;
  pending: boolean;
  onCancel: () => void;
  onSave: (name: string, description: string) => void;
}) {
  const [name, setName] = useState(props.initialName);
  const [description, setDescription] = useState(props.initialDescription);
  return (
    <li className="flex flex-col gap-2 bg-muted/30 p-3">
      <Input aria-label="Category name" value={name} onChange={(e) => setName(e.target.value)} />
      <Input
        aria-label="Category description"
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      {name.trim() !== props.initialName && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Renaming updates every article in this category and changes its URL.
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={props.onCancel}>
          <X /> Cancel
        </Button>
        <Button size="sm" disabled={props.pending || !name.trim()} onClick={() => props.onSave(name, description)}>
          <Check /> Save
        </Button>
      </div>
    </li>
  );
}

function TagEditor(props: {
  initialName: string;
  pending: boolean;
  onCancel: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(props.initialName);
  return (
    <li className="flex items-center gap-2 bg-muted/30 p-3">
      <Input aria-label="Tag name" value={name} onChange={(e) => setName(e.target.value)} />
      <Button size="icon-sm" variant="ghost" aria-label="Cancel" onClick={props.onCancel}>
        <X />
      </Button>
      <Button
        size="icon-sm"
        aria-label="Save tag"
        disabled={props.pending || !name.trim()}
        onClick={() => props.onSave(name)}
      >
        <Check />
      </Button>
    </li>
  );
}

function AddCategory({
  pending,
  onAdd,
}: {
  pending: boolean;
  onAdd: (name: string, description: string, reset: () => void) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault();
        onAdd(name, description, () => {
          setName("");
          setDescription("");
        });
      }}
    >
      <Input
        aria-label="New category name"
        placeholder="New category"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Input
        aria-label="New category description"
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <Button type="submit" disabled={pending || !name.trim()}>
        <Plus /> Add
      </Button>
    </form>
  );
}

function ConfirmDelete(props: {
  label: string;
  count: number;
  kind: "category" | "tag";
  disabled: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete ${props.label}`}
          disabled={props.disabled}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {props.label}?</AlertDialogTitle>
          <AlertDialogDescription>
            {props.count > 0
              ? `It will be removed from ${props.count} article${props.count === 1 ? "" : "s"} in one commit. The articles themselves stay.`
              : `No articles use this ${props.kind}.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={props.onConfirm}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
