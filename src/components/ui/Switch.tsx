"use client";

import React from "react";
import { cn } from "@/lib/utils/cn";

export interface SwitchProps {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
  id?: string;
}

export function Switch({
  checked,
  onCheckedChange,
  onChange,
  disabled = false,
  label,
  description,
  id,
}: SwitchProps) {
  const trigger = (next: boolean) => {
    onCheckedChange?.(next);
    onChange?.(next);
  };

  return (
    <div className="flex items-start justify-between gap-4">
      {(label || description) && (
        <div className="flex flex-col gap-0.5">
          {label && (
            <label
              htmlFor={id}
              onClick={() => {
                if (!disabled) trigger(!checked);
              }}
              className="text-xs font-medium text-[var(--text-primary)] cursor-pointer"
            >
              {label}
            </label>
          )}
          {description && (
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
              {description}
            </p>
          )}
        </div>
      )}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => trigger(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:pointer-events-none",
          checked
            ? "bg-[var(--accent-primary)] border-[var(--accent-primary)]"
            : "bg-[var(--bg-subtle)] border-[var(--border-strong)]"
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 rounded-full transition-transform duration-150",
            checked
              ? "translate-x-5.5 bg-[var(--accent-primary-fg)]"
              : "translate-x-1 bg-zinc-400"
          )}
        />
      </button>
    </div>
  );
}
