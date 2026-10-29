import { z } from "zod";
import {
  ALLOWED_ATTACHMENT_MIMES,
  ALLOWED_AVATAR_MIMES,
  ALLOWED_SOCIAL_MEDIA_MIMES,
  MAX_ATTACHMENT_BYTES,
  MAX_AVATAR_BYTES,
} from "../constants/brand";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9_]{3,24}$/,
    "Username must be 3–24 characters using lowercase letters, numbers, or underscores."
  );

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Display name is required.")
  .max(60, "Display name cannot exceed 60 characters.");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password cannot exceed 128 characters.");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required."),
});

export const signupSchema = z.object({
  username: usernameSchema,
  displayName: displayNameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const resetRequestSchema = z.object({
  email: emailSchema,
});

export const passwordUpdateSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const profileUpdateSchema = z.object({
  username: usernameSchema,
  displayName: displayNameSchema,
  bio: z.string().max(280, "Bio cannot exceed 280 characters.").default(""),
  statusText: z
    .string()
    .max(80, "Status cannot exceed 80 characters.")
    .default(""),
});

export const profileSchema = profileUpdateSchema;

export const messageBodySchema = z
  .string()
  .max(4000, "Message cannot exceed 4,000 characters.");

export const groupCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Group name is required.")
    .max(80, "Group name cannot exceed 80 characters."),
  description: z
    .string()
    .max(300, "Description cannot exceed 300 characters.")
    .default(""),
  memberIds: z.array(z.string().uuid()).max(100).default([]),
});

export const closeOrbitSchema = z.object({
  contactId: z.string().uuid(),
  tier: z.enum(["inner", "priority"]).default("inner"),
  note: z
    .string()
    .trim()
    .max(160, "Orbit note cannot exceed 160 characters.")
    .default(""),
});

export const closeOrbitUpsertSchema = closeOrbitSchema;

export const forwardMessageSchema = z.object({
  sourceMessageId: z.string().uuid(),
  targetConversationIds: z
    .array(z.string().uuid())
    .min(1, "Select at least one destination conversation.")
    .max(10, "You can forward to up to 10 conversations at once."),
});

export const orbitSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9][a-z0-9-]{1,34}[a-z0-9]$/,
    "Orbit handle must be 3–36 lowercase letters, numbers, or hyphens."
  );

export const orbitCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Orbit name must be at least 2 characters.")
    .max(80, "Orbit name cannot exceed 80 characters."),
  slug: orbitSlugSchema,
  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters.")
    .default(""),
  visibility: z.enum(["public", "private"]).default("public"),
});

export const orbitSchema = orbitCreateSchema;

export const orbitChannelCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Channel name must be at least 2 characters.")
    .max(50, "Channel name cannot exceed 50 characters."),
  topic: z
    .string()
    .trim()
    .max(240, "Channel topic cannot exceed 240 characters.")
    .default(""),
  isAnnouncement: z.boolean().default(false),
});

export const momentCreateSchema = z.object({
  caption: z
    .string()
    .trim()
    .max(500, "Moment caption cannot exceed 500 characters.")
    .default(""),
  backgroundTone: z
    .enum(["obsidian", "graphite", "slate", "ivory"])
    .default("obsidian"),
  audience: z.enum(["everyone", "contacts", "orbit"]).default("everyone"),
  durationHours: z
    .union([z.literal(6), z.literal(12), z.literal(24), z.literal(48)])
    .default(24),
});

export const postBodySchema = z.object({
  body: z
    .string()
    .trim()
    .max(2000, "Post cannot exceed 2,000 characters."),
  visibility: z.enum(["public", "contacts", "orbit"]).default("public"),
});

export const postCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Comment cannot be empty.")
    .max(1000, "Comment cannot exceed 1,000 characters."),
  parentCommentId: z.string().uuid().nullable().optional(),
});

export const reportCreateSchema = z.object({
  category: z.enum([
    "spam",
    "harassment",
    "impersonation",
    "illegal_content",
    "other",
  ]),
  details: z
    .string()
    .trim()
    .max(1000, "Report details cannot exceed 1,000 characters.")
    .default(""),
});

/**
 * Prevents open-redirect vulnerabilities by allowing only internal relative paths.
 */
export function sanitizeRedirectPath(
  next: string | null | undefined,
  fallback = "/app/chats"
): string {
  if (!next || typeof next !== "string") return fallback;
  const trimmed = next.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes("\\")
  ) {
    return fallback;
  }
  return trimmed;
}

/**
 * Inspects file magic bytes so client-provided filenames or spoofed MIME types
 * (e.g., an executable renamed to .png or .mp4) are rejected prior to upload.
 */
export function detectBinaryMimeSignature(
  bytes: Uint8Array,
  declaredMime?: string | null
): string | null {
  if (bytes.length >= 8) {
    if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    ) {
      return "image/png";
    }
    // ISO Base Media File Format (MP4 / M4A): 'ftyp' at bytes 4..7
    if (
      bytes[4] === 0x66 &&
      bytes[5] === 0x74 &&
      bytes[6] === 0x79 &&
      bytes[7] === 0x70
    ) {
      return declaredMime === "audio/mp4" ? "audio/mp4" : "video/mp4";
    }
  }
  if (bytes.length >= 3) {
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return "image/jpeg";
    }
    // MP3 ID3 tag
    if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
      return "audio/mpeg";
    }
  }
  if (bytes.length >= 6) {
    if (
      bytes[0] === 0x47 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x38 &&
      (bytes[4] === 0x37 || bytes[4] === 0x39) &&
      bytes[5] === 0x61
    ) {
      return "image/gif";
    }
  }
  if (bytes.length >= 12) {
    if (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46
    ) {
      if (
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
      ) {
        return "image/webp";
      }
      if (
        bytes[8] === 0x57 &&
        bytes[9] === 0x41 &&
        bytes[10] === 0x56 &&
        bytes[11] === 0x45
      ) {
        return "audio/wav";
      }
    }
  }
  if (bytes.length >= 4) {
    // EBML container (WebM video or WebM Opus voice note)
    if (
      bytes[0] === 0x1a &&
      bytes[1] === 0x45 &&
      bytes[2] === 0xdf &&
      bytes[3] === 0xa3
    ) {
      return declaredMime?.startsWith("audio/") ? "audio/webm" : "video/webm";
    }
    // Ogg container (Ogg Opus / Vorbis)
    if (
      bytes[0] === 0x4f &&
      bytes[1] === 0x67 &&
      bytes[2] === 0x67 &&
      bytes[3] === 0x53
    ) {
      return "audio/ogg";
    }
    if (
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46
    ) {
      return "application/pdf";
    }
    if (
      bytes[0] === 0x50 &&
      bytes[1] === 0x4b &&
      bytes[2] === 0x03 &&
      bytes[3] === 0x04
    ) {
      return "application/zip";
    }
    if (
      (bytes[0] === 0x4d && bytes[1] === 0x5a) ||
      (bytes[0] === 0x7f &&
        bytes[1] === 0x45 &&
        bytes[2] === 0x4c &&
        bytes[3] === 0x46)
    ) {
      return "application/x-executable";
    }
  }
  if (bytes.length >= 2) {
    // MPEG audio frame sync
    if (
      bytes[0] === 0xff &&
      (bytes[1] === 0xfb || bytes[1] === 0xf3 || bytes[1] === 0xf2)
    ) {
      return "audio/mpeg";
    }
  }
  return null;
}

/**
 * Platform-agnostic upload validator usable by both DOM File readers (Web)
 * and React Native file pickers (Android).
 */
export function validateUploadMetadataAndHeader(params: {
  fileName: string;
  byteSize: number;
  declaredMime?: string | null;
  headerBytes: Uint8Array;
  kind: "avatar" | "attachment" | "social-image" | "social-media";
}): { ok: true; verifiedMime: string } | { ok: false; error: string } {
  const maxBytes =
    params.kind === "avatar" ? MAX_AVATAR_BYTES : MAX_ATTACHMENT_BYTES;
  const allowedMimes: readonly string[] =
    params.kind === "avatar" || params.kind === "social-image"
      ? ALLOWED_AVATAR_MIMES
      : params.kind === "social-media"
        ? ALLOWED_SOCIAL_MEDIA_MIMES
        : ALLOWED_ATTACHMENT_MIMES;

  if (params.byteSize <= 0) {
    return { ok: false, error: "Selected file is empty." };
  }
  if (params.byteSize > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    return { ok: false, error: `File exceeds the ${mb} MB limit.` };
  }

  const normalizedDeclared = (params.declaredMime || "")
    .split(";")[0]
    .trim()
    .toLowerCase();

  const detectedBinary = detectBinaryMimeSignature(
    params.headerBytes,
    normalizedDeclared
  );
  if (detectedBinary === "application/x-executable") {
    return { ok: false, error: "Executable files are not permitted." };
  }

  if (params.kind === "avatar" || params.kind === "social-image") {
    if (!detectedBinary || !allowedMimes.includes(detectedBinary)) {
      return {
        ok: false,
        error: "Media must be a valid PNG, JPEG, WebP, or GIF image.",
      };
    }
    return { ok: true, verifiedMime: detectedBinary };
  }

  if (params.kind === "social-media") {
    if (!detectedBinary || !allowedMimes.includes(detectedBinary)) {
      return {
        ok: false,
        error:
          "Media must be a valid PNG, JPEG, WebP, GIF image or MP4/WebM video (up to 25 MB).",
      };
    }
    return { ok: true, verifiedMime: detectedBinary };
  }

  if (detectedBinary) {
    if (!allowedMimes.includes(detectedBinary)) {
      return { ok: false, error: "Unsupported file format." };
    }
    return { ok: true, verifiedMime: detectedBinary };
  }

  const hasNullByte = params.headerBytes.some((b) => b === 0x00);
  if (hasNullByte) {
    return { ok: false, error: "Unrecognized binary file format." };
  }

  const ext = (params.fileName.split(".").pop() || "").toLowerCase();
  const textMimeMap: Record<string, string> = {
    txt: "text/plain",
    md: "text/markdown",
    csv: "text/csv",
    json: "application/json",
  };
  const inferred = allowedMimes.includes(normalizedDeclared)
    ? normalizedDeclared
    : textMimeMap[ext] || "";

  if (!inferred || !allowedMimes.includes(inferred)) {
    return {
      ok: false,
      error:
        "Allowed formats: PNG, JPG, WebP, GIF, MP4, WebM, Audio, PDF, ZIP, TXT, MD, CSV, JSON (up to 25 MB).",
    };
  }

  return { ok: true, verifiedMime: inferred };
}
