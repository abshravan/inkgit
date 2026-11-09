import { createHash } from "node:crypto";
import type { Article } from "@/modules/content/types";
import { detectImageFormat, IMAGE_EXTENSION, IMAGE_MIME, type ImageFormat } from "./image-format";
import { assertMediaKey, type MediaObject, type MediaStorage } from "./storage";
import { ImageParseError, stripImageMetadata } from "./strip-metadata";

export interface UploadedMedia {
  key: string;
  url: string;
  size: number;
  format: ImageFormat;
}

export type UploadResult = { ok: true; media: UploadedMedia } | { ok: false; status: 400 | 413 | 415; message: string };

export interface MediaWithUsage extends MediaObject {
  /** Slugs of articles referencing this file (body or cover image). */
  usedBy: string[];
}

export type DeleteMediaResult = { ok: true } | { ok: false; message: string };

export class MediaService {
  constructor(
    private readonly storage: MediaStorage,
    private readonly options: { maxBytes: number; now?: () => Date },
  ) {}

  get maxBytes(): number {
    return this.options.maxBytes;
  }

  async upload(input: Uint8Array): Promise<UploadResult> {
    if (input.byteLength === 0) return { ok: false, status: 400, message: "The file is empty." };
    if (input.byteLength > this.options.maxBytes) {
      return {
        ok: false,
        status: 413,
        message: `Images are limited to ${Math.round(this.options.maxBytes / 1024 / 1024)} MB.`,
      };
    }
    const format = detectImageFormat(input);
    if (!format) return { ok: false, status: 415, message: "Only PNG, JPEG, GIF, WebP and AVIF images are allowed." };

    let bytes: Uint8Array;
    try {
      bytes = stripImageMetadata(input, format);
    } catch (error) {
      if (error instanceof ImageParseError) return { ok: false, status: 400, message: "The image file is damaged." };
      throw error;
    }

    // Content-addressed: the same image always gets the same key (dedupe), and
    // user-supplied file names never reach storage.
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
    const now = (this.options.now ?? (() => new Date()))();
    const key = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${hash}.${IMAGE_EXTENSION[format]}`;
    await this.storage.put(key, bytes, IMAGE_MIME[format]);
    return { ok: true, media: { key, url: this.storage.publicUrl(key), size: bytes.byteLength, format } };
  }

  async listWithUsage(articles: readonly Article[]): Promise<MediaWithUsage[]> {
    const objects = await this.storage.list();
    return objects.map((object) => ({ ...object, usedBy: findUsage(object, articles) }));
  }

  /** Refuses to delete files that published or draft articles still reference. */
  async delete(key: string, articles: readonly Article[]): Promise<DeleteMediaResult> {
    try {
      assertMediaKey(key);
    } catch {
      return { ok: false, message: "Invalid media key." };
    }
    const object = { key, url: this.storage.publicUrl(key) };
    const usedBy = findUsage(object, articles);
    if (usedBy.length) return { ok: false, message: `Still used by: ${usedBy.join(", ")}` };
    await this.storage.delete(key);
    return { ok: true };
  }
}

function findUsage(object: Pick<MediaObject, "key" | "url">, articles: readonly Article[]): string[] {
  return articles
    .filter((article) => article.body.includes(object.key) || article.coverImage?.includes(object.key))
    .map((article) => article.slug);
}
