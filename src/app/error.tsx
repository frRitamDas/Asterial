"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { AsterialLogo } from "@/components/brand/AsterialLogo";
import { Button } from "@/components/ui/Button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ASTERIAL Root Error]", error.message);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#060607] px-6 text-center text-white">
      <div className="mb-8">
        <AsterialLogo showAttribution />
      </div>
      <div className="max-w-md rounded-2xl border border-white/10 bg-[#0d0d10] p-7 space-y-4">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10">
          <AlertTriangle className="h-5 w-5 text-red-300" />
        </div>
        <h1 className="text-lg font-semibold">Unexpected application error</h1>
        <p className="text-xs text-zinc-400 leading-relaxed">
          {error.message ||
            "Something interrupted this screen. You can retry or return home."}
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button variant="primary" size="sm" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5" />
            Retry
          </Button>
          <Link
            href="/"
            className="inline-flex h-8 items-center rounded-lg border border-white/12 px-3 text-xs text-zinc-300 hover:bg-white/[0.06]"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
