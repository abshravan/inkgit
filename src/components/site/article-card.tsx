import Link from "next/link";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Article } from "@/modules/content/types";
import { ArticleMeta } from "./article-meta";
import { CategoryLinks, TagBadges } from "./term-badges";

export function ArticleCard({ article, variant = "default" }: { article: Article; variant?: "default" | "featured" }) {
  return (
    <article
      className={cn(
        "group relative flex flex-col gap-3 rounded-xl border bg-card p-5 transition-colors hover:border-foreground/20",
        variant === "featured" && "p-6",
      )}
    >
      <CategoryLinks categories={article.categories} />
      <h3 className={cn("font-semibold tracking-tight text-balance", variant === "featured" ? "text-xl" : "text-lg")}>
        <Link href={`/blog/${article.slug}`} className="after:absolute after:inset-0 after:content-['']">
          {article.title}
        </Link>
      </h3>
      <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{article.description}</p>
      <div className="mt-auto flex flex-col gap-3 pt-2">
        <ArticleMeta article={article} />
        {/* Tags sit above the card's stretched link so they stay clickable. */}
        <div className="relative z-10">
          <TagBadges tags={article.tags} limit={3} />
        </div>
      </div>
    </article>
  );
}

export function ArticleRow({ article }: { article: Article }) {
  return (
    <article className="group relative flex flex-col gap-2 py-6 sm:flex-row sm:gap-8">
      <time dateTime={article.date} className="shrink-0 pt-0.5 text-sm text-muted-foreground tabular-nums sm:w-28">
        {formatDate(article.date)}
      </time>
      <div className="flex min-w-0 flex-col gap-2">
        <h3 className="text-lg font-semibold tracking-tight">
          <Link
            href={`/blog/${article.slug}`}
            className="group-hover:underline group-hover:underline-offset-4 after:absolute after:inset-0 after:content-['']"
          >
            {article.title}
          </Link>
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{article.description}</p>
        <div className="relative z-10 flex flex-wrap items-center gap-3">
          <span className="text-xs text-muted-foreground">{article.readingTimeMinutes} min read</span>
          <TagBadges tags={article.tags} limit={4} />
        </div>
      </div>
    </article>
  );
}
