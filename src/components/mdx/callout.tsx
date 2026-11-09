import { Info, Lightbulb, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const variants = {
  info: { Icon: Info, className: "border-sky-500/30 bg-sky-500/5", iconClass: "text-sky-600 dark:text-sky-400" },
  tip: {
    Icon: Lightbulb,
    className: "border-emerald-500/30 bg-emerald-500/5",
    iconClass: "text-emerald-600 dark:text-emerald-400",
  },
  warning: {
    Icon: TriangleAlert,
    className: "border-amber-500/30 bg-amber-500/5",
    iconClass: "text-amber-600 dark:text-amber-400",
  },
} as const;

type CalloutType = keyof typeof variants;

function isCalloutType(value: unknown): value is CalloutType {
  return typeof value === "string" && value in variants;
}

/** `<Callout type="tip" title="Optional">…</Callout>` — unknown types fall back to `info`. */
export function Callout({ type, title, children }: { type?: string; title?: string; children?: React.ReactNode }) {
  const variant = variants[isCalloutType(type) ? type : "info"];
  return (
    <aside className={cn("not-prose my-6 flex gap-3 rounded-lg border p-4 text-sm leading-relaxed", variant.className)}>
      <variant.Icon className={cn("mt-0.5 size-4 shrink-0", variant.iconClass)} aria-hidden />
      <div className="min-w-0 [&>p]:my-0 [&>p+p]:mt-2">
        {title && <p className="mb-1 font-semibold">{title}</p>}
        {children}
      </div>
    </aside>
  );
}
