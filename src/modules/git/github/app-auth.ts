import { createSign } from "node:crypto";
import { GitProviderError } from "../types";
import type { FetchLike } from "./github-client";

const base64url = (input: string | Buffer) => Buffer.from(input).toString("base64url");

/**
 * App JWT (RS256) used only to request installation tokens. GitHub allows a
 * 10-minute lifetime; `iat` is backdated 60 s to tolerate clock drift.
 */
export function createAppJwt(appId: string, privateKeyPem: string, nowSeconds: number): string {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({ iat: nowSeconds - 60, exp: nowSeconds + 9 * 60, iss: appId }));
  const signature = createSign("RSA-SHA256").update(`${header}.${payload}`).sign(privateKeyPem);
  return `${header}.${payload}.${base64url(signature)}`;
}

export interface GitHubAppOptions {
  appId: string;
  installationId: string;
  /** PEM private key; `\n` escapes (as stored in env vars) are accepted. */
  privateKey: string;
  /** Repository name (without owner) the token is restricted to. */
  repository: string;
  apiBaseUrl?: string;
  fetch?: FetchLike;
  now?: () => number;
}

const REFRESH_MARGIN_MS = 5 * 60 * 1000;

/**
 * Supplies short-lived installation tokens scoped to one repository with
 * `contents: write` only (least privilege), cached until shortly before expiry.
 */
export class GitHubAppTokenSource {
  private cached: { token: string; expiresAt: number } | null = null;
  private inFlight: Promise<string> | null = null;
  private readonly privateKey: string;

  constructor(private readonly options: GitHubAppOptions) {
    if (!/^\d+$/.test(options.appId) || !/^\d+$/.test(options.installationId)) {
      throw new GitProviderError("GITHUB_APP_ID and GITHUB_APP_INSTALLATION_ID must be numeric", "io");
    }
    this.privateKey = options.privateKey.includes("\\n")
      ? options.privateKey.replace(/\\n/g, "\n")
      : options.privateKey;
  }

  /** Forget the cached token (e.g. after a 401). */
  invalidate(): void {
    this.cached = null;
  }

  getToken = async (): Promise<string> => {
    const now = (this.options.now ?? Date.now)();
    if (this.cached && this.cached.expiresAt - REFRESH_MARGIN_MS > now) return this.cached.token;
    this.inFlight ??= this.fetchToken(now).finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  };

  private async fetchToken(now: number): Promise<string> {
    const base = (this.options.apiBaseUrl ?? "https://api.github.com").replace(/\/+$/, "");
    const jwt = createAppJwt(this.options.appId, this.privateKey, Math.floor(now / 1000));
    const fetchImpl = this.options.fetch ?? ((input, init) => fetch(input, init));
    let response: Response;
    try {
      response = await fetchImpl(`${base}/app/installations/${this.options.installationId}/access_tokens`, {
        method: "POST",
        cache: "no-store",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${jwt}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
          "User-Agent": "InkGit",
        },
        body: JSON.stringify({ repositories: [this.options.repository], permissions: { contents: "write" } }),
      });
    } catch (error) {
      throw new GitProviderError("Network error requesting a GitHub App token", "io", { cause: error });
    }
    if (!response.ok) {
      throw new GitProviderError(
        `GitHub App token request failed (${response.status}). Check the app ID, installation and key.`,
        "io",
      );
    }
    const data = (await response.json()) as { token?: string; expires_at?: string };
    if (!data.token || !data.expires_at) throw new GitProviderError("GitHub App token response was incomplete", "io");
    this.cached = { token: data.token, expiresAt: Date.parse(data.expires_at) };
    return data.token;
  }
}
