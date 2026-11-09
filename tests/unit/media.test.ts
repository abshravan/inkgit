import { describe, expect, it } from "vitest";
import { detectImageFormat } from "@/modules/media/image-format";
import { MediaService } from "@/modules/media/media-service";
import type { MediaObject, MediaStorage } from "@/modules/media/storage";
import { ImageParseError, stripImageMetadata } from "@/modules/media/strip-metadata";
import type { Article } from "@/modules/content/types";

const bytes = (...parts: Array<number[] | string>) =>
  Uint8Array.from(parts.flatMap((part) => (typeof part === "string" ? [...Buffer.from(part, "latin1")] : part)));
const u16 = (n: number) => [(n >> 8) & 0xff, n & 0xff];
const u32be = (n: number) => [(n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
const u32le = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
const text = (u: Uint8Array) => Buffer.from(u).toString("latin1");

const jpegSegment = (marker: number, payload: string) => [
  0xff,
  marker,
  ...u16(payload.length + 2),
  ...Buffer.from(payload, "latin1"),
];
const JPEG = bytes(
  [0xff, 0xd8],
  jpegSegment(0xe0, "JFIF\0\x01\x01\0\0\x01\0\x01\0\0"),
  jpegSegment(0xe1, "Exif\0\0GPSLatitude=51.5"),
  jpegSegment(0xe2, "ICC_PROFILE\0keep"),
  jpegSegment(0xfe, "secret comment"),
  jpegSegment(0xdb, "quant"),
  [0xff, 0xda],
  "scan-data",
  [0xff, 0xd9],
);

const pngChunk = (type: string, data: string) => [
  ...u32be(data.length),
  ...Buffer.from(type + data, "latin1"),
  0,
  0,
  0,
  0,
];
const PNG = bytes(
  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  pngChunk("IHDR", "0123456789abc"),
  pngChunk("tEXt", "Author\0Someone"),
  pngChunk("eXIf", "GPS"),
  pngChunk("IDAT", "pixels"),
  pngChunk("IEND", ""),
);

const webpChunk = (type: string, data: number[]) => [
  ...Buffer.from(type, "latin1"),
  ...u32le(data.length),
  ...data,
  ...(data.length % 2 ? [0] : []),
];
const webpBody = [
  ...Buffer.from("WEBP", "latin1"),
  ...webpChunk("VP8X", [0x0c, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  ...webpChunk("VP8 ", [1, 2, 3, 4]),
  ...webpChunk("EXIF", [...Buffer.from("GPS", "latin1")]),
];
const WEBP = bytes("RIFF", u32le(webpBody.length), webpBody);

describe("detectImageFormat", () => {
  it("recognizes formats by content", () => {
    expect(detectImageFormat(JPEG)).toBe("jpeg");
    expect(detectImageFormat(PNG)).toBe("png");
    expect(detectImageFormat(WEBP)).toBe("webp");
    expect(detectImageFormat(bytes("GIF89a", [0, 0, 0, 0, 0, 0]))).toBe("gif");
    expect(detectImageFormat(bytes(u32be(28), "ftypavif", [0, 0, 0, 0], "mif1miaf"))).toBe("avif");
  });

  it("rejects SVG, HTML and disguised files", () => {
    expect(
      detectImageFormat(bytes('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')),
    ).toBeNull();
    expect(detectImageFormat(bytes("<!doctype html><html></html>"))).toBeNull();
    expect(detectImageFormat(bytes("MZ\x90\0 not an image at all"))).toBeNull();
    expect(detectImageFormat(bytes([0xff, 0xd8]))).toBeNull();
  });
});

describe("stripImageMetadata", () => {
  it("removes EXIF and comments from JPEG but keeps the colour profile and image data", () => {
    const out = text(stripImageMetadata(JPEG, "jpeg"));
    expect(out).not.toContain("GPSLatitude");
    expect(out).not.toContain("secret comment");
    expect(out).toContain("ICC_PROFILE");
    expect(out).toContain("JFIF");
    expect(out).toContain("scan-data");
  });

  it("removes text and EXIF chunks from PNG", () => {
    const out = text(stripImageMetadata(PNG, "png"));
    expect(out).not.toContain("Someone");
    expect(out).not.toContain("eXIf");
    expect(out).toContain("IHDR");
    expect(out).toContain("IDAT");
    expect(out).toContain("IEND");
  });

  it("removes EXIF from WebP, clears the VP8X flag and fixes the RIFF size", () => {
    const out = stripImageMetadata(WEBP, "webp");
    expect(text(out)).not.toContain("EXIF");
    expect(out[4]! | (out[5]! << 8) | (out[6]! << 16)).toBe(out.length - 8);
    const vp8x = text(out).indexOf("VP8X");
    expect(out[vp8x + 8]! & 0x08).toBe(0);
  });

  it("rejects truncated files instead of passing them through", () => {
    expect(() => stripImageMetadata(JPEG.subarray(0, 12), "jpeg")).toThrow(ImageParseError);
    expect(() => stripImageMetadata(PNG.subarray(0, 30), "png")).toThrow(ImageParseError);
  });
});

class MemoryStorage implements MediaStorage {
  readonly id = "memory";
  objects = new Map<string, { bytes: Uint8Array; type: string }>();
  async put(key: string, data: Uint8Array, type: string) {
    this.objects.set(key, { bytes: data, type });
  }
  async list(): Promise<MediaObject[]> {
    return [...this.objects].map(([key, { bytes: b }]) => ({
      key,
      size: b.length,
      uploadedAt: "2026-11-09T00:00:00Z",
      url: this.publicUrl(key),
    }));
  }
  async delete(key: string) {
    this.objects.delete(key);
  }
  publicUrl(key: string) {
    return `https://media.example.com/media/${key}`;
  }
}

describe("MediaService", () => {
  const make = () => {
    const storage = new MemoryStorage();
    const service = new MediaService(storage, { maxBytes: 1024, now: () => new Date("2026-11-09T12:00:00Z") });
    return { storage, service };
  };

  it("stores stripped images under content-hash keys and deduplicates", async () => {
    const { storage, service } = make();
    const first = await service.upload(JPEG);
    const second = await service.upload(JPEG);
    expect(first.ok && first.media.key).toMatch(/^2026\/11\/[0-9a-f]{16}\.jpg$/);
    expect(second.ok && second.media.key).toBe(first.ok && first.media.key);
    expect(storage.objects.size).toBe(1);
    const stored = [...storage.objects.values()][0]!;
    expect(stored.type).toBe("image/jpeg");
    expect(text(stored.bytes)).not.toContain("GPSLatitude");
  });

  it("enforces size and type limits", async () => {
    const { service } = make();
    expect(await service.upload(new Uint8Array(2048))).toMatchObject({ ok: false, status: 413 });
    expect(await service.upload(bytes("<svg onload=alert(1)></svg>"))).toMatchObject({ ok: false, status: 415 });
    expect(await service.upload(new Uint8Array())).toMatchObject({ ok: false, status: 400 });
  });

  it("refuses to delete images that articles still use", async () => {
    const { storage, service } = make();
    const uploaded = await service.upload(PNG);
    const key = uploaded.ok ? uploaded.media.key : "";
    const articles = [
      { slug: "post", body: `![x](https://media.example.com/media/${key})`, coverImage: undefined },
    ] as unknown as Article[];
    expect((await service.listWithUsage(articles))[0]?.usedBy).toEqual(["post"]);
    expect(await service.delete(key, articles)).toMatchObject({ ok: false });
    expect(await service.delete(key, [])).toEqual({ ok: true });
    expect(storage.objects.size).toBe(0);
    expect(await service.delete("../../etc/passwd", [])).toMatchObject({ ok: false });
  });
});
