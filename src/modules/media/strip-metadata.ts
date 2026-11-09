import type { ImageFormat } from "./image-format";

/**
 * Removes privacy-sensitive metadata (EXIF incl. GPS, XMP, IPTC, comments)
 * without re-encoding pixels. Colour profiles are kept. Malformed files are
 * rejected rather than passed through half-parsed.
 *
 * JPEG, PNG and WebP are stripped; GIF has no EXIF; AVIF is passed through
 * (documented limitation).
 */
export class ImageParseError extends Error {}

export function stripImageMetadata(bytes: Uint8Array, format: ImageFormat): Uint8Array {
  switch (format) {
    case "jpeg":
      return stripJpeg(bytes);
    case "png":
      return stripPng(bytes);
    case "webp":
      return stripWebp(bytes);
    default:
      return bytes;
  }
}

// JPEG: drop APP1 (EXIF/XMP), APP13 (IPTC/Photoshop) and COM segments.
function stripJpeg(bytes: Uint8Array): Uint8Array {
  const out: Uint8Array[] = [bytes.subarray(0, 2)];
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) throw new ImageParseError("Malformed JPEG");
    const marker = bytes[offset + 1]!;
    // Start of scan: the rest is entropy-coded image data.
    if (marker === 0xda) {
      out.push(bytes.subarray(offset));
      return concat(out);
    }
    if (marker === 0xd9) {
      out.push(bytes.subarray(offset, offset + 2));
      return concat(out);
    }
    if (marker === 0xff) {
      offset += 1; // fill byte
      continue;
    }
    if (offset + 4 > bytes.length) throw new ImageParseError("Truncated JPEG");
    const length = (bytes[offset + 2]! << 8) | bytes[offset + 3]!;
    const end = offset + 2 + length;
    if (length < 2 || end > bytes.length) throw new ImageParseError("Truncated JPEG segment");
    const drop = marker === 0xe1 || marker === 0xed || marker === 0xfe;
    if (!drop) out.push(bytes.subarray(offset, end));
    offset = end;
  }
  throw new ImageParseError("JPEG has no image data");
}

// PNG: drop textual and EXIF chunks.
const PNG_DROP = new Set(["tEXt", "zTXt", "iTXt", "eXIf", "tIME"]);

function stripPng(bytes: Uint8Array): Uint8Array {
  const out: Uint8Array[] = [bytes.subarray(0, 8)];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = readU32BE(bytes, offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    const end = offset + 12 + length;
    if (end > bytes.length) throw new ImageParseError("Truncated PNG chunk");
    if (!PNG_DROP.has(type)) out.push(bytes.subarray(offset, end));
    offset = end;
    if (type === "IEND") return concat(out);
  }
  throw new ImageParseError("PNG has no IEND chunk");
}

// WebP (RIFF): drop EXIF and XMP chunks, clear their VP8X flags, fix the RIFF size.
function stripWebp(bytes: Uint8Array): Uint8Array {
  const chunks: Uint8Array[] = [];
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const type = String.fromCharCode(...bytes.subarray(offset, offset + 4));
    const size = readU32LE(bytes, offset + 4);
    const end = offset + 8 + size + (size % 2);
    if (offset + 8 + size > bytes.length) throw new ImageParseError("Truncated WebP chunk");
    if (type !== "EXIF" && type !== "XMP ") {
      const chunk = bytes.slice(offset, Math.min(end, bytes.length));
      if (type === "VP8X" && chunk.length > 8) chunk[8] = chunk[8]! & ~(0x08 | 0x04);
      chunks.push(chunk);
    }
    offset = end;
  }
  const body = concat(chunks);
  const header = new Uint8Array(12);
  header.set(bytes.subarray(0, 12));
  const riffSize = body.length + 4;
  header[4] = riffSize & 0xff;
  header[5] = (riffSize >> 8) & 0xff;
  header[6] = (riffSize >> 16) & 0xff;
  header[7] = (riffSize >>> 24) & 0xff;
  return concat([header, body]);
}

function readU32BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset]! << 24) >>> 0) + (bytes[offset + 1]! << 16) + (bytes[offset + 2]! << 8) + bytes[offset + 3]!;
}

function readU32LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! + (bytes[offset + 1]! << 8) + (bytes[offset + 2]! << 16) + ((bytes[offset + 3]! << 24) >>> 0);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
