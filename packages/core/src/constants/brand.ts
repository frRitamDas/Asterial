import versionManifest from "../../../../version.json";
import type {
  AccentColor,
  AppearanceTheme,
  ChatWallpaper,
  ResolvedAppearanceTheme,
} from "../types/database";

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
  tagline:
    "Fast, reliable, secure-by-design messaging, close connections, moments, and communities.",
  emptyStateTitle: "Your conversations live here.",
  emptyStateBody:
    "Select a conversation, message a close connection in your Orbit, share a Moment, or start a new chat.",
  releaseDate: versionManifest.releaseDate,
  releaseNotes: versionManifest.releaseNotes,
  securityNotice:
    "Messages, Close Orbits, Community Spaces, Moments, Feed posts, and private media in ASTERIAL are protected in transit via HTTPS/TLS and at rest by PostgreSQL Row Level Security and private storage policies. Moments automatically stop appearing to users and signed-media policies once expires_at passes; standard database backups may retain underlying records until routine backup rotation completes. Client-side end-to-end cryptographic encryption is not enabled in this release.",
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
  warning: string;
  success: string;
}

export interface AccentPreset {
  id: AccentColor;
  label: string;
  description: string;
  hex: string;
  hoverHex: string;
  softRgba: string;
  fgHex: string;
}

export const ACCENT_PRESETS: Record<AccentColor, AccentPreset> = {
  indigo: {
    id: "indigo",
    label: "Asterial Indigo",
    description: "Refined cool blue-violet signal",
    hex: "#6E7BF2",
    hoverHex: "#5C6AE8",
    softRgba: "rgba(110, 123, 242, 0.14)",
    fgHex: "#FFFFFF",
  },
  cobalt: {
    id: "cobalt",
    label: "Cobalt Blue",
    description: "Crisp modern communication blue",
    hex: "#3B82F6",
    hoverHex: "#2563EB",
    softRgba: "rgba(59, 130, 246, 0.14)",
    fgHex: "#FFFFFF",
  },
  emerald: {
    id: "emerald",
    label: "Signal Emerald",
    description: "Calm high-clarity emerald",
    hex: "#10B981",
    hoverHex: "#059669",
    softRgba: "rgba(16, 185, 129, 0.14)",
    fgHex: "#04130D",
  },
  amber: {
    id: "amber",
    label: "Warm Amber",
    description: "Luminous warm gold highlight",
    hex: "#F59E0B",
    hoverHex: "#D97706",
    softRgba: "rgba(245, 158, 11, 0.14)",
    fgHex: "#140C02",
  },
  monochrome: {
    id: "monochrome",
    label: "Pure Monochrome",
    description: "High-contrast architectural monochrome",
    hex: "#F4F4F5",
    hoverHex: "#E4E4E7",
    softRgba: "rgba(244, 244, 245, 0.11)",
    fgHex: "#090A0C",
  },
};

export const CHAT_WALLPAPER_OPTIONS: ReadonlyArray<{
  id: ChatWallpaper;
  label: string;
  description: string;
}> = [
  {
    id: "constellation",
    label: "Subtle Starfield",
    description: "Restrained micro-dot geometric depth",
  },
  {
    id: "grid",
    label: "Architectural Grid",
    description: "Fine hairline blueprint matrix",
  },
  {
    id: "aurora",
    label: "Ambient Glow",
    description: "Soft top-edge radial atmosphere",
  },
  {
    id: "none",
    label: "Solid Canvas",
    description: "Pure uninterrupted matte background",
  },
];

const OBSIDIAN_BASE: Omit<ThemePalette, "id" | "label" | "description"> = {
  isDark: true,
  bgVoid: "#050506",
  bgCanvas: "#090A0C",
  bgSurface: "#101216",
  bgElevated: "#171A20",
  textPrimary: "#F5F7FA",
  textSecondary: "#9CA3AF",
  textMuted: "#6B7280",
  borderSubtle: "rgba(255, 255, 255, 0.08)",
  borderStrong: "rgba(255, 255, 255, 0.16)",
  accent: "#6E7BF2",
  accentSoft: "rgba(110, 123, 242, 0.14)",
  accentBg: "#6E7BF2",
  accentFg: "#FFFFFF",
  bubbleOut: "#212636",
  bubbleOutFg: "#F8FAFC",
  bubbleOutBorder: "rgba(110, 123, 242, 0.28)",
  bubbleIn: "#14171D",
  danger: "#EF4444",
  warning: "#F59E0B",
  success: "#22C55E",
};

export const THEME_PALETTES: Record<AppearanceTheme, ThemePalette> = {
  obsidian: {
    id: "obsidian",
    label: "Obsidian",
    description: "Deep charcoal foundation (#090A0C / #101216)",
    ...OBSIDIAN_BASE,
  },
  pitch: {
    id: "pitch",
    label: "OLED Pitch",
    description: "True #000000 black for OLED displays",
    isDark: true,
    bgVoid: "#000000",
    bgCanvas: "#000000",
    bgSurface: "#0B0C0F",
    bgElevated: "#13151B",
    textPrimary: "#FFFFFF",
    textSecondary: "#A1A1AA",
    textMuted: "#6B7280",
    borderSubtle: "rgba(255, 255, 255, 0.09)",
    borderStrong: "rgba(255, 255, 255, 0.18)",
    accent: "#6E7BF2",
    accentSoft: "rgba(110, 123, 242, 0.15)",
    accentBg: "#6E7BF2",
    accentFg: "#FFFFFF",
    bubbleOut: "#1C2030",
    bubbleOutFg: "#FFFFFF",
    bubbleOutBorder: "rgba(110, 123, 242, 0.30)",
    bubbleIn: "#0E1014",
    danger: "#EF4444",
    warning: "#F59E0B",
    success: "#22C55E",
  },
  graphite: {
    id: "graphite",
    label: "Graphite",
    description: "Soft slate-charcoal workspace",
    isDark: true,
    bgVoid: "#0D0E12",
    bgCanvas: "#12141A",
    bgSurface: "#181B22",
    bgElevated: "#20242D",
    textPrimary: "#F4F5F8",
    textSecondary: "#A4ABB8",
    textMuted: "#737B8C",
    borderSubtle: "rgba(255, 255, 255, 0.09)",
    borderStrong: "rgba(255, 255, 255, 0.17)",
    accent: "#6E7BF2",
    accentSoft: "rgba(110, 123, 242, 0.14)",
    accentBg: "#6E7BF2",
    accentFg: "#FFFFFF",
    bubbleOut: "#252B3D",
    bubbleOutFg: "#FAFAFA",
    bubbleOutBorder: "rgba(110, 123, 242, 0.28)",
    bubbleIn: "#1B1E26",
    danger: "#EF4444",
    warning: "#F59E0B",
    success: "#22C55E",
  },
  alabaster: {
    id: "alabaster",
    label: "Alabaster Light",
    description: "Crisp high-contrast daylight surface",
    isDark: false,
    bgVoid: "#ECEEF2",
    bgCanvas: "#F6F7F9",
    bgSurface: "#FFFFFF",
    bgElevated: "#EFF1F5",
    textPrimary: "#0F1115",
    textSecondary: "#4B5563",
    textMuted: "#6B7280",
    borderSubtle: "rgba(15, 17, 21, 0.09)",
    borderStrong: "rgba(15, 17, 21, 0.18)",
    accent: "#4F5CE5",
    accentSoft: "rgba(79, 92, 229, 0.10)",
    accentBg: "#4F5CE5",
    accentFg: "#FFFFFF",
    bubbleOut: "#4F5CE5",
    bubbleOutFg: "#FFFFFF",
    bubbleOutBorder: "rgba(79, 92, 229, 0.25)",
    bubbleIn: "#EEF0F4",
    danger: "#DC2626",
    warning: "#D97706",
    success: "#16A34A",
  },
  system: {
    id: "system",
    label: "System Automatic",
    description: "Follows your device dark or light appearance",
    ...OBSIDIAN_BASE,
  },
};

export function resolveAppearanceTheme(
  theme: AppearanceTheme | null | undefined,
  prefersLight = false
): ResolvedAppearanceTheme {
  if (!theme || theme === "system") {
    return prefersLight ? "alabaster" : "obsidian";
  }
  return theme;
}

export const ALLOWED_ATTACHMENT_MIMES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/zip",
] as const;

export const ALLOWED_SOCIAL_MEDIA_MIMES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
] as const;

export const ALLOWED_AVATAR_MIMES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_SOCIAL_MEDIA_BYTES = 25 * 1024 * 1024; // 25 MB
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
