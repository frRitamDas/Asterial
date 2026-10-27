"use client";

import React from "react";
import { cn } from "@/lib/utils/cn";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
  id?: string;
}

export function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  label,
  description,
  id,
}: SwitchProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      {(label || description) && (
        <div className="flex flex-col gap-0.5">
          {label && (
            <label
              htmlFor={id}
              className="text-sm font-medium text-[var(--text-primary)] cursor-pointer"
            >
              {label}
            </label>
          )}
          {description && (
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
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
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:pointer-events-none",
          checked
            ? "bg-white border-white"
            : "bg-[var(--bg-subtle)] border-[var(--border-strong)]"
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 rounded-full transition-transform duration-150",
            checked
              ? "translate-x-5.5 bg-zinc-950"
              : "translate-x-1 bg-zinc-400"
          )}
        />
      </button>
    </div>
  );
}
