import type { MetadataRoute } from "next";
import { ASTERIAL_BRAND } from "@/lib/constants/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${ASTERIAL_BRAND.name} — ${ASTERIAL_BRAND.attribution}`,
    short_name: ASTERIAL_BRAND.name,
    description: ASTERIAL_BRAND.tagline,
    start_url: "/app/chats",
    display: "standalone",
    background_color: "#050507",
    theme_color: "#050507",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
