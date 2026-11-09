/**
 * With Cache Components, `generateStaticParams` must return at least one entry.
 * When there's no content yet, return a placeholder that the page resolves to
 * `notFound()` (it is never a valid slug because it contains underscores).
 */
export const PLACEHOLDER_PARAM = "__none__";

export function withPlaceholder<K extends string>(key: K, values: string[]): Array<Record<K, string>> {
  const list = values.length ? values : [PLACEHOLDER_PARAM];
  return list.map((value) => ({ [key]: value }) as Record<K, string>);
}
