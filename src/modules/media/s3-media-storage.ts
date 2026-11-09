import { AwsClient } from "aws4fetch";
import { assertMediaKey, MEDIA_KEY_PATTERN, type MediaObject, type MediaStorage } from "./storage";

export interface S3MediaStorageOptions {
  /** e.g. https://<account-id>.r2.cloudflarestorage.com */
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Public base URL for reads, e.g. https://media.example.com */
  publicUrl: string;
  /** Folder inside the bucket. */
  prefix?: string;
  fetch?: typeof fetch;
}

/**
 * S3-compatible storage (Cloudflare R2, AWS S3, MinIO…) via signed requests.
 * Uses aws4fetch (SigV4 signing over fetch) instead of the full AWS SDK.
 */
export class S3MediaStorage implements MediaStorage {
  readonly id = "s3";
  private readonly client: AwsClient;
  private readonly base: string;
  private readonly prefix: string;

  constructor(private readonly options: S3MediaStorageOptions) {
    this.client = new AwsClient({
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
      service: "s3",
      region: options.region,
    });
    this.base = `${options.endpoint.replace(/\/+$/, "")}/${encodeURIComponent(options.bucket)}`;
    this.prefix = (options.prefix ?? "media").replace(/^\/+|\/+$/g, "");
  }

  async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    const response = await this.client.fetch(`${this.base}/${this.objectName(key)}`, {
      method: "PUT",
      body: new Blob([bytes as Uint8Array<ArrayBuffer>]),
      headers: {
        "Content-Type": contentType,
        // Keys are content hashes, so objects never change.
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
    if (!response.ok) throw new Error(`Upload failed (${response.status})`);
  }

  async list(): Promise<MediaObject[]> {
    const objects: MediaObject[] = [];
    let token: string | null = null;
    do {
      const params = new URLSearchParams({ "list-type": "2", prefix: `${this.prefix}/`, "max-keys": "1000" });
      if (token) params.set("continuation-token", token);
      const response = await this.client.fetch(`${this.base}?${params.toString()}`);
      if (!response.ok) throw new Error(`Listing media failed (${response.status})`);
      const xml = await response.text();
      for (const block of xml.match(/<Contents>[\s\S]*?<\/Contents>/g) ?? []) {
        const name = decodeXml(tag(block, "Key"));
        const key = name.slice(this.prefix.length + 1);
        if (!MEDIA_KEY_PATTERN.test(key)) continue;
        objects.push({
          key,
          size: Number(tag(block, "Size")),
          uploadedAt: tag(block, "LastModified"),
          url: this.publicUrl(key),
        });
      }
      token = tag(xml, "IsTruncated") === "true" ? decodeXml(tag(xml, "NextContinuationToken")) || null : null;
    } while (token);
    return objects.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  }

  async delete(key: string): Promise<void> {
    const response = await this.client.fetch(`${this.base}/${this.objectName(key)}`, { method: "DELETE" });
    if (!response.ok && response.status !== 404) throw new Error(`Delete failed (${response.status})`);
  }

  publicUrl(key: string): string {
    return `${this.options.publicUrl.replace(/\/+$/, "")}/${this.prefix}/${key}`;
  }

  private objectName(key: string): string {
    return `${this.prefix}/${assertMediaKey(key)}`;
  }
}

function tag(xml: string, name: string): string {
  return new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(xml)?.[1] ?? "";
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
