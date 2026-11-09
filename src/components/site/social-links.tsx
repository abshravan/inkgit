import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { GitHubIcon, LinkedInIcon, XIcon } from "./brand-icons";

const links = [
  { href: siteConfig.social.github, label: "GitHub", Icon: GitHubIcon },
  { href: siteConfig.social.x, label: "X (Twitter)", Icon: XIcon },
  { href: siteConfig.social.linkedin, label: "LinkedIn", Icon: LinkedInIcon },
];

export function SocialLinks({ className }: { className?: string }) {
  return (
    <ul className={cn("flex items-center gap-1", className)}>
      {links.map(({ href, label, Icon }) => (
        <li key={label}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Icon className="size-4" />
          </a>
        </li>
      ))}
    </ul>
  );
}
