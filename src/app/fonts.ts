import localFont from "next/font/local";

/**
 * Self-hosted Geist (from the `geist` package) so builds never need network
 * access. Only the body font is preloaded; the mono font is used only in code
 * and shouldn't compete with it on the critical path.
 */
export const fontSans = localFont({
  src: "../../node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
  preload: true,
});

export const fontMono = localFont({
  src: "../../node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
  preload: false,
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
});
