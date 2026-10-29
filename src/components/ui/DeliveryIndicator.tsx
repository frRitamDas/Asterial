"use client";

import React from "react";
import { AlertCircle, Check, CheckCheck, Clock } from "lucide-react";
import type { OutgoingDeliveryState } from "@/lib/types/database";
import { cn } from "@/lib/utils/cn";

export function DeliveryIndicator({
  state,
  className,
}: {
  state: OutgoingDeliveryState;
  className?: string;
}) {
  if (state === "sending") {
    return (
      <span
        title="Sending…"
        aria-label="Sending"
        className={cn("inline-flex items-center opacity-70", className)}
      >
        <Clock className="h-3 w-3 animate-pulse" />
      </span>
    );
  }

  if (state === "failed") {
    return (
      <span
        title="Delivery failed"
        aria-label="Failed to send"
        className={cn("inline-flex items-center text-red-400", className)}
      >
        <AlertCircle className="h-3.5 w-3.5" />
      </span>
    );
  }

  if (state === "read") {
    return (
      <span
        title="Read"
        aria-label="Read"
        className={cn(
          "inline-flex items-center text-[var(--accent-primary)]",
          className
        )}
      >
        <CheckCheck className="h-3.5 w-3.5" />
      </span>
    );
  }

  if (state === "delivered") {
    return (
      <span
        title="Delivered"
        aria-label="Delivered"
        className={cn("inline-flex items-center opacity-85", className)}
      >
        <CheckCheck className="h-3.5 w-3.5" />
      </span>
    );
  }

  return (
    <span
      title="Sent"
      aria-label="Sent"
      className={cn("inline-flex items-center opacity-75", className)}
    >
      <Check className="h-3.5 w-3.5" />
    </span>
  );
}
