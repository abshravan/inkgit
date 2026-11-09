import "server-only";
import path from "node:path";
import { z } from "zod";

/**
 * Server-side environment, validated once at first access.
 * Never import this module from client components.
 */
const serverEnvSchema = z.object({
  CONTENT_SOURCE: z.enum(["local"]).default("local"),
  CONTENT_DIR: z.string().min(1).default("content"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema> & { contentRoot: string };

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid server environment: ${z.prettifyError(parsed.error)}`);
  }
  cached = {
    ...parsed.data,
    contentRoot: path.resolve(/* turbopackIgnore: true */ process.cwd(), parsed.data.CONTENT_DIR),
  };
  return cached;
}
