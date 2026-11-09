import "server-only";
import { siteConfig } from "@/config/site";
import { getServerEnv } from "@/lib/env";
import { LocalFsProvider } from "@/modules/git/local/local-fs-provider";
import type { GitProvider } from "@/modules/git/types";
import { EditorialService } from "@/modules/publishing/editorial-service";
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
  }
}

const todayUtc = () => new Date().toISOString().slice(0, 10);

let provider: GitProvider | undefined;
let contentService: ContentService | undefined;
let editorialService: EditorialService | undefined;

function getProvider(): GitProvider {
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

export function getEditorialService(): EditorialService {
  editorialService ??= new EditorialService(getProvider(), getContentService(), { today: todayUtc });
  return editorialService;
}
