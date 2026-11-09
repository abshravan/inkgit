import { GitProviderError } from "../types";

/**
 * Minimal GitHub REST client: just `fetch`, JSON, auth and error mapping.
 * `fetch` is injectable so tests can run against an in-memory fake.
 *
 * GET responses are cached by ETag. GitHub doesn't count `304 Not Modified`
 * responses against the rate limit, so polling refs and trees stays cheap.
 */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface GitHubClientOptions {
  /** A static token (PAT) or a function returning a fresh one (GitHub App). */
  token: string | (() => Promise<string>);
  /** Called after a 401 so a token source can drop its cached token. */
  onUnauthorized?: () => void;
  apiBaseUrl?: string;
  fetch?: FetchLike;
  userAgent?: string;
}

export class GitHubApiError extends GitProviderError {
  constructor(
    message: string,
    readonly status: number,
    code: GitProviderError["code"],
  ) {
    super(message, code);
    this.name = "GitHubApiError";
  }
}

interface CachedResponse {
  etag: string;
  body: unknown;
}

const MAX_ETAG_ENTRIES = 500;

export class GitHubClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly etagCache = new Map<string, CachedResponse>();

  constructor(private readonly options: GitHubClientOptions) {
    this.baseUrl = (options.apiBaseUrl ?? "https://api.github.com").replace(/\/+$/, "");
    this.fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
  }

  get<T>(path: string, init: { accept?: string; allow404?: false }): Promise<T>;
  get<T>(path: string, init: { accept?: string; allow404: true }): Promise<T | null>;
  get<T>(path: string): Promise<T>;
  async get<T>(path: string, init: { accept?: string; allow404?: boolean } = {}): Promise<T | null> {
    const cached = this.etagCache.get(path);
    const response = await this.request("GET", path, undefined, {
      ...(init.accept && { Accept: init.accept }),
      ...(cached && { "If-None-Match": cached.etag }),
    });
    if (response.status === 304 && cached) return cached.body as T;
    if (response.status === 404 && init.allow404) return null;
    await this.assertOk(response, "GET", path);
    const body = init.accept?.includes("raw") ? await response.text() : await response.json();
    const etag = response.headers.get("etag");
    if (etag) {
      if (this.etagCache.size >= MAX_ETAG_ENTRIES) this.etagCache.delete(this.etagCache.keys().next().value as string);
      this.etagCache.set(path, { etag, body });
    }
    return body as T;
  }

  async send<T>(method: "POST" | "PATCH", path: string, body: unknown): Promise<T> {
    const response = await this.request(method, path, JSON.stringify(body), { "Content-Type": "application/json" });
    await this.assertOk(response, method, path);
    return (await response.json()) as T;
  }

  private async request(method: string, path: string, body: string | undefined, headers: Record<string, string>) {
    const token = typeof this.options.token === "string" ? this.options.token : await this.options.token();
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        body,
        cache: "no-store",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": this.options.userAgent ?? "InkGit",
          ...headers,
        },
      });
      if (response.status === 401) this.options.onUnauthorized?.();
      return response;
    } catch (error) {
      throw new GitProviderError(`Network error calling GitHub (${method} ${path})`, "io", { cause: error });
    }
  }

  private async assertOk(response: Response, method: string, path: string): Promise<void> {
    if (response.ok) return;
    let detail = "";
    try {
      const data = (await response.json()) as { message?: string };
      detail = data.message ?? "";
    } catch {
      // Non-JSON error body; the status is enough.
    }
    const where = `${method} ${path.split("?")[0]}`;
    const rateLimited =
      response.status === 429 || (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0");
    if (rateLimited) {
      const reset = Number(response.headers.get("x-ratelimit-reset"));
      const when = Number.isFinite(reset) && reset > 0 ? ` until ${new Date(reset * 1000).toISOString()}` : "";
      throw new GitHubApiError(`GitHub rate limit reached${when}`, response.status, "rate_limited");
    }
    if (response.status === 401) {
      throw new GitHubApiError("GitHub rejected the token (401). Check CONTENT_GITHUB_TOKEN.", 401, "io");
    }
    if (response.status === 404) {
      throw new GitHubApiError(`Not found on GitHub: ${where}`, 404, "not_found");
    }
    // Never echo the token or request body; status + GitHub's message is safe.
    throw new GitHubApiError(
      `GitHub ${where} failed (${response.status})${detail ? `: ${detail}` : ""}`,
      response.status,
      "io",
    );
  }
}
