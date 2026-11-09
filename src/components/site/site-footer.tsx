import { Rss } from "lucide-react";
import { siteConfig } from "@/config/site";
import { Container } from "./container";
import { SocialLinks } from "./social-links";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t">
      <Container className="flex flex-col gap-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          {siteConfig.name} — content versioned in Git. Written by {siteConfig.author.name}.
        </p>
        <div className="flex items-center gap-3">
          <a href="/rss.xml" className="flex items-center gap-1.5 hover:text-foreground">
            <Rss className="size-4" aria-hidden /> RSS
          </a>
          <SocialLinks />
        </div>
      </Container>
    </footer>
  );
}
