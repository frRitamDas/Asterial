"use client";

import React, { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import {
  getCachedSignedUrl,
  resolveSignedUrl,
  type PrivateBucketId,
} from "@/lib/supabase/storage";
import { cn } from "@/lib/utils/cn";

function useResolvedSignedUrl(bucket: PrivateBucketId, path: string) {
  const cached = getCachedSignedUrl(bucket, path);
  const [resolved, setResolved] = useState<{
    path: string;
    url: string | null;
  } | null>(null);
  const [failedPath, setFailedPath] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!path || cached) return;
    resolveSignedUrl(bucket, path).then((url) => {
      if (active) {
        setResolved({ path, url });
      }
    });
    return () => {
      active = false;
    };
  }, [bucket, cached, path]);

  const url =
    cached || (resolved && resolved.path === path ? resolved.url : null);
  const failed =
    failedPath === path || Boolean(resolved && resolved.path === path && !url);

  return { url, failed, markFailed: () => setFailedPath(path) };
}

export function PrivateMediaImage({
  bucket,
  path,
  alt,
  className,
}: {
  bucket: PrivateBucketId;
  path: string;
  alt: string;
  className?: string;
}) {
  const { url, failed, markFailed } = useResolvedSignedUrl(bucket, path);

  if (failed) {
    return (
      <div
        className={cn(
          "flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-[var(--bg-elevated)] p-6 text-xs text-zinc-500",
          className
        )}
      >
        <ImageOff className="h-4 w-4 shrink-0" />
        <span>Media unavailable or access expired</span>
      </div>
    );
  }

  if (!url) {
    return (
      <div
        className={cn(
          "animate-pulse rounded-xl border border-white/10 bg-[var(--bg-elevated)] min-h-[180px]",
          className
        )}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      onError={markFailed}
      className={cn(
        "rounded-xl border border-white/10 object-cover bg-[var(--bg-void)]",
        className
      )}
    />
  );
}

export function PrivateMediaAsset({
  bucket,
  path,
  mimeType,
  alt,
  className,
  autoPlay = false,
  controls = true,
}: {
  bucket: PrivateBucketId;
  path: string;
  mimeType?: string | null;
  alt: string;
  className?: string;
  autoPlay?: boolean;
  controls?: boolean;
}) {
  const { url, failed, markFailed } = useResolvedSignedUrl(bucket, path);
  const mime = (mimeType || "").toLowerCase();

  if (failed) {
    return (
      <div
        className={cn(
          "flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-[var(--bg-elevated)] p-6 text-xs text-zinc-500",
          className
        )}
      >
        <ImageOff className="h-4 w-4 shrink-0" />
        <span>Media unavailable or access expired</span>
      </div>
    );
  }

  if (!url) {
    return (
      <div
        className={cn(
          "animate-pulse rounded-xl border border-white/10 bg-[var(--bg-elevated)] min-h-[160px]",
          className
        )}
      />
    );
  }

  if (mime.startsWith("video/")) {
    return (
      <video
        src={url}
        controls={controls}
        autoPlay={autoPlay}
        playsInline
        preload="metadata"
        onError={markFailed}
        className={cn(
          "rounded-xl border border-white/10 bg-black object-contain",
          className
        )}
      />
    );
  }

  if (mime.startsWith("audio/")) {
    return (
      <audio
        src={url}
        controls
        preload="metadata"
        onError={markFailed}
        className={cn("w-full max-w-xs h-10", className)}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      onError={markFailed}
      className={cn(
        "rounded-xl border border-white/10 object-cover bg-[var(--bg-void)]",
        className
      )}
    />
  );
}
