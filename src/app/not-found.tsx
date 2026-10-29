import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AsterialLogo } from "@/components/brand/AsterialLogo";
import { ConstellationBackdrop } from "@/components/brand/ConstellationBackdrop";

export default function NotFound() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[var(--bg-void)] px-6 text-center">
      <ConstellationBackdrop />
      <div className="relative z-10 flex max-w-md flex-col items-center">
        <AsterialLogo size="md" />
        <p className="mt-10 font-mono text-xs tracking-[0.2em] text-zinc-500 uppercase">
          404 · Uncharted Coordinate
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">
          This route does not exist in ASTERIAL.
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          The page or conversation link may have moved, expired, or never existed.
        </p>
        <div className="mt-8 flex items-center gap-3">
          <Link
            href="/app/chats"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-medium text-zinc-950 hover:bg-zinc-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Open Workspace
          </Link>
          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm text-zinc-200 hover:bg-white/[0.08] transition-colors"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
