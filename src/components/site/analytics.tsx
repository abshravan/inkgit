import Script from "next/script";

/**
 * Optional, cookie-less analytics (Plausible or a compatible self-hosted
 * script such as Umami's Plausible mode). Disabled unless configured; never
 * loaded in the admin. No database needed.
 */
export function Analytics() {
  const domain = process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN;
  if (!domain) return null;
  const src = process.env.NEXT_PUBLIC_ANALYTICS_SRC || "https://plausible.io/js/script.js";
  return <Script src={src} data-domain={domain} strategy="afterInteractive" />;
}
