"use client";

import React from "react";
import { Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface SearchFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string;
  onChange: (value: string) => void;
  loading?: boolean;
  shortcutHint?: string;
}

export const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(
  (
    {
      value,
      onChange,
      loading = false,
      shortcutHint,
      placeholder = "Search…",
      className,
      ...props
    },
    ref
  ) => {
    return (
      <div className={cn("relative flex items-center", className)}>
        <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-[var(--text-muted)]" />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-9 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] pl-8.5 pr-9 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-active)] focus:outline-none transition-colors"
          {...props}
        />
        {loading ? (
          <Loader2 className="absolute right-3 h-3.5 w-3.5 animate-spin text-[var(--text-muted)]" />
        ) : value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear search"
            className="absolute right-2.5 rounded-md p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : shortcutHint ? (
          <kbd className="pointer-events-none absolute right-2.5 hidden rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-muted)] sm:inline-block">
            {shortcutHint}
          </kbd>
        ) : null}
      </div>
    );
  }
);

SearchField.displayName = "SearchField";
