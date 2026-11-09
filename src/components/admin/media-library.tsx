"use client";

import { Check, Copy, ImageUp, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteMediaAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { altFromFilename, uploadImage } from "@/lib/upload-client";
import { cn } from "@/lib/utils";
import type { MediaWithUsage } from "@/modules/media/media-service";

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function MediaLibrary({ items, maxBytes }: { items: MediaWithUsage[]; maxBytes: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dragging, setDragging] = useState(false);
  const [messages, setMessages] = useState<Array<{ tone: "success" | "error"; text: string }>>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const upload = (files: File[]) =>
    startTransition(async () => {
      const next: typeof messages = [];
      for (const file of files) {
        const result = await uploadImage(file);
        next.push(
          result.ok
            ? { tone: "success", text: `Uploaded ${file.name}` }
            : { tone: "error", text: `${file.name}: ${result.error}` },
        );
      }
      setMessages(next);
      router.refresh();
    });

  const remove = (key: string) =>
    startTransition(async () => {
      const result = await deleteMediaAction({ key });
      setMessages([result.ok ? { tone: "success", text: "Deleted." } : { tone: "error", text: result.message }]);
      if (result.ok) router.refresh();
    });

  const copy = async (item: MediaWithUsage) => {
    await navigator.clipboard.writeText(`![${altFromFilename(item.key.split("/").at(-1) ?? "image")}](${item.url})`);
    setCopied(item.key);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <label
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const files = Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith("image/"));
          if (files.length) upload(files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center text-sm transition-colors hover:bg-accent/50 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
          dragging && "border-foreground bg-accent/50",
          pending && "opacity-60",
        )}
      >
        <ImageUp className="size-6 text-muted-foreground" aria-hidden />
        <span className="font-medium">{pending ? "Working…" : "Drop images here or click to upload"}</span>
        <span className="text-muted-foreground">
          PNG, JPEG, GIF, WebP or AVIF · up to {Math.round(maxBytes / 1024 / 1024)} MB
        </span>
        <input
          type="file"
          multiple
          accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
          className="sr-only"
          aria-label="Upload images"
          disabled={pending}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (files.length) upload(files);
          }}
        />
      </label>

      {messages.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm" role="status">
          {messages.map((message, index) => (
            <li
              key={index}
              className={message.tone === "error" ? "text-destructive" : "text-emerald-700 dark:text-emerald-400"}
            >
              {message.text}
            </li>
          ))}
        </ul>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No images yet.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <li key={item.key} className="flex flex-col overflow-hidden rounded-xl border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.url} alt="" loading="lazy" className="aspect-video w-full bg-muted object-cover" />
              <div className="flex flex-1 flex-col gap-2 p-3 text-xs">
                <p className="truncate font-mono" title={item.key}>
                  {item.key}
                </p>
                <p className="text-muted-foreground">
                  {formatSize(item.size)} · {formatDate(item.uploadedAt)}
                </p>
                <p className="text-muted-foreground">
                  {item.usedBy.length ? (
                    <>
                      Used in{" "}
                      {item.usedBy.map((slug, index) => (
                        <span key={slug}>
                          {index > 0 && ", "}
                          <Link href={`/admin/articles/${slug}`} className="underline">
                            {slug}
                          </Link>
                        </span>
                      ))}
                    </>
                  ) : (
                    "Not used"
                  )}
                </p>
                <div className="mt-auto flex gap-1">
                  <Button size="sm" variant="outline" className="h-7 flex-1" onClick={() => copy(item)}>
                    {copied === item.key ? <Check /> : <Copy />} Markdown
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="size-7 text-destructive hover:text-destructive"
                    aria-label={`Delete ${item.key}`}
                    title={item.usedBy.length ? "In use — remove it from articles first" : "Delete"}
                    disabled={pending || item.usedBy.length > 0}
                    onClick={() => remove(item.key)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
