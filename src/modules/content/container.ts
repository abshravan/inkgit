import "server-only";
import { siteConfig } from "@/config/site";
import { getServerEnv } from "@/lib/env";
import { GitHubAppTokenSource } from "@/modules/git/github/app-auth";
import { GitHubClient } from "@/modules/git/github/github-client";
import { GitHubProvider } from "@/modules/git/github/github-provider";
import { LocalFsProvider } from "@/modules/git/local/local-fs-provider";
import type { GitProvider } from "@/modules/git/types";
import { LocalMediaStorage } from "@/modules/media/local-media-storage";
import { MediaService } from "@/modules/media/media-service";
import { S3MediaStorage } from "@/modules/media/s3-media-storage";
import type { MediaStorage } from "@/modules/media/storage";
import { EditorialService } from "@/modules/publishing/editorial-service";
import { TaxonomyService } from "@/modules/publishing/taxonomy-service";
import { ContentService } from "./content-service";

/**
 * Composition root: the only place that knows which concrete provider is used.
 * Swapping to GitHub (Phase 3) only changes `createProvider`.
 */
function createProvider(): GitProvider {
  const env = getServerEnv();
  switch (env.CONTENT_SOURCE) {
    case "local":
      return new LocalFsProvider(env.contentRoot);
    case "github": {
      // Validated by the env schema: both are present when CONTENT_SOURCE=github.
      const [owner = "", repo = ""] = (env.CONTENT_REPO ?? "").split("/");
      // Prefer a GitHub App (short-lived, repo-scoped tokens) over a PAT when configured.
      const app =
        env.GITHUB_APP_ID && env.GITHUB_APP_INSTALLATION_ID && env.GITHUB_APP_PRIVATE_KEY
          ? new GitHubAppTokenSource({
              appId: env.GITHUB_APP_ID,
              installationId: env.GITHUB_APP_INSTALLATION_ID,
              privateKey: env.GITHUB_APP_PRIVATE_KEY,
              repository: repo,
              apiBaseUrl: env.GITHUB_API_URL,
            })
          : null;
      const client = new GitHubClient({
        token: app ? app.getToken : (env.CONTENT_GITHUB_TOKEN ?? ""),
        ...(app && { onUnauthorized: () => app.invalidate() }),
        apiBaseUrl: env.GITHUB_API_URL,
      });
      return new GitHubProvider({ owner, repo, branch: env.CONTENT_BRANCH, contentPath: env.CONTENT_REPO_PATH, client });
    }
  }
}

const todayUtc = () => new Date().toISOString().slice(0, 10);

let provider: GitProvider | undefined;
let contentService: ContentService | undefined;
let editorialService: EditorialService | undefined;

export function getProvider(): GitProvider {
  provider ??= createProvider();
  return provider;
}

export function getContentService(): ContentService {
  contentService ??= new ContentService(getProvider(), {
    defaultAuthor: siteConfig.author.name,
    wordsPerMinute: siteConfig.readingSpeedWpm,
  });
  return contentService;
}

/** Human-readable description of where content lives, for the admin UI. */
export function describeContentSource(): { kind: "local" | "github"; label: string; url: string | null } {
  const env = getServerEnv();
  if (env.CONTENT_SOURCE === "github") {
    const path = env.CONTENT_REPO_PATH.replace(/^\/+|\/+$/g, "");
    return {
      kind: "github",
      label: `${env.CONTENT_REPO}@${env.CONTENT_BRANCH}${path ? `/${path}` : ""}`,
      url: `https://github.com/${env.CONTENT_REPO}/tree/${env.CONTENT_BRANCH}${path ? `/${path}` : ""}`,
    };
  }
  return { kind: "local", label: `Local folder (${env.CONTENT_DIR})`, url: null };
}

export function getEditorialService(): EditorialService {
  editorialService ??= new EditorialService(getProvider(), getContentService(), { today: todayUtc });
  return editorialService;
}

let taxonomyService: TaxonomyService | undefined;

export function getTaxonomyService(): TaxonomyService {
  taxonomyService ??= new TaxonomyService(getProvider(), getContentService());
  return taxonomyService;
}

function createMediaStorage(): MediaStorage {
  const env = getServerEnv();
  if (env.MEDIA_STORAGE === "s3") {
    // Presence of these values is validated by the env schema.
    return new S3MediaStorage({
      endpoint: env.MEDIA_S3_ENDPOINT ?? "",
      bucket: env.MEDIA_S3_BUCKET ?? "",
      region: env.MEDIA_S3_REGION,
      accessKeyId: env.MEDIA_S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: env.MEDIA_S3_SECRET_ACCESS_KEY ?? "",
      publicUrl: env.MEDIA_PUBLIC_URL ?? "",
    });
  }
  return new LocalMediaStorage(env.mediaRoot);
}

let mediaService: MediaService | undefined;

export function getMediaService(): MediaService {
  mediaService ??= new MediaService(createMediaStorage(), { maxBytes: getServerEnv().MEDIA_MAX_BYTES });
  return mediaService;
}
