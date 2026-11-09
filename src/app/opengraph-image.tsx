import { ImageResponse } from "next/og";
import { OgCard } from "@/components/seo/og-card";
import { siteConfig } from "@/config/site";

export const alt = siteConfig.name;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <OgCard eyebrow="Written in Markdown · Versioned in Git" title={siteConfig.tagline} footer={siteConfig.name} />,
    size,
  );
}
