import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isRelevantPush, verifyGitHubSignature } from "@/modules/webhooks/github-webhook";

const sign = (secret: string, body: string) => `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

describe("verifyGitHubSignature", () => {
  const body = '{"zen":"Keep it logically awesome."}';
  it("accepts a valid signature", () => expect(verifyGitHubSignature("s3cret", body, sign("s3cret", body))).toBe(true));
  it.each([
    ["wrong secret", sign("other", body)],
    ["tampered body", sign("s3cret", `${body} `)],
    ["missing header", null],
    ["sha1 header", "sha1=abc"],
    ["garbage", "sha256=zz"],
    ["truncated", sign("s3cret", body).slice(0, 20)],
  ])("rejects %s", (_name, header) => expect(verifyGitHubSignature("s3cret", body, header)).toBe(false));
  it("rejects when no secret is configured", () => expect(verifyGitHubSignature("", body, sign("", body))).toBe(false));
});

describe("isRelevantPush", () => {
  const config = { repository: "acme/blog", branch: "main", contentPath: "content" };
  const push = (overrides: Record<string, unknown> = {}) => ({
    ref: "refs/heads/main",
    repository: { full_name: "Acme/Blog" },
    commits: [{ added: [], modified: ["content/posts/a.mdx"], removed: [] }],
    ...overrides,
  });
  it("accepts content changes on the configured branch", () => expect(isRelevantPush(push(), config)).toBe(true));
  it("ignores other branches and repositories", () => {
    expect(isRelevantPush(push({ ref: "refs/heads/dev" }), config)).toBe(false);
    expect(isRelevantPush(push({ repository: { full_name: "evil/blog" } }), config)).toBe(false);
  });
  it("ignores pushes that don't touch content", () => {
    expect(isRelevantPush(push({ commits: [{ modified: ["README.md"] }] }), config)).toBe(false);
  });
  it("refreshes when file lists are unavailable", () => {
    expect(isRelevantPush(push({ commits: [] }), config)).toBe(true);
  });
  it("treats every file as content when the content path is the root", () => {
    expect(isRelevantPush(push({ commits: [{ modified: ["README.md"] }] }), { ...config, contentPath: "" })).toBe(true);
  });
  it("rejects malformed payloads", () => {
    expect(isRelevantPush(null, config)).toBe(false);
    expect(isRelevantPush("push", config)).toBe(false);
  });
});
