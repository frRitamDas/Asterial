import React from "react";
import { cn } from "@/lib/utils/cn";
import { ASTERIAL_BRAND } from "@/lib/constants/brand";

interface AsterialMarkProps {
  size?: number;
  className?: string;
}

/**
 * Original 5-node constellation / asterism vector emblem designed exclusively for ASTERIAL.
 */
export function AsterialMark({ size = 32, className }: AsterialMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={cn("shrink-0 select-none text-[var(--text-primary)]", className)}
    >
      <rect width="64" height="64" rx="14" fill="var(--surface-elevated)" />
      <rect
        x="1"
        y="1"
        width="62"
        height="62"
        rx="13"
        stroke="var(--border-subtle)"
        strokeWidth="1.5"
      />
      <circle
        cx="32"
        cy="32"
        r="20.5"
        stroke="currentColor"
        strokeOpacity="0.16"
        strokeWidth="1"
        strokeDasharray="2 3"
      />
      <path
        d="M32 13.5L18.5 37.5L32 31L45.5 37.5L32 13.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M18.5 37.5L32 49.5L45.5 37.5"
        stroke="var(--accent)"
        strokeOpacity="0.9"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="13.5" r="2.9" fill="var(--accent)" />
      <circle cx="18.5" cy="37.5" r="2.3" fill="currentColor" />
      <circle cx="45.5" cy="37.5" r="2.3" fill="currentColor" />
      <circle cx="32" cy="31" r="2.3" fill="currentColor" />
      <circle cx="32" cy="49.5" r="2.1" fill="currentColor" fillOpacity="0.85" />
    </svg>
  );
}

interface AsterialLogoProps {
  showVersion?: boolean;
  showAttribution?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function AsterialLogo({
  showVersion = false,
  showAttribution = false,
  size = "md",
  className,
}: AsterialLogoProps) {
  const markSize = size === "sm" ? 28 : size === "lg" ? 38 : 32;
  const textClass =
    size === "sm"
      ? "text-[13px] tracking-[0.20em]"
      : size === "lg"
        ? "text-lg tracking-[0.22em]"
        : "text-sm tracking-[0.21em]";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2.5 text-[var(--text-primary)]",
        className
      )}
    >
      <AsterialMark size={markSize} />
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span
            className={cn("font-semibold uppercase leading-none", textClass)}
          >
            {ASTERIAL_BRAND.name}
          </span>
          {showVersion && (
            <span className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-wider text-[var(--text-secondary)]">
              v{ASTERIAL_BRAND.version}
            </span>
          )}
        </div>
        {showAttribution && (
          <span className="mt-1 font-mono text-[10px] tracking-[0.14em] text-[var(--text-muted)] uppercase">
            {ASTERIAL_BRAND.attribution}
          </span>
        )}
      </div>
    </div>
  );
}
