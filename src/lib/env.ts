import "server-only";
import path from "node:path";
import { z } from "zod";
import { parseAdminIds } from "@/modules/auth/admin-allowlist";

/**
 * Server-side environment, validated once at first access.
 * Never import this module from client components.
 */
const optionalSecret = z
  .string()
  .optional()
  .transform((value) => (value && value.trim() ? value.trim() : undefined));

const serverEnvSchema = z
  .object({
    CONTENT_SOURCE: z.enum(["local", "github"]).default("local"),
    CONTENT_DIR: z.string().min(1).default("content"),
    // GitHub content source. The token is a fine-grained PAT (or, later, a GitHub
    // App installation token) with Contents read/write on this one repository.
    CONTENT_REPO: z
      .string()
      .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, "must look like owner/repo")
      .optional(),
    CONTENT_BRANCH: z.string().min(1).default("main"),
    CONTENT_REPO_PATH: z.string().default(""),
    CONTENT_GITHUB_TOKEN: optionalSecret,
    GITHUB_API_URL: z.url().default("https://api.github.com"),
    GITHUB_WEBHOOK_SECRET: optionalSecret,
    // Auth.js reads AUTH_SECRET / AUTH_GITHUB_ID / AUTH_GITHUB_SECRET itself;
    // they're validated here only to report whether the admin is usable.
    AUTH_SECRET: optionalSecret,
    AUTH_GITHUB_ID: optionalSecret,
    AUTH_GITHUB_SECRET: optionalSecret,
    ADMIN_GITHUB_IDS: z.string().optional(),
    // Media storage: "local" (public/media, development) or "s3" (R2/S3-compatible).
    MEDIA_STORAGE: z.enum(["local", "s3"]).default("local"),
    MEDIA_DIR: z.string().min(1).default("media-uploads"),
    MEDIA_MAX_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .max(20 * 1024 * 1024)
      .default(5 * 1024 * 1024),
    MEDIA_S3_ENDPOINT: z.url().optional(),
    MEDIA_S3_BUCKET: z.string().min(1).optional(),
    MEDIA_S3_REGION: z.string().min(1).default("auto"),
    MEDIA_S3_ACCESS_KEY_ID: optionalSecret,
    MEDIA_S3_SECRET_ACCESS_KEY: optionalSecret,
    MEDIA_PUBLIC_URL: z.url({ protocol: /^https$/ }).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.MEDIA_STORAGE === "s3") {
      for (const key of [
        "MEDIA_S3_ENDPOINT",
        "MEDIA_S3_BUCKET",
        "MEDIA_S3_ACCESS_KEY_ID",
        "MEDIA_S3_SECRET_ACCESS_KEY",
        "MEDIA_PUBLIC_URL",
      ] as const) {
        if (!env[key]) ctx.addIssue({ code: "custom", path: [key], message: "is required when MEDIA_STORAGE=s3" });
      }
    }
    if (env.CONTENT_SOURCE !== "github") return;
    if (!env.CONTENT_REPO)
      ctx.addIssue({ code: "custom", path: ["CONTENT_REPO"], message: "is required when CONTENT_SOURCE=github" });
    if (!env.CONTENT_GITHUB_TOKEN) {
      ctx.addIssue({
        code: "custom",
        path: ["CONTENT_GITHUB_TOKEN"],
        message: "is required when CONTENT_SOURCE=github",
      });
    }
  });

export type ServerEnv = Omit<z.infer<typeof serverEnvSchema>, "ADMIN_GITHUB_IDS"> & {
  contentRoot: string;
  mediaRoot: string;
  adminGithubIds: ReadonlySet<string>;
  /** True when GitHub sign-in can work and at least one admin is configured. */
  authConfigured: boolean;
};

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid server environment: ${z.prettifyError(parsed.error)}`);
  }
  const { ADMIN_GITHUB_IDS, ...rest } = parsed.data;
  const adminGithubIds = parseAdminIds(ADMIN_GITHUB_IDS);
  cached = {
    ...rest,
    contentRoot: path.resolve(/* turbopackIgnore: true */ process.cwd(), rest.CONTENT_DIR),
    mediaRoot: path.resolve(/* turbopackIgnore: true */ process.cwd(), rest.MEDIA_DIR),
    adminGithubIds,
    authConfigured: Boolean(
      rest.AUTH_SECRET && rest.AUTH_GITHUB_ID && rest.AUTH_GITHUB_SECRET && adminGithubIds.size > 0,
    ),
  };
  return cached;
}
