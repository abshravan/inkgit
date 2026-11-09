import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseServerEnv } from "@/lib/env";

/** Minimal .env parser: KEY=VALUE lines, comments and blanks ignored. */
function parseDotenv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) out[match[1]!] = match[2]!.replace(/^"(.*)"$/, "$1");
  }
  return out;
}

describe("server environment", () => {
  it("accepts .env.example as-is (blank optional values count as unset)", () => {
    const env = parseServerEnv(parseDotenv(readFileSync(".env.example", "utf8")));
    expect(env.CONTENT_SOURCE).toBe("local");
    expect(env.MEDIA_STORAGE).toBe("local");
    expect(env.CONTENT_REPO).toBeUndefined();
    expect(env.CONTENT_REPO_PATH).toBe("");
    expect(env.authConfigured).toBe(false);
  });

  it("still validates values that are actually set", () => {
    expect(() => parseServerEnv({ CONTENT_REPO: "not a repo" })).toThrow(/owner\/repo/);
    expect(() => parseServerEnv({ MEDIA_PUBLIC_URL: "http://insecure.example" })).toThrow(/MEDIA_PUBLIC_URL/);
  });

  it("requires the GitHub settings when CONTENT_SOURCE=github", () => {
    expect(() => parseServerEnv({ CONTENT_SOURCE: "github", CONTENT_REPO: "" })).toThrow(/CONTENT_REPO/);
    expect(() => parseServerEnv({ CONTENT_SOURCE: "github", CONTENT_REPO: "you/blog" })).toThrow(
      /CONTENT_GITHUB_TOKEN/,
    );
    expect(
      parseServerEnv({ CONTENT_SOURCE: "github", CONTENT_REPO: "you/blog", CONTENT_GITHUB_TOKEN: "t" }).CONTENT_SOURCE,
    ).toBe("github");
  });

  it("requires all S3 settings when MEDIA_STORAGE=s3", () => {
    expect(() => parseServerEnv({ MEDIA_STORAGE: "s3", MEDIA_S3_BUCKET: "b" })).toThrow(/MEDIA_S3_ENDPOINT/);
  });

  it("reports auth as configured only with every value and at least one admin", () => {
    const auth = { AUTH_SECRET: "s", AUTH_GITHUB_ID: "id", AUTH_GITHUB_SECRET: "secret" };
    expect(parseServerEnv({ ...auth, ADMIN_GITHUB_IDS: "" }).authConfigured).toBe(false);
    expect(parseServerEnv({ ...auth, ADMIN_GITHUB_IDS: "123" }).authConfigured).toBe(true);
  });
});
