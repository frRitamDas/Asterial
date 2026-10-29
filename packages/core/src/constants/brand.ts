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
    label: "Asterial Violet",
    description: "Signature #7778F6 violet-blue signal",
    hex: "#7778F6",
    hoverHex: "#898AF9",
    softRgba: "rgba(119, 120, 246, 0.14)",
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
    hex: "#F5F6FA",
    hoverHex: "#E4E6EE",
    softRgba: "rgba(245, 246, 250, 0.11)",
    fgHex: "#090A0D",
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
  bgVoid: "#060709",
  bgCanvas: "#090A0D",
  bgSurface: "#101217",
  bgElevated: "#171A21",
  textPrimary: "#F5F6FA",
  textSecondary: "#A0A5B3",
  textMuted: "#747B8B",
  borderSubtle: "#272B35",
  borderStrong: "#363B48",
  accent: "#7778F6",
  accentSoft: "rgba(119, 120, 246, 0.14)",
  accentBg: "#7778F6",
  accentFg: "#FFFFFF",
  bubbleOut: "#21253A",
  bubbleOutFg: "#F5F6FA",
  bubbleOutBorder: "rgba(119, 120, 246, 0.30)",
  bubbleIn: "#151820",
  danger: "#EF4444",
  warning: "#F59E0B",
  success: "#22C55E",
};

export const THEME_PALETTES: Record<AppearanceTheme, ThemePalette> = {
  obsidian: {
    id: "obsidian",
    label: "Obsidian Dark",
    description: "Near-black canvas (#090A0D / #101217)",
    ...OBSIDIAN_BASE,
  },
  pitch: {
    id: "pitch",
    label: "OLED Pitch",
    description: "True #000000 black for OLED displays",
    isDark: true,
    bgVoid: "#000000",
    bgCanvas: "#000000",
    bgSurface: "#0B0D12",
    bgElevated: "#13161E",
    textPrimary: "#FFFFFF",
    textSecondary: "#A0A5B3",
    textMuted: "#747B8B",
    borderSubtle: "#1F232D",
    borderStrong: "#2E3341",
    accent: "#7778F6",
    accentSoft: "rgba(119, 120, 246, 0.16)",
    accentBg: "#7778F6",
    accentFg: "#FFFFFF",
    bubbleOut: "#1C2034",
    bubbleOutFg: "#FFFFFF",
    bubbleOutBorder: "rgba(119, 120, 246, 0.32)",
    bubbleIn: "#0E1117",
    danger: "#EF4444",
    warning: "#F59E0B",
    success: "#22C55E",
  },
  graphite: {
    id: "graphite",
    label: "Graphite",
    description: "Balanced slate-charcoal workspace",
    isDark: true,
    bgVoid: "#0D0F14",
    bgCanvas: "#12151C",
    bgSurface: "#181C24",
    bgElevated: "#202530",
    textPrimary: "#F5F6FA",
    textSecondary: "#A4AAB8",
    textMuted: "#798092",
    borderSubtle: "#2A2F3C",
    borderStrong: "#3A4050",
    accent: "#7778F6",
    accentSoft: "rgba(119, 120, 246, 0.14)",
    accentBg: "#7778F6",
    accentFg: "#FFFFFF",
    bubbleOut: "#252B40",
    bubbleOutFg: "#F5F6FA",
    bubbleOutBorder: "rgba(119, 120, 246, 0.28)",
    bubbleIn: "#1C2029",
    danger: "#EF4444",
    warning: "#F59E0B",
    success: "#22C55E",
  },
  alabaster: {
    id: "alabaster",
    label: "Daylight",
    description: "Deliberate high-contrast light surface",
    isDark: false,
    bgVoid: "#EAECEF",
    bgCanvas: "#F4F5F8",
    bgSurface: "#FFFFFF",
    bgElevated: "#EDF0F5",
    textPrimary: "#11131A",
    textSecondary: "#4E5565",
    textMuted: "#6F7687",
    borderSubtle: "#DDE1EB",
    borderStrong: "#C6CCD9",
    accent: "#5B5CE6",
    accentSoft: "rgba(91, 92, 230, 0.10)",
    accentBg: "#5B5CE6",
    accentFg: "#FFFFFF",
    bubbleOut: "#5B5CE6",
    bubbleOutFg: "#FFFFFF",
    bubbleOutBorder: "rgba(91, 92, 230, 0.24)",
    bubbleIn: "#EEF0F6",
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
