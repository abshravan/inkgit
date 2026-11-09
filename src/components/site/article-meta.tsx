import { Calendar, Clock } from "lucide-react";
import { formatDate, formatReadingTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Article } from "@/modules/content/types";

export function ArticleMeta({
  article,
  className,
}: {
  article: Pick<Article, "date" | "readingTimeMinutes" | "updatedAt">;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground", className)}>
      <span className="inline-flex items-center gap-1.5">
        <Calendar className="size-3.5" aria-hidden />
        <time dateTime={article.date}>{formatDate(article.date)}</time>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Clock className="size-3.5" aria-hidden />
        {formatReadingTime(article.readingTimeMinutes)}
      </span>
      {article.updatedAt && article.updatedAt !== article.date && (
        <span>
          Updated <time dateTime={article.updatedAt}>{formatDate(article.updatedAt)}</time>
        </span>
      )}
    </div>
  );
}
