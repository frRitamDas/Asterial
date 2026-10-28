"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getPublicEnv } from "@/lib/env";
import { sanitizeStorageFileName } from "@/lib/utils/format";
import { validateUploadFile } from "@/lib/validation/schemas";

export type PrivateBucketId = "avatars" | "chat-attachments" | "social-media";

interface SignedCacheEntry {
  url: string;
  expiresAt: number;
}

const signedUrlCache = new Map<string, SignedCacheEntry>();
const SIGNED_URL_TTL_SECONDS = 3600;
const CACHE_BUFFER_MS = 5 * 60 * 1000;

function cacheKey(bucket: PrivateBucketId, path: string): string {
  return `${bucket}:${path}`;
}

export function getCachedSignedUrl(
  bucket: PrivateBucketId,
  path: string | null | undefined
): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const entry = signedUrlCache.get(cacheKey(bucket, path));
  if (entry && entry.expiresAt > Date.now()) {
    return entry.url;
  }
  return null;
}

export async function resolveSignedUrl(
  bucket: PrivateBucketId,
  path: string | null | undefined
): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const existing = getCachedSignedUrl(bucket, path);
  if (existing) return existing;

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    return null;
  }

  signedUrlCache.set(cacheKey(bucket, path), {
    url: data.signedUrl,
    expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000 - CACHE_BUFFER_MS,
  });

  return data.signedUrl;
}

export async function primeBucketSignedUrls(
  bucket: PrivateBucketId,
  paths: Array<string | null | undefined>
): Promise<void> {
  const missing = Array.from(
    new Set(
      paths.filter(
        (p): p is string =>
          Boolean(p) &&
          !p!.startsWith("http://") &&
          !p!.startsWith("https://") &&
          !getCachedSignedUrl(bucket, p)
      )
    )
  );

  if (missing.length === 0) return;

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(missing, SIGNED_URL_TTL_SECONDS);

  if (error || !data) return;

  const expiresAt = Date.now() + SIGNED_URL_TTL_SECONDS * 1000 - CACHE_BUFFER_MS;
  for (const item of data) {
    if (item.path && item.signedUrl) {
      signedUrlCache.set(cacheKey(bucket, item.path), {
        url: item.signedUrl,
        expiresAt,
      });
    }
  }
}

export async function primeAvatarSignedUrls(
  paths: Array<string | null | undefined>
): Promise<void> {
  return primeBucketSignedUrls("avatars", paths);
}

export async function measureImageDimensions(
  file: File,
  mimeType: string
): Promise<{ width: number | null; height: number | null }> {
  if (!mimeType.startsWith("image/")) {
    return { width: null, height: null };
  }

  try {
    if (typeof createImageBitmap === "function") {
      const bmp = await createImageBitmap(file);
      const dims = { width: bmp.width, height: bmp.height };
      bmp.close();
      return dims;
    }
  } catch {
    // Fallback below
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const dims = {
        width: img.naturalWidth || null,
        height: img.naturalHeight || null,
      };
      URL.revokeObjectURL(objectUrl);
      resolve(dims);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: null, height: null });
    };
    img.src = objectUrl;
  });
}

function uploadViaXhr(params: {
  bucket: PrivateBucketId;
  storagePath: string;
  file: File;
  mimeType: string;
  accessToken: string;
  upsert?: boolean;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const { supabaseUrl, supabaseAnonKey } = getPublicEnv();
  const encodedPath = params.storagePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const endpoint = `${supabaseUrl}/storage/v1/object/${params.bucket}/${encodedPath}`;

  return new Promise((resolve, reject) => {
    if (params.signal?.aborted) {
      reject(new DOMException("Upload cancelled.", "AbortError"));
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint, true);
    xhr.setRequestHeader("Authorization", `Bearer ${params.accessToken}`);
    xhr.setRequestHeader("apikey", supabaseAnonKey);
    xhr.setRequestHeader("Content-Type", params.mimeType);
    xhr.setRequestHeader("x-upsert", params.upsert ? "true" : "false");

    const handleAbort = () => {
      xhr.abort();
    };
    params.signal?.addEventListener("abort", handleAbort, { once: true });

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && params.onProgress) {
        const pct = Math.min(100, Math.round((event.loaded / event.total) * 100));
        params.onProgress(pct);
      }
    };

    xhr.onload = () => {
      params.signal?.removeEventListener("abort", handleAbort);
      if (xhr.status >= 200 && xhr.status < 300) {
        params.onProgress?.(100);
        resolve();
      } else {
        let message = `Upload failed (${xhr.status})`;
        try {
          const parsed = JSON.parse(xhr.responseText) as { message?: string; error?: string };
          if (parsed.message || parsed.error) {
            message = parsed.message || parsed.error || message;
          }
        } catch {
          // Ignore parse errors
        }
        reject(new Error(message));
      }
    };

    xhr.onerror = () => {
      params.signal?.removeEventListener("abort", handleAbort);
      reject(new Error("Network error while uploading file."));
    };

    xhr.onabort = () => {
      params.signal?.removeEventListener("abort", handleAbort);
      reject(new DOMException("Upload cancelled.", "AbortError"));
    };

    xhr.send(params.file);
  });
}

export async function uploadAvatarFile(
  userId: string,
  file: File,
  prefix = "profile"
): Promise<string> {
  const validation = await validateUploadFile(file, "avatar");
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("You must be signed in to upload an avatar.");
  }

  const ext = validation.verifiedMime.split("/")[1] || "png";
  const storagePath = `${userId}/${prefix}-${crypto.randomUUID()}.${ext}`;

  await uploadViaXhr({
    bucket: "avatars",
    storagePath,
    file,
    mimeType: validation.verifiedMime,
    accessToken: session.access_token,
    upsert: true,
  });

  await resolveSignedUrl("avatars", storagePath);
  return storagePath;
}

export async function uploadConversationAttachment(params: {
  conversationId: string;
  userId: string;
  file: File;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}): Promise<{
  storagePath: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
}> {
  const validation = await validateUploadFile(params.file, "attachment");
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Session expired. Sign in again to upload attachments.");
  }

  const safeName = sanitizeStorageFileName(params.file.name);
  const storagePath = `${params.conversationId}/${params.userId}/${crypto.randomUUID()}-${safeName}`;
  const dims = await measureImageDimensions(params.file, validation.verifiedMime);

  await uploadViaXhr({
    bucket: "chat-attachments",
    storagePath,
    file: params.file,
    mimeType: validation.verifiedMime,
    accessToken: session.access_token,
    onProgress: params.onProgress,
    signal: params.signal,
  });

  return {
    storagePath,
    fileName: safeName,
    mimeType: validation.verifiedMime,
    byteSize: params.file.size,
    width: dims.width,
    height: dims.height,
  };
}

export async function uploadSocialMediaFile(params: {
  domain: "posts" | "moments" | "orbits";
  userId: string;
  orbitId?: string;
  file: File;
  kind?: "social-image" | "attachment";
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}): Promise<{
  storagePath: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
}> {
  const validationKind = params.kind || (params.domain === "orbits" ? "attachment" : "social-image");
  const validation = await validateUploadFile(params.file, validationKind);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Session expired. Sign in again to upload media.");
  }

  const safeName = sanitizeStorageFileName(params.file.name);
  const storagePath =
    params.domain === "orbits" && params.orbitId
      ? `orbits/${params.userId}/${params.orbitId}/${crypto.randomUUID()}-${safeName}`
      : `${params.domain}/${params.userId}/${crypto.randomUUID()}-${safeName}`;

  const dims = await measureImageDimensions(params.file, validation.verifiedMime);

  await uploadViaXhr({
    bucket: "social-media",
    storagePath,
    file: params.file,
    mimeType: validation.verifiedMime,
    accessToken: session.access_token,
    onProgress: params.onProgress,
    signal: params.signal,
  });

  await resolveSignedUrl("social-media", storagePath);
  return {
    storagePath,
    fileName: safeName,
    mimeType: validation.verifiedMime,
    byteSize: params.file.size,
    width: dims.width,
    height: dims.height,
  };
}
