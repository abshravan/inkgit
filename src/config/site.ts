/**
 * Public, non-secret site configuration. Safe to import anywhere.
 * Branding values are placeholders until the author provides real ones.
 */
export const siteConfig = {
  name: "InkGit",
  tagline: "Notes from a Git-native blog",
  description: "A developer-focused blog where every article lives in a Git repository. Your repository is your CMS.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  locale: "en",
  author: {
    name: "Admin",
    bio: "Software engineer writing about systems, tooling, and the craft of building software.",
  },
  nav: [
    { href: "/blog", label: "Blog" },
    { href: "/categories", label: "Categories" },
    { href: "/tags", label: "Tags" },
    { href: "/about", label: "About" },
  ],
  social: {
    github: "https://github.com/",
    x: "https://x.com/",
    linkedin: "https://www.linkedin.com/",
  },
  /** Words per minute used for reading-time estimates. */
  readingSpeedWpm: 225,
  homepage: { featuredCount: 3, recentCount: 6 },
} as const;

export type SiteConfig = typeof siteConfig;
