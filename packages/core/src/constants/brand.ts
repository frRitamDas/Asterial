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
  tagline: "Precision real-time communication across your digital constellation.",
  emptyStateTitle: "Your space starts here.",
  emptyStateBody:
    "Find someone, start a conversation, and bring your world together.",
  releaseDate: versionManifest.releaseDate,
  releaseNotes: versionManifest.releaseNotes,
  securityNotice:
    "Messages and attachments in ASTERIAL are protected in transit via TLS and at rest by Supabase PostgreSQL Row Level Security and private storage policies. Client-side end-to-end cryptographic message encryption is not enabled in this release.",
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
  accentBg: string;
  accentFg: string;
  danger: string;
  success: string;
}

export const THEME_PALETTES: Record<AppearanceTheme, ThemePalette> = {
  obsidian: {
    id: "obsidian",
    label: "Obsidian",
    description: "Signature deep carbon contrast",
    isDark: true,
    bgVoid: "#050507",
    bgCanvas: "#09090D",
    bgSurface: "#0E0E13",
    bgElevated: "#14141B",
    textPrimary: "#F4F4F6",
    textSecondary: "#9E9EA9",
    textMuted: "#63636E",
    borderSubtle: "rgba(255, 255, 255, 0.08)",
    borderStrong: "rgba(255, 255, 255, 0.16)",
    accentBg: "#F4F4F6",
    accentFg: "#09090B",
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
    bgSurface: "#09090C",
    bgElevated: "#111116",
    textPrimary: "#FFFFFF",
    textSecondary: "#A1A1AA",
    textMuted: "#63636E",
    borderSubtle: "rgba(255, 255, 255, 0.09)",
    borderStrong: "rgba(255, 255, 255, 0.18)",
    accentBg: "#FFFFFF",
    accentFg: "#000000",
    danger: "#EF4444",
    success: "#22C55E",
  },
  graphite: {
    id: "graphite",
    label: "Graphite",
    description: "Softened neutral charcoal tones",
    isDark: true,
    bgVoid: "#0B0C0E",
    bgCanvas: "#101115",
    bgSurface: "#16181D",
    bgElevated: "#1E2028",
    textPrimary: "#F4F4F6",
    textSecondary: "#A5A7B2",
    textMuted: "#6E717D",
    borderSubtle: "rgba(255, 255, 255, 0.09)",
    borderStrong: "rgba(255, 255, 255, 0.17)",
    accentBg: "#F4F4F6",
    accentFg: "#0B0C0E",
    danger: "#EF4444",
    success: "#22C55E",
  },
  alabaster: {
    id: "alabaster",
    label: "Alabaster Light",
    description: "Crisp daylight neutral surfaces",
    isDark: false,
    bgVoid: "#EFEFF2",
    bgCanvas: "#F7F7F8",
    bgSurface: "#FFFFFF",
    bgElevated: "#F1F1F4",
    textPrimary: "#111115",
    textSecondary: "#52525C",
    textMuted: "#767682",
    borderSubtle: "rgba(17, 17, 21, 0.09)",
    borderStrong: "rgba(17, 17, 21, 0.18)",
    accentBg: "#111115",
    accentFg: "#FFFFFF",
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
