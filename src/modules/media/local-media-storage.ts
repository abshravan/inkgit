import { promises as fs } from "node:fs";
import path from "node:path";
import { assertMediaKey, MEDIA_KEY_PATTERN, type MediaObject, type MediaStorage } from "./storage";

/**
 * Stores images in a local folder (default `media-uploads/`), served at
 * `/media/...` by the `app/media/[...key]` route. For development and
 * single-server hosting; serverless production uses S3-compatible storage.
 */
export class LocalMediaStorage implements MediaStorage {
  readonly id = "local";

  constructor(
    private readonly root: string,
    private readonly urlPrefix = "/media",
  ) {}

  async put(key: string, bytes: Uint8Array): Promise<void> {
    const target = path.join(this.root, assertMediaKey(key));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, bytes);
  }

  async list(): Promise<MediaObject[]> {
    const objects: MediaObject[] = [];
    const walk = async (dir: string, prefix: string) => {
      let entries: import("node:fs").Dirent[];
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const key = `${prefix}${entry.name}`;
        if (entry.isDirectory()) await walk(path.join(dir, entry.name), `${key}/`);
        else if (MEDIA_KEY_PATTERN.test(key)) {
          const stat = await fs.stat(path.join(dir, entry.name));
          objects.push({ key, size: stat.size, uploadedAt: stat.mtime.toISOString(), url: this.publicUrl(key) });
        }
      }
    };
    await walk(this.root, "");
    return objects.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  }

  async delete(key: string): Promise<void> {
    await fs.rm(path.join(this.root, assertMediaKey(key)), { force: true });
  }

  publicUrl(key: string): string {
    return `${this.urlPrefix}/${key}`;
  }
}
