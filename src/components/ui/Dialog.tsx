"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidthClass?: string;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  maxWidthClass = "max-w-lg",
}: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/72 animate-asterial-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="asterial-dialog-title"
        className={cn(
          "relative w-full rounded-[18px] border border-[var(--border-strong)] bg-[var(--bg-surface)] p-5 sm:p-6 shadow-2xl max-h-[90dvh] overflow-y-auto",
          maxWidthClass
        )}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2
              id="asterial-dialog-title"
              className="text-base font-semibold tracking-tight text-[var(--text-primary)]"
            >
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-xs text-[var(--text-secondary)] leading-relaxed">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-[8px] p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
