import React from "react";
import { cn } from "@/lib/utils/cn";

interface ConstellationBackdropProps {
  className?: string;
}

/**
 * Restrained monochrome constellation coordinate lines for hero and empty states.
 */
export function ConstellationBackdrop({ className }: ConstellationBackdropProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden select-none",
        className
      )}
    >
      <svg
        className="h-full w-full opacity-[0.18]"
        viewBox="0 0 1200 720"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        <g stroke="#FFFFFF" strokeWidth="0.75" strokeOpacity="0.35">
          <line x1="140" y1="130" x2="310" y2="210" />
          <line x1="310" y1="210" x2="470" y2="145" />
          <line x1="310" y1="210" x2="360" y2="370" />
          <line x1="820" y1="160" x2="980" y2="250" />
          <line x1="980" y1="250" x2="1060" y2="140" />
          <line x1="980" y1="250" x2="900" y2="430" />
          <line x1="900" y1="430" x2="730" y2="510" />
          <line x1="210" y1="530" x2="360" y2="370" />
          <line x1="210" y1="530" x2="410" y2="590" />
        </g>
        <g fill="#FFFFFF">
          <circle cx="140" cy="130" r="2" fillOpacity="0.7" />
          <circle cx="310" cy="210" r="2.6" fillOpacity="0.9" />
          <circle cx="470" cy="145" r="1.8" fillOpacity="0.6" />
          <circle cx="360" cy="370" r="2.2" fillOpacity="0.75" />
          <circle cx="210" cy="530" r="2" fillOpacity="0.65" />
          <circle cx="410" cy="590" r="1.6" fillOpacity="0.5" />
          <circle cx="820" cy="160" r="2.2" fillOpacity="0.8" />
          <circle cx="980" cy="250" r="2.8" fillOpacity="0.9" />
          <circle cx="1060" cy="140" r="1.8" fillOpacity="0.65" />
          <circle cx="900" cy="430" r="2.2" fillOpacity="0.7" />
          <circle cx="730" cy="510" r="1.8" fillOpacity="0.55" />
        </g>
      </svg>
    </div>
  );
}
