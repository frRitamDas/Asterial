"use client";

import React from "react";
import { cn } from "@/lib/utils/cn";

export interface SegmentedOption<T extends string> {
  id: T;
  label: string;
  badge?: number | string;
  icon?: React.ReactNode;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "sm",
  className,
  ariaLabel,
}: {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (next: T) => void;
  size?: "sm" | "md";
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1",
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all cursor-pointer select-none",
              size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-xs",
              active
                ? "bg-[var(--accent-primary)] text-[var(--accent-primary-fg)] shadow-xs"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04]"
            )}
          >
            {opt.icon}
            <span>{opt.label}</span>
            {opt.badge !== undefined && Number(opt.badge) > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.2 text-[10px] font-mono",
                  active
                    ? "bg-black/20 text-current"
                    : "bg-white/[0.08] text-[var(--text-primary)]"
                )}
              >
                {opt.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
