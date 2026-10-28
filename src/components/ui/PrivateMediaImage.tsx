"use client";

import React, { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import {
  getCachedSignedUrl,
  resolveSignedUrl,
  type PrivateBucketId,
} from "@/lib/supabase/storage";
import { cn } from "@/lib/utils/cn";

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

  if (failedPath === path || (resolved && resolved.path === path && !url)) {
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
      onError={() => setFailedPath(path)}
      className={cn(
        "rounded-xl border border-white/10 object-cover bg-[var(--bg-void)]",
        className
      )}
    />
  );
}
