"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { AlertCircle, Check, Info, MessageSquare, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "success" | "error" | "message";
  onClick?: () => void;
}

interface ToastContextValue {
  pushToast: (toast: Omit<ToastItem, "id">) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const pushToast = useCallback(
    (toast: Omit<ToastItem, "id">) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
      window.setTimeout(() => {
        dismissToast(id);
      }, 4500);
    },
    [dismissToast]
  );

  const value = useMemo(
    () => ({ pushToast, dismissToast }),
    [pushToast, dismissToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0"
      >
        {toasts.map((item) => {
          const Icon =
            item.variant === "error"
              ? AlertCircle
              : item.variant === "success"
                ? Check
                : item.variant === "message"
                  ? MessageSquare
                  : Info;

          return (
            <div
              key={item.id}
              onClick={() => {
                if (item.onClick) {
                  item.onClick();
                  dismissToast(item.id);
                }
              }}
              className={cn(
                "pointer-events-auto flex items-start gap-3 rounded-xl border bg-[var(--bg-elevated)] p-3.5 shadow-2xl animate-asterial-in",
                item.variant === "error"
                  ? "border-red-500/40"
                  : "border-[var(--border-strong)]",
                item.onClick ? "cursor-pointer hover:border-white/30" : ""
              )}
            >
              <div
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border",
                  item.variant === "error"
                    ? "border-red-500/30 bg-red-500/15 text-red-300"
                    : "border-white/15 bg-white/[0.06] text-white"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                  {item.title}
                </p>
                {item.description && (
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)] line-clamp-2">
                    {item.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={(e) => {
                  e.stopPropagation();
                  dismissToast(item.id);
                }}
                className="rounded-md p-1 text-zinc-500 hover:text-white cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
