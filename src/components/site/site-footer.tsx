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
        <SocialLinks />
      </Container>
    </footer>
  );
}
