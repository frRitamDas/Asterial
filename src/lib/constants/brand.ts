import versionManifest from "../../../version.json";

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
