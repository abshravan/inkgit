/**
 * Image validation by content (magic bytes), never by file name or the
 * browser-supplied MIME type. SVG is deliberately unsupported: it can carry
 * scripts and is an XSS vector when served from the site's origin.
 */
export type ImageFormat = "png" | "jpeg" | "gif" | "webp" | "avif";

export const IMAGE_MIME: Record<ImageFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
};

export const IMAGE_EXTENSION: Record<ImageFormat, string> = {
  png: "png",
  jpeg: "jpg",
  gif: "gif",
  webp: "webp",
  avif: "avif",
};

const ascii = (bytes: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...bytes.subarray(start, start + length));

export function detectImageFormat(bytes: Uint8Array): ImageFormat | null {
  if (bytes.length < 12) return null;
  if (
    bytes[0] === 0x89 &&
    ascii(bytes, 1, 3) === "PNG" &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a") return "gif";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "webp";
  if (ascii(bytes, 4, 4) === "ftyp") {
    // ISO-BMFF: major brand at 8..12, compatible brands follow up to the box size.
    const boxSize = (bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!;
    const end = Math.min(Math.max(boxSize, 16), bytes.length, 64);
    for (let offset = 8; offset + 4 <= end; offset += 4) {
      if (offset === 12) continue; // minor version
      const brand = ascii(bytes, offset, 4);
      if (brand === "avif" || brand === "avis") return "avif";
    }
  }
  return null;
}
