export interface MediaObject {
  /** Storage key, e.g. `2026/11/3f2a9c1b7d4e5f60.webp`. */
  key: string;
  size: number;
  /** ISO timestamp. */
  uploadedAt: string;
  url: string;
}

/** Object storage for images. Keys are always generated server-side. */
export interface MediaStorage {
  readonly id: string;
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  list(): Promise<MediaObject[]>;
  delete(key: string): Promise<void>;
  publicUrl(key: string): string;
}

/** `yyyy/mm/<16 hex>.<ext>` — the only shape a key may have. */
export const MEDIA_KEY_PATTERN = /^\d{4}\/\d{2}\/[0-9a-f]{16}\.(png|jpg|gif|webp|avif)$/;

export function assertMediaKey(key: string): string {
  if (!MEDIA_KEY_PATTERN.test(key)) throw new Error("Invalid media key");
  return key;
}
