import type { SupabaseClient } from "@supabase/supabase-js";
import {
  sanitizeStorageFileName,
  validateUploadMetadataAndHeader,
} from "@asterial/core";
import {
  AsterialNative,
  type PickedNativeDocument,
} from "../native/AsterialNative";
import { getActiveSupabaseConfig } from "./supabase";
import { createClientUuid } from "./uuid";

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour
const CACHE_EXPIRY_BUFFER_MS = 10 * 60 * 1000; // Refresh 10m before expiry

interface CachedSignedUrl {
  url: string;
  expiresAt: number;
}

const signedUrlCache = new Map<string, CachedSignedUrl>();

export interface ValidatedNativeFile extends PickedNativeDocument {
  normalizedMime: string;
  isImage: boolean;
}

export function clearSignedUrlCache(): void {
  signedUrlCache.clear();
}

export function getCachedSignedUrl(
  bucket: "avatars" | "chat-attachments",
  storagePath: string | null | undefined
): string | null {
  if (!storagePath) return null;
  if (/^https?:\/\//i.test(storagePath)) return storagePath;
  const cached = signedUrlCache.get(`${bucket}:${storagePath}`);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }
  return null;
}

export async function resolvePrivateSignedUrl(
  supabase: SupabaseClient,
  bucket: "avatars" | "chat-attachments",
  storagePath: string | null | undefined
): Promise<string | null> {
  if (!storagePath) return null;
  if (/^https?:\/\//i.test(storagePath)) return storagePath;

  const cacheKey = `${bucket}:${storagePath}`;
  const cached = signedUrlCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    return null;
  }

  signedUrlCache.set(cacheKey, {
    url: data.signedUrl,
    expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000 - CACHE_EXPIRY_BUFFER_MS,
  });
  return data.signedUrl;
}

export async function primePrivateSignedUrls(
  supabase: SupabaseClient,
  bucket: "avatars" | "chat-attachments",
  paths: (string | null | undefined)[]
): Promise<void> {
  const missing = Array.from(
    new Set(
      paths.filter((p): p is string => {
        if (!p || /^https?:\/\//i.test(p)) return false;
        const cached = signedUrlCache.get(`${bucket}:${p}`);
        return !cached || cached.expiresAt <= Date.now();
      })
    )
  );
  if (missing.length === 0) return;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(missing, SIGNED_URL_TTL_SECONDS);

  if (error || !data) return;

  const expiresAt =
    Date.now() + SIGNED_URL_TTL_SECONDS * 1000 - CACHE_EXPIRY_BUFFER_MS;
  for (const entry of data) {
    if (entry.path && entry.signedUrl) {
      signedUrlCache.set(`${bucket}:${entry.path}`, {
        url: entry.signedUrl,
        expiresAt,
      });
    }
  }
}

/**
 * Opens Android's scoped system picker and validates size, extension, MIME, and
 * binary magic-byte header using `@asterial/core` before staging or uploading.
 */
export async function pickAndValidateNativeFile(
  kind: "avatar" | "attachment"
): Promise<ValidatedNativeFile | null> {
  const picked = await AsterialNative.pickMediaOrDocument(kind);
  if (!picked) return null;

  const headerUint8 = new Uint8Array(picked.headerBytes || []);
  const check = validateUploadMetadataAndHeader({
    fileName: picked.fileName,
    byteSize: picked.byteSize,
    declaredMime: picked.mimeType,
    headerBytes: headerUint8,
    kind,
  });

  if (!check.ok) {
    throw new Error(check.error);
  }

  return {
    ...picked,
    normalizedMime: check.verifiedMime,
    isImage: check.verifiedMime.startsWith("image/"),
  };
}

function encodeStorageObjectPath(storagePath: string): string {
  return storagePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export async function uploadValidatedNativeFile(params: {
  supabase: SupabaseClient;
  bucket: "avatars" | "chat-attachments";
  storagePath: string;
  file: ValidatedNativeFile;
  upsert?: boolean;
  uploadId?: string;
  onProgress?: (percent: number, bytesSent: number, totalBytes: number) => void;
}): Promise<{ uploadId: string; storagePath: string }> {
  const cfg = getActiveSupabaseConfig();
  if (!cfg?.supabaseUrl) {
    throw new Error("Supabase Storage endpoint is not configured.");
  }

  const {
    data: { session },
  } = await params.supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Your session expired. Please sign in again.");
  }

  const uploadId = params.uploadId || createClientUuid();
  const encodedPath = encodeStorageObjectPath(params.storagePath);
  const baseUrl = cfg.supabaseUrl.replace(/\/+$/, "");
  const uploadUrl = `${baseUrl}/storage/v1/object/${params.bucket}/${encodedPath}`;

  const unsubscribe = params.onProgress
    ? AsterialNative.onUploadProgress(uploadId, (ev) => {
        params.onProgress?.(
          Math.round(ev.percent),
          ev.bytesSent,
          ev.totalBytes
        );
      })
    : null;

  try {
    await AsterialNative.uploadUriToSupabaseStorage({
      uploadId,
      uri: params.file.uri,
      uploadUrl,
      anonKey: cfg.supabaseAnonKey,
      accessToken: session.access_token,
      mimeType: params.file.normalizedMime,
      upsert: Boolean(params.upsert),
      totalBytes: params.file.byteSize,
    });
    return { uploadId, storagePath: params.storagePath };
  } finally {
    unsubscribe?.();
  }
}

export function buildAvatarStoragePath(
  ownerFolderId: string,
  fileName: string
): string {
  return `${ownerFolderId}/${Date.now()}-${sanitizeStorageFileName(fileName)}`;
}

export function buildChatAttachmentStoragePath(
  conversationId: string,
  uploaderId: string,
  fileName: string
): string {
  return `${conversationId}/${uploaderId}/${Date.now()}-${sanitizeStorageFileName(
    fileName
  )}`;
}
