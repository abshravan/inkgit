"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { parseLabelList, type ArticleFormValues } from "@/modules/content/editable";
import type { Category } from "@/modules/content/types";

type FieldErrors = Record<string, string[] | undefined>;

function Field({
  label,
  hint,
  error,
  children,
  id,
}: {
  label: string;
  hint?: string;
  error?: string[] | undefined;
  children: React.ReactNode;
  id: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error?.length ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error.join(" ")}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function FrontmatterPanel({
  values,
  onChange,
  slug,
  onSlugChange,
  mode,
  savedSlug,
  onRename,
  renameBlockedReason,
  categories,
  errors,
}: {
  values: ArticleFormValues;
  onChange: (values: ArticleFormValues) => void;
  slug: string;
  onSlugChange: (slug: string) => void;
  mode: "create" | "edit";
  /** Slug currently stored in the repository (edit mode). */
  savedSlug: string | null;
  onRename?: () => void;
  /** Why renaming is unavailable right now (e.g. unsaved changes). */
  renameBlockedReason?: string | null;
  categories: Category[];
  errors: FieldErrors;
}) {
  const id = useId();
  // Keep the raw text so typing "AI, " doesn't immediately drop the comma.
  const [tagText, setTagText] = useState(values.tags.join(", "));
  const set = <K extends keyof ArticleFormValues>(key: K, value: ArticleFormValues[K]) =>
    onChange({ ...values, [key]: value });
  const invalid = (key: string) =>
    errors[key]?.length ? { "aria-invalid": true, "aria-describedby": `${id}-${key}-error` } : {};

  const unknownCategories = values.categories.filter(
    (name) =>
      !categories.some((category) => category.name.toLowerCase() === name.toLowerCase() || category.slug === name),
  );
  const toggleCategory = (name: string, checked: boolean) =>
    set("categories", checked ? [...values.categories, name] : values.categories.filter((item) => item !== name));

  return (
    <div className="flex flex-col gap-5">
      <Field id={`${id}-title`} label="Title" error={errors.title}>
        <Input
          id={`${id}-title`}
          value={values.title}
          onChange={(e) => set("title", e.target.value)}
          {...invalid("title")}
        />
      </Field>

      <Field
        id={`${id}-slug`}
        label="Slug"
        hint={
          mode === "create"
            ? "Used in the URL: /blog/<slug>."
            : "Renaming moves the file and keeps the old URL redirecting here."
        }
        error={errors.slug}
      >
        <div className="flex gap-2">
          <Input
            id={`${id}-slug`}
            value={slug}
            onChange={(e) => onSlugChange(e.target.value)}
            className={cn("font-mono text-xs")}
            {...invalid("slug")}
          />
          {mode === "edit" && savedSlug !== null && slug !== savedSlug && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9"
              disabled={Boolean(renameBlockedReason)}
              title={renameBlockedReason ?? undefined}
              onClick={onRename}
            >
              Rename
            </Button>
          )}
        </div>
        {mode === "edit" && savedSlug !== null && slug !== savedSlug && renameBlockedReason && (
          <p className="text-xs text-amber-700 dark:text-amber-400">{renameBlockedReason}</p>
        )}
      </Field>

      <Field
        id={`${id}-description`}
        label="Description"
        hint="Shown in listings and search results."
        error={errors.description}
      >
        <Textarea
          id={`${id}-description`}
          value={values.description}
          rows={3}
          onChange={(e) => set("description", e.target.value)}
          {...invalid("description")}
        />
      </Field>

      <Field id={`${id}-date`} label="Date" error={errors.date}>
        <Input
          id={`${id}-date`}
          type="date"
          value={values.date}
          onChange={(e) => set("date", e.target.value)}
          {...invalid("date")}
        />
      </Field>

      <Field id={`${id}-tags`} label="Tags" hint="Comma-separated, up to 10." error={errors.tags}>
        <Input
          id={`${id}-tags`}
          value={tagText}
          placeholder="AI, TypeScript"
          onChange={(e) => {
            setTagText(e.target.value);
            set("tags", parseLabelList(e.target.value));
          }}
          {...invalid("tags")}
        />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Categories</legend>
        {categories.length === 0 && unknownCategories.length === 0 && (
          <p className="text-xs text-muted-foreground">No categories defined in taxonomy.yml.</p>
        )}
        {[...categories.map((category) => category.name), ...unknownCategories].map((name) => {
          const checked = values.categories.some((item) => item.toLowerCase() === name.toLowerCase());
          const unknown = unknownCategories.includes(name);
          return (
            <label key={name} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[var(--primary)]"
                checked={checked}
                onChange={(e) => toggleCategory(name, e.target.checked)}
              />
              {name}
              {unknown && <span className="text-xs text-amber-600 dark:text-amber-400">(not in taxonomy)</span>}
            </label>
          );
        })}
        {errors.categories?.length ? <p className="text-xs text-destructive">{errors.categories.join(" ")}</p> : null}
      </fieldset>

      <Field id={`${id}-cover`} label="Cover image" hint="/images/… or an https:// URL" error={errors.coverImage}>
        <Input
          id={`${id}-cover`}
          value={values.coverImage}
          onChange={(e) => set("coverImage", e.target.value)}
          {...invalid("coverImage")}
        />
      </Field>

      {values.coverImage && (
        <Field id={`${id}-cover-alt`} label="Cover alt text" error={errors.coverAlt}>
          <Input id={`${id}-cover-alt`} value={values.coverAlt} onChange={(e) => set("coverAlt", e.target.value)} />
        </Field>
      )}

      <Field id={`${id}-author`} label="Author" hint="Leave empty to use the site default." error={errors.author}>
        <Input id={`${id}-author`} value={values.author} onChange={(e) => set("author", e.target.value)} />
      </Field>

      <div className="flex items-center justify-between gap-4">
        <Label htmlFor={`${id}-featured`}>Featured on the homepage</Label>
        <Switch
          id={`${id}-featured`}
          checked={values.featured}
          onCheckedChange={(checked) => set("featured", checked)}
        />
      </div>
    </div>
  );
}
