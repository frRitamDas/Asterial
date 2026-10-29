"use client";

import React from "react";
import { Avatar } from "./Avatar";
import { Badge } from "./Badge";
import { isUserOnline } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export interface UserCardProps {
  displayName: string;
  username: string;
  avatarPath?: string | null;
  bio?: string | null;
  statusText?: string | null;
  lastSeenAt?: string | null;
  badgeLabel?: string | null;
  badgeVariant?: "neutral" | "accent" | "success" | "warning" | "danger";
  actions?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function UserCard({
  displayName,
  username,
  avatarPath,
  bio,
  statusText,
  lastSeenAt,
  badgeLabel,
  badgeVariant = "accent",
  actions,
  onClick,
  className,
}: UserCardProps) {
  const online = isUserOnline(lastSeenAt);

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center justify-between gap-3.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 transition-colors",
        onClick && "cursor-pointer hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)]",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-3.5">
        <Avatar
          name={displayName || username}
          avatarPath={avatarPath}
          size="md"
          showPresence={Boolean(lastSeenAt)}
          online={online}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-[var(--text-primary)]">
              {displayName}
            </p>
            {badgeLabel && (
              <Badge variant={badgeVariant} size="sm">
                {badgeLabel}
              </Badge>
            )}
          </div>
          <p className="truncate font-mono text-xs text-[var(--text-muted)]">
            @{username}
            {statusText ? ` · ${statusText}` : ""}
          </p>
          {bio && (
            <p className="mt-1 line-clamp-1 text-xs text-[var(--text-secondary)]">
              {bio}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div
          className="flex shrink-0 items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
        </div>
      )}
    </div>
  );
}
