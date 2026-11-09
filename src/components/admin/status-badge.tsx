import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ArticleStatus } from "@/modules/publishing/types";

const styles: Record<ArticleStatus, string> = {
  published: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  draft: "border-border bg-muted text-muted-foreground",
  invalid: "border-destructive/30 bg-destructive/10 text-destructive",
};

const labels: Record<ArticleStatus, string> = { published: "Published", draft: "Draft", invalid: "Needs fixing" };

export function StatusBadge({ status }: { status: ArticleStatus }) {
  return (
    <Badge variant="outline" className={cn(styles[status])}>
      {labels[status]}
    </Badge>
  );
}
