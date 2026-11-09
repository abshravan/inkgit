import { promises as fs } from "node:fs";
import path from "node:path";
import { connection } from "next/server";
import { getServerEnv } from "@/lib/env";
import { MEDIA_KEY_PATTERN } from "@/modules/media/storage";

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
};

/**
 * Serves locally stored media (MEDIA_STORAGE=local). Files uploaded at runtime
 * can't live in `public/` because `next start` only serves files that existed
 * at build time. With S3/R2 storage, images are served by the bucket's domain.
 */
export async function GET(_request: Request, { params }: RouteContext<"/media/[...key]">): Promise<Response> {
  await connection();
  const env = getServerEnv();
  const key = (await params).key.join("/");
  if (env.MEDIA_STORAGE !== "local" || !MEDIA_KEY_PATTERN.test(key)) return new Response("Not found", { status: 404 });
  try {
    const bytes = await fs.readFile(path.join(env.mediaRoot, key));
    return new Response(bytes, {
      headers: {
        "Content-Type": CONTENT_TYPES[key.split(".").pop() ?? ""] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
