import type { Metadata, Viewport } from "next";
import { InlineScript } from "@/components/site/inline-script";
import { siteConfig } from "@/config/site";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { fontMono, fontSans } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: siteConfig.name, template: `%s · ${siteConfig.name}` },
  description: siteConfig.description,
  authors: [{ name: siteConfig.author.name }],
  openGraph: { type: "website", siteName: siteConfig.name, locale: siteConfig.locale },
  alternates: { types: { "application/rss+xml": [{ url: "/rss.xml", title: `${siteConfig.name} RSS` }] } },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The inline script sets the `dark` class before first paint, so <html> differs from the server render.
    <html lang={siteConfig.locale} suppressHydrationWarning className={`${fontSans.variable} ${fontMono.variable}`}>
      <head>
        {/* Runs during HTML parsing, before first paint: applies the saved theme. */}
        <InlineScript html={THEME_INIT_SCRIPT} />
      </head>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
