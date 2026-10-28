import versionManifest from "../../../../version.json";
import type { AppearanceTheme } from "../types/database";

export const ASTERIAL_BRAND = {
  name: versionManifest.name,
  version: versionManifest.displayVersion,
  semver: versionManifest.version,
  versionCode: versionManifest.versionCode,
  channel: versionManifest.channel,
  developer: versionManifest.developer,
  attribution: versionManifest.attribution,
  androidPackageId: versionManifest.androidPackageId,
  productionUrl: versionManifest.productionUrl,
  githubRepo: versionManifest.githubRepo,
  githubReleasesUrl: `https://github.com/${versionManifest.githubRepo}/releases`,
  githubActionsUrl: `https://github.com/${versionManifest.githubRepo}/actions`,
  tagline: "Precision communication, communities, and updates in one calm monochrome workspace.",
  emptyStateTitle: "Your space starts here.",
  emptyStateBody:
    "Start a conversation, join an Orbit, share a Moment, or publish to the Feed.",
  releaseDate: versionManifest.releaseDate,
  releaseNotes: versionManifest.releaseNotes,
  securityNotice:
    "Messages, Orbits, Moments, Feed posts, and private media in ASTERIAL are protected in transit via HTTPS/TLS and at rest by PostgreSQL Row Level Security and private storage policies. Moments automatically stop appearing to users and signed-media policies once expires_at passes; standard database backups may retain underlying records until routine backup rotation completes. Client-side end-to-end cryptographic encryption is not enabled in this release.",
} as const;

export interface ThemePalette {
  id: AppearanceTheme;
  label: string;
  description: string;
  isDark: boolean;
  bgVoid: string;
  bgCanvas: string;
  bgSurface: string;
  bgElevated: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  borderSubtle: string;
  borderStrong: string;
  accent: string;
  accentSoft: string;
  accentBg: string;
  accentFg: string;
  bubbleOut: string;
  bubbleOutFg: string;
  bubbleOutBorder: string;
  bubbleIn: string;
  danger: string;
  success: string;
}

export const THEME_PALETTES: Record<AppearanceTheme, ThemePalette> = {
  obsidian: {
    id: "obsidian",
    label: "Obsidian",
    description: "Architectural deep carbon monochrome",
    isDark: true,
    bgVoid: "#050506",
    bgCanvas: "#0A0A0C",
    bgSurface: "#101013",
    bgElevated: "#17171B",
    textPrimary: "#F5F5F7",
    textSecondary: "#A1A1AA",
    textMuted: "#686873",
    borderSubtle: "rgba(255, 255, 255, 0.08)",
    borderStrong: "rgba(255, 255, 255, 0.16)",
    accent: "#F4F4F5",
    accentSoft: "rgba(244, 244, 245, 0.10)",
    accentBg: "#F5F5F7",
    accentFg: "#09090B",
    bubbleOut: "#1F1F24",
    bubbleOutFg: "#FAFAFA",
    bubbleOutBorder: "rgba(255, 255, 255, 0.18)",
    bubbleIn: "#141418",
    danger: "#EF4444",
    success: "#22C55E",
  },
  pitch: {
    id: "pitch",
    label: "OLED Pitch",
    description: "True #000000 black for OLED panels",
    isDark: true,
    bgVoid: "#000000",
    bgCanvas: "#000000",
    bgSurface: "#0A0A0C",
    bgElevated: "#121215",
    textPrimary: "#FFFFFF",
    textSecondary: "#A1A1AA",
    textMuted: "#686873",
    borderSubtle: "rgba(255, 255, 255, 0.09)",
    borderStrong: "rgba(255, 255, 255, 0.18)",
    accent: "#FFFFFF",
    accentSoft: "rgba(255, 255, 255, 0.12)",
    accentBg: "#FFFFFF",
    accentFg: "#000000",
    bubbleOut: "#1A1A1F",
    bubbleOutFg: "#FFFFFF",
    bubbleOutBorder: "rgba(255, 255, 255, 0.22)",
    bubbleIn: "#0E0E11",
    danger: "#EF4444",
    success: "#22C55E",
  },
  graphite: {
    id: "graphite",
    label: "Graphite",
    description: "Refined neutral charcoal surfaces",
    isDark: true,
    bgVoid: "#0C0C0E",
    bgCanvas: "#111114",
    bgSurface: "#17171B",
    bgElevated: "#202026",
    textPrimary: "#F4F4F5",
    textSecondary: "#A6A6B0",
    textMuted: "#71717A",
    borderSubtle: "rgba(255, 255, 255, 0.09)",
    borderStrong: "rgba(255, 255, 255, 0.17)",
    accent: "#E4E4E7",
    accentSoft: "rgba(228, 228, 231, 0.12)",
    accentBg: "#F4F4F5",
    accentFg: "#0C0C0E",
    bubbleOut: "#27272F",
    bubbleOutFg: "#FAFAFA",
    bubbleOutBorder: "rgba(255, 255, 255, 0.20)",
    bubbleIn: "#1C1C22",
    danger: "#EF4444",
    success: "#22C55E",
  },
  alabaster: {
    id: "alabaster",
    label: "Alabaster Light",
    description: "Crisp high-contrast daylight monochrome",
    isDark: false,
    bgVoid: "#EFEFF1",
    bgCanvas: "#F7F7F8",
    bgSurface: "#FFFFFF",
    bgElevated: "#F1F1F3",
    textPrimary: "#0F0F12",
    textSecondary: "#52525B",
    textMuted: "#71717A",
    borderSubtle: "rgba(15, 15, 18, 0.09)",
    borderStrong: "rgba(15, 15, 18, 0.18)",
    accent: "#18181B",
    accentSoft: "rgba(24, 24, 27, 0.08)",
    accentBg: "#0F0F12",
    accentFg: "#FFFFFF",
    bubbleOut: "#18181B",
    bubbleOutFg: "#FFFFFF",
    bubbleOutBorder: "rgba(24, 24, 27, 0.22)",
    bubbleIn: "#F4F4F5",
    danger: "#DC2626",
    success: "#16A34A",
  },
};

export const ALLOWED_ATTACHMENT_MIMES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/zip",
] as const;

export const ALLOWED_AVATAR_MIMES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024; // 15 MB
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB
export const MESSAGES_PAGE_SIZE = 35;
export const FEED_PAGE_SIZE = 20;

export const QUICK_REACTION_EMOJIS = ["✦", "👍", "❤️", "🔥", "😂", "👀"] as const;

export const EMOJI_CATEGORIES: ReadonlyArray<{
  label: string;
  emojis: readonly string[];
}> = [
  {
    label: "Signals",
    emojis: ["✦", "✧", "⚡", "🔥", "✨", "🎯", "🚀", "🛸", "🛰️", "🌌", "🌙", "⭐"],
  },
  {
    label: "Expressions",
    emojis: [
      "😀",
      "😄",
      "🙂",
      "😉",
      "😌",
      "😎",
      "🤔",
      "🫡",
      "😮",
      "😂",
      "🥹",
      "😴",
    ],
  },
  {
    label: "Gestures",
    emojis: ["👍", "👎", "👏", "🙌", "🤝", "✌️", "👌", "🫶", "💪", "🙏", "👋", "👀"],
  },
  {
    label: "Objects",
    emojis: ["❤️", "🖤", "🤍", "💎", "📌", "📎", "🔒", "🛡️", "💡", "🎉", "✅", "❌"],
  },
];
