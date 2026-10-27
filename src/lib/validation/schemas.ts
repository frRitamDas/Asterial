import { z } from "zod";
import {
  ALLOWED_ATTACHMENT_MIMES,
  ALLOWED_AVATAR_MIMES,
  MAX_ATTACHMENT_BYTES,
  MAX_AVATAR_BYTES,
} from "@/lib/constants/brand";

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
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) {
    return fallback;
  }
  return trimmed;
}

/**
 * Inspects file magic bytes so client-provided filenames or spoofed MIME types
 * (e.g., an executable renamed to .png) are rejected prior to upload.
 */
export function detectBinaryMimeSignature(bytes: Uint8Array): string | null {
  if (bytes.length >= 8) {
    // PNG: 89 50 4E 47 0D 0A 1A 0A
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
  }
  if (bytes.length >= 3) {
    // JPEG: FF D8 FF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return "image/jpeg";
    }
  }
  if (bytes.length >= 6) {
    // GIF87a / GIF89a
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
    // WEBP: RIFF....WEBP
    if (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    ) {
      return "image/webp";
    }
  }
  if (bytes.length >= 4) {
    // PDF: %PDF
    if (
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46
    ) {
      return "application/pdf";
    }
    // ZIP: PK\x03\x04
    if (
      bytes[0] === 0x50 &&
      bytes[1] === 0x4b &&
      bytes[2] === 0x03 &&
      bytes[3] === 0x04
    ) {
      return "application/zip";
    }
    // Reject PE/ELF/Mach-O executables explicitly
    if (
      (bytes[0] === 0x4d && bytes[1] === 0x5a) || // MZ
      (bytes[0] === 0x7f &&
        bytes[1] === 0x45 &&
        bytes[2] === 0x4c &&
        bytes[3] === 0x46) // ELF
    ) {
      return "application/x-executable";
    }
  }
  return null;
}

export async function validateUploadFile(
  file: File,
  kind: "avatar" | "attachment"
): Promise<{ ok: true; verifiedMime: string } | { ok: false; error: string }> {
  const maxBytes = kind === "avatar" ? MAX_AVATAR_BYTES : MAX_ATTACHMENT_BYTES;
  const allowedMimes: readonly string[] =
    kind === "avatar" ? ALLOWED_AVATAR_MIMES : ALLOWED_ATTACHMENT_MIMES;

  if (file.size <= 0) {
    return { ok: false, error: "Selected file is empty." };
  }
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    return { ok: false, error: `File exceeds the ${mb} MB limit.` };
  }

  const headerBuffer = await file.slice(0, 16).arrayBuffer();
  const headerBytes = new Uint8Array(headerBuffer);
  const detectedBinary = detectBinaryMimeSignature(headerBytes);

  if (detectedBinary === "application/x-executable") {
    return { ok: false, error: "Executable files are not permitted." };
  }

  if (kind === "avatar") {
    if (!detectedBinary || !allowedMimes.includes(detectedBinary)) {
      return {
        ok: false,
        error: "Avatar must be a valid PNG, JPEG, WebP, or GIF image.",
      };
    }
    return { ok: true, verifiedMime: detectedBinary };
  }

  // Attachment validation
  if (detectedBinary) {
    if (!allowedMimes.includes(detectedBinary)) {
      return { ok: false, error: "Unsupported file format." };
    }
    return { ok: true, verifiedMime: detectedBinary };
  }

  // Plain-text formats (txt, md, csv, json): verify absence of NUL binary bytes in header
  const hasNullByte = headerBytes.some((b) => b === 0x00);
  if (hasNullByte) {
    return {
      ok: false,
      error: "Unrecognized binary file format.",
    };
  }

  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const textMimeMap: Record<string, string> = {
    txt: "text/plain",
    md: "text/markdown",
    csv: "text/csv",
    json: "application/json",
  };
  const inferred = allowedMimes.includes(file.type)
    ? file.type
    : textMimeMap[ext] || "";

  if (!inferred || !allowedMimes.includes(inferred)) {
    return {
      ok: false,
      error:
        "Allowed formats: PNG, JPG, WebP, GIF, PDF, ZIP, TXT, MD, CSV, JSON (up to 15 MB).",
    };
  }

  return { ok: true, verifiedMime: inferred };
}
