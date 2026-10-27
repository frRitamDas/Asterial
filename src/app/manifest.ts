import type { MetadataRoute } from "next";
import { ASTERIAL_BRAND } from "@/lib/constants/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${ASTERIAL_BRAND.name} — ${ASTERIAL_BRAND.attribution}`,
    short_name: ASTERIAL_BRAND.name,
    description: ASTERIAL_BRAND.tagline,
    start_url: "/app/chats",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#050507",
    theme_color: "#050507",
    categories: ["social", "communication", "productivity"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
    related_applications: [
      {
        platform: "webapp",
        url: `${ASTERIAL_BRAND.productionUrl}/manifest.webmanifest`,
      },
    ],
  };
}
