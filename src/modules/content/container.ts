import "server-only";
import { siteConfig } from "@/config/site";
import { getServerEnv } from "@/lib/env";
import { LocalFsProvider } from "@/modules/git/local/local-fs-provider";
import type { GitReader } from "@/modules/git/types";
import { ContentService } from "./content-service";

/**
 * Composition root: the only place that knows which concrete provider is used.
 * Swapping to GitHub (Phase 3) only changes `createReader`.
 */
function createReader(): GitReader {
  const env = getServerEnv();
  switch (env.CONTENT_SOURCE) {
    case "local":
      return new LocalFsProvider(env.contentRoot);
  }
}

let service: ContentService | undefined;

export function getContentService(): ContentService {
  service ??= new ContentService(createReader(), {
    defaultAuthor: siteConfig.author.name,
    wordsPerMinute: siteConfig.readingSpeedWpm,
  });
  return service;
}
