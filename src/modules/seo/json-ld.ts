const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

/**
 * Serializes JSON-LD for a <script type="application/ld+json"> tag. `<` is
 * escaped so content like "</script>" in a title can't break out of the tag,
 * and U+2028/U+2029 are escaped for older JavaScript parsers.
 */
export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replaceAll(LINE_SEPARATOR, "\\u2028")
    .replaceAll(PARAGRAPH_SEPARATOR, "\\u2029");
}
