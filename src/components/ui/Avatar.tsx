"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { getInitials } from "@/lib/utils/format";
import { getCachedSignedUrl, resolveSignedUrl } from "@/lib/supabase/storage";

interface AvatarProps {
  name: string;
  avatarPath?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  online?: boolean;
  showPresence?: boolean;
  isGroup?: boolean;
  className?: string;
}

export function Avatar({
  name,
  avatarPath,
  size = "md",
  online = false,
  showPresence = false,
  isGroup = false,
  className,
}: AvatarProps) {
  const cachedUrl = getCachedSignedUrl("avatars", avatarPath);
  const [asyncResolved, setAsyncResolved] = useState<{
    path: string;
    url: string | null;
  } | null>(null);
  const [failedPath, setFailedPath] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!avatarPath || cachedUrl) {
      return;
    }
    resolveSignedUrl("avatars", avatarPath).then((url) => {
      if (active) {
        setAsyncResolved({ path: avatarPath, url });
      }
    });
    return () => {
      active = false;
    };
  }, [avatarPath, cachedUrl]);

  const resolvedUrl =
    cachedUrl ||
    (avatarPath && asyncResolved && asyncResolved.path === avatarPath
      ? asyncResolved.url
      : null);

  const dims = {
    xs: "h-6 w-6 text-[10px]",
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-xs",
    lg: "h-12 w-12 text-sm",
    xl: "h-20 w-20 text-xl",
  }[size];

  const dotDims = {
    xs: "h-2 w-2 -right-0.5 -bottom-0.5",
    sm: "h-2.5 w-2.5 -right-0.5 -bottom-0.5",
    md: "h-2.5 w-2.5 right-0 bottom-0",
    lg: "h-3 w-3 right-0 bottom-0",
    xl: "h-4 w-4 right-0.5 bottom-0.5",
  }[size];

  const showImg = Boolean(avatarPath && resolvedUrl && failedPath !== avatarPath);

  return (
    <div className={cn("relative inline-flex shrink-0 select-none", className)}>
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden border border-white/12 bg-[var(--bg-subtle)] font-mono font-medium tracking-wider text-zinc-200",
          isGroup ? "rounded-xl" : "rounded-full",
          dims
        )}
      >
        {showImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolvedUrl!}
            alt={name}
            onError={() => setFailedPath(avatarPath || null)}
            className="h-full w-full object-cover"
          />
        ) : (
          <span>{getInitials(name)}</span>
        )}
      </div>
      {showPresence && !isGroup && (
        <span
          aria-label={online ? "Online" : "Offline"}
          className={cn(
            "absolute rounded-full ring-2 ring-[var(--bg-canvas)] transition-colors",
            online ? "bg-white" : "bg-zinc-600",
            dotDims
          )}
        />
      )}
    </div>
  );
}
