export const ASTERIAL_BRAND = {
  name: "ASTERIAL",
  version: "1.1",
  semver: "1.1.0",
  developer: "Ritam Das",
  attribution: "By X Huracan",
  tagline: "Precision real-time communication across your digital constellation.",
  emptyStateTitle: "Your space starts here.",
  emptyStateBody:
    "Find someone, start a conversation, and bring your world together.",
  releaseDate: "October 2026",
  releaseNotes: [
    "Real-time 1:1 and group messaging powered by Supabase Realtime & PostgreSQL 17",
    "Monochrome constellation design system with Obsidian, OLED Pitch, and Graphite surfaces",
    "Authentic delivery and read receipts with per-account privacy controls",
    "Private media attachments with magic-byte verification and scoped signed URLs",
    "Role-based group administration (Owner, Admin, Member) enforced via Row Level Security",
    "Live presence and ephemeral typing broadcasts with automatic disconnect cleanup",
  ],
  securityNotice:
    "Messages and attachments in ASTERIAL v1.1 are protected in transit via TLS and at rest by Supabase PostgreSQL Row Level Security and private storage policies. End-to-end cryptographic message encryption is not yet enabled in v1.1.",
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
