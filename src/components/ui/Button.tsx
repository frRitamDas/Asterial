"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      children,
      type = "button",
      ...props
    },
    ref
  ) => {
    const variantStyles = {
      primary:
        "bg-white text-zinc-950 hover:bg-zinc-200 active:scale-[0.985] font-medium border border-white",
      secondary:
        "bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] active:scale-[0.985] border border-[var(--border-strong)]",
      ghost:
        "bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.05] active:scale-[0.985] border border-transparent",
      danger:
        "bg-red-500/12 text-red-300 hover:bg-red-500/20 active:scale-[0.985] border border-red-500/30",
    }[variant];

    const sizeStyles = {
      sm: "h-8 px-3 text-xs rounded-lg gap-1.5",
      md: "h-10 px-4 text-sm rounded-xl gap-2",
      lg: "h-11 px-5 text-sm rounded-xl gap-2.5",
      icon: "h-9 w-9 rounded-xl justify-center p-0",
    }[size];

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center transition-all duration-150 select-none cursor-pointer disabled:opacity-50 disabled:pointer-events-none",
          variantStyles,
          sizeStyles,
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
