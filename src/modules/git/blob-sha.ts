import { createHash } from "node:crypto";

/** Computes the Git blob SHA-1 (`git hash-object`) for UTF-8 content. */
export function gitBlobSha(content: string): string {
  const body = Buffer.from(content, "utf8");
  return createHash("sha1").update(`blob ${body.byteLength}\0`).update(body).digest("hex");
}
