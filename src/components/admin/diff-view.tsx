import { buildLineDiff } from "@/lib/diff";
import { cn } from "@/lib/utils";

/** Unified line diff. Pure render (no hooks), usable from server and client components. */
export function DiffView({
  oldText,
  newText,
  oldLabel,
  newLabel,
  className,
}: {
  oldText: string;
  newText: string;
  oldLabel: string;
  newLabel: string;
  className?: string;
}) {
  const { rows, added, removed } = buildLineDiff(oldText, newText);
  return (
    <div className={cn("overflow-hidden rounded-lg border", className)}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b bg-muted/40 px-3 py-2 text-xs">
        <span className="text-destructive">− {oldLabel}</span>
        <span className="text-emerald-700 dark:text-emerald-400">+ {newLabel}</span>
        <span className="ml-auto text-muted-foreground tabular-nums">
          +{added} −{removed}
        </span>
      </div>
      {added === 0 && removed === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">No differences.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse font-mono text-xs leading-5">
            <tbody>
              {rows.map((row, index) =>
                row.kind === "skip" ? (
                  <tr key={index} className="bg-muted/30 text-muted-foreground">
                    <td colSpan={3} className="px-3 py-1 text-center">
                      ⋯ {row.count} unchanged line{row.count === 1 ? "" : "s"}
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={index}
                    className={cn(
                      row.kind === "added" && "bg-emerald-500/10",
                      row.kind === "removed" && "bg-destructive/10",
                    )}
                  >
                    <td className="w-10 px-2 text-right text-muted-foreground/70 select-none">{row.oldLine ?? ""}</td>
                    <td className="w-10 px-2 text-right text-muted-foreground/70 select-none">{row.newLine ?? ""}</td>
                    <td className="px-2 break-words whitespace-pre-wrap">
                      <span aria-hidden className="mr-2 inline-block w-2 select-none">
                        {row.kind === "added" ? "+" : row.kind === "removed" ? "−" : ""}
                      </span>
                      <span className="sr-only">
                        {row.kind === "added" ? "Added: " : row.kind === "removed" ? "Removed: " : ""}
                      </span>
                      {row.text || " "}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
