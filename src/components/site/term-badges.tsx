import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { TaxonomyTerm } from "@/modules/content/types";

export function TagBadges({ tags, limit }: { tags: TaxonomyTerm[]; limit?: number }) {
  const visible = limit ? tags.slice(0, limit) : tags;
  if (!visible.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
      {visible.map((tag) => (
        <li key={tag.slug}>
          <Badge variant="secondary" asChild>
            <Link href={`/tags/${tag.slug}`}>#{tag.name}</Link>
          </Badge>
        </li>
      ))}
    </ul>
  );
}

export function CategoryLinks({ categories }: { categories: TaxonomyTerm[] }) {
  if (!categories.length) return null;
  return (
    <span className="text-sm font-medium text-brand">
      {categories.map((category, index) => (
        <span key={category.slug}>
          {index > 0 && <span className="text-muted-foreground"> · </span>}
          <Link href={`/categories/${category.slug}`} className="hover:underline">
            {category.name}
          </Link>
        </span>
      ))}
    </span>
  );
}
