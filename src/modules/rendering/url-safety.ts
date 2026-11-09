const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/**
 * Allows relative URLs (`/x`, `./x`, `#x`, `?x`) and http(s)/mailto absolutes.
 * Rejects `javascript:`, `data:`, `vbscript:` and protocol-relative `//host`.
 */
export function isSafeUrl(url: string): boolean {
  const value = url.trim();
  if (!value) return false;
  // Strip characters browsers ignore inside schemes (e.g. "java\tscript:").
  const compact = value.replace(/[\u0000-\u001F\u007F\s]/g, "");
  if (compact.startsWith("//")) return false;
  if (/^[#/?.]/.test(compact)) return true;
  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(compact);
  if (!scheme) return true; // bare relative path like "images/x.png"
  return SAFE_PROTOCOLS.has(`${scheme[1]?.toLowerCase()}:`);
}
