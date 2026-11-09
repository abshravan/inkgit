import { createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createAppJwt, GitHubAppTokenSource } from "@/modules/git/github/app-auth";
import { GitHubClient } from "@/modules/git/github/github-client";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

describe("createAppJwt", () => {
  it("produces a verifiable RS256 JWT with backdated iat and ≤10 min lifetime", () => {
    const jwt = createAppJwt("12345", pem, 1_800_000_000);
    const [header, payload, signature] = jwt.split(".");
    expect(JSON.parse(Buffer.from(header!, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
    const claims = JSON.parse(Buffer.from(payload!, "base64url").toString());
    expect(claims).toEqual({ iat: 1_800_000_000 - 60, exp: 1_800_000_000 + 540, iss: "12345" });
    expect(claims.exp - claims.iat).toBeLessThanOrEqual(600);
    const ok = createVerify("RSA-SHA256")
      .update(`${header}.${payload}`)
      .verify(publicKey, Buffer.from(signature!, "base64url"));
    expect(ok).toBe(true);
  });
});

describe("GitHubAppTokenSource", () => {
  const setup = (now: { t: number }) => {
    const calls: Array<{ url: string; body: unknown; auth: string }> = [];
    let issued = 0;
    const source = new GitHubAppTokenSource({
      appId: "12345",
      installationId: "678",
      privateKey: pem.replace(/\n/g, "\\n"), // as stored in an env var
      repository: "blog-content",
      now: () => now.t,
      fetch: async (url, init) => {
        calls.push({
          url,
          body: JSON.parse(String(init?.body)),
          auth: new Headers(init?.headers).get("authorization") ?? "",
        });
        issued++;
        return Response.json(
          { token: `ghs_token_${issued}`, expires_at: new Date(now.t + 60 * 60 * 1000).toISOString() },
          { status: 201 },
        );
      },
    });
    return { source, calls };
  };

  it("requests a repository-scoped, contents-only token and caches it", async () => {
    const now = { t: Date.parse("2026-11-09T12:00:00Z") };
    const { source, calls } = setup(now);
    const [a, b] = await Promise.all([source.getToken(), source.getToken()]);
    expect(a).toBe("ghs_token_1");
    expect(b).toBe("ghs_token_1");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      url: "https://api.github.com/app/installations/678/access_tokens",
      body: { repositories: ["blog-content"], permissions: { contents: "write" } },
    });
    expect(calls[0]!.auth).toMatch(/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/);
  });

  it("refreshes shortly before expiry and after invalidation", async () => {
    const now = { t: Date.parse("2026-11-09T12:00:00Z") };
    const { source } = setup(now);
    await source.getToken();
    now.t += 50 * 60 * 1000; // 10 minutes left → still fine
    expect(await source.getToken()).toBe("ghs_token_1");
    now.t += 6 * 60 * 1000; // inside the 5-minute margin
    expect(await source.getToken()).toBe("ghs_token_2");
    source.invalidate();
    expect(await source.getToken()).toBe("ghs_token_3");
  });

  it("is used by the GitHub client, which drops it after a 401", async () => {
    const now = { t: Date.parse("2026-11-09T12:00:00Z") };
    const { source } = setup(now);
    let invalidated = false;
    const seen: string[] = [];
    const client = new GitHubClient({
      token: source.getToken,
      onUnauthorized: () => {
        invalidated = true;
        source.invalidate();
      },
      fetch: async (_url, init) => {
        seen.push(new Headers(init?.headers).get("authorization") ?? "");
        return Response.json({ message: "Bad credentials" }, { status: 401 });
      },
    });
    await expect(client.get("/repos/a/b/git/ref/heads/main")).rejects.toThrow(/401/);
    expect(seen[0]).toBe("Bearer ghs_token_1");
    expect(invalidated).toBe(true);
  });

  it("rejects non-numeric IDs", () => {
    expect(
      () => new GitHubAppTokenSource({ appId: "abc", installationId: "1", privateKey: pem, repository: "r" }),
    ).toThrow();
  });
});
