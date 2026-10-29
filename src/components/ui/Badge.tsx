"use client";

import React from "react";
import { cn } from "@/lib/utils/cn";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "neutral" | "accent" | "success" | "warning" | "danger";
  size?: "sm" | "md";
}

export function Badge({
  variant = "neutral",
  size = "sm",
  className,
  children,
  ...props
}: BadgeProps) {
  const variantStyles = {
    neutral:
      "border-white/10 bg-white/[0.05] text-[var(--text-secondary)]",
    accent:
      "border-[var(--border-active)] bg-[var(--accent-signal-subtle)] text-[var(--accent-primary)]",
    success:
      "border-emerald-500/30 bg-emerald-500/12 text-emerald-300",
    warning:
      "border-amber-500/30 bg-amber-500/12 text-amber-300",
    danger: "border-red-500/30 bg-red-500/12 text-red-300",
  }[variant];

  const sizeStyles = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-0.5 text-xs",
  }[size];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium leading-tight tracking-tight",
        variantStyles,
        sizeStyles,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
