import React from "react";
import Link from "next/link";
import { ShieldCheck, Sparkles, Zap } from "lucide-react";
import { AsterialLogo } from "@/components/brand/AsterialLogo";
import { ConstellationBackdrop } from "@/components/brand/ConstellationBackdrop";
import { ASTERIAL_BRAND } from "@/lib/constants/brand";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: AuthShellProps) {
  return (
    <div className="grid min-h-dvh w-full lg:grid-cols-[1.08fr_1fr] bg-[var(--bg-void)]">
      {/* Left Brand Panel (Desktop) */}
      <aside className="relative hidden lg:flex flex-col justify-between border-r border-[var(--border-subtle)] bg-[var(--bg-void)] p-12 overflow-hidden">
        <ConstellationBackdrop />
        <div className="relative z-10">
          <Link href="/" className="inline-block">
            <AsterialLogo showVersion showAttribution size="md" />
          </Link>
        </div>

        <div className="relative z-10 max-w-md space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.03] px-3 py-1 font-mono text-[11px] tracking-wider text-zinc-300 uppercase">
            <span>Release {ASTERIAL_BRAND.version}</span>
            <span className="text-zinc-600">·</span>
            <span>Constellation Architecture</span>
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-white leading-snug">
            Precision real-time messaging built for signal, not noise.
          </h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Direct conversations, role-governed groups, authentic delivery
            receipts, and private media — engineered in a distraction-free
            monochrome workspace.
          </p>

          <div className="grid gap-3 pt-2">
            <div className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
              <Zap className="h-4 w-4 text-zinc-200 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-white">
                  Instant Realtime Sync
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Live messages, presence states, typing signals, and reactions.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
              <ShieldCheck className="h-4 w-4 text-zinc-200 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-white">
                  Row-Level Database Security
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Strict membership verification and private signed attachment
                  delivery.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
              <Sparkles className="h-4 w-4 text-zinc-200 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-white">
                  Original Monochrome Craft
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Engineered by {ASTERIAL_BRAND.developer} ·{" "}
                  {ASTERIAL_BRAND.attribution}.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-zinc-500 font-mono">
          <span>
            {ASTERIAL_BRAND.name} v{ASTERIAL_BRAND.version} · Developer:{" "}
            {ASTERIAL_BRAND.developer}
          </span>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-zinc-300 transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-zinc-300 transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </aside>

      {/* Right Interactive Auth Panel */}
      <main className="relative flex flex-col justify-between px-6 py-8 sm:px-12 bg-[var(--bg-canvas)]">
        <div className="flex items-center justify-between lg:justify-end">
          <Link href="/" className="lg:hidden">
            <AsterialLogo showVersion size="sm" />
          </Link>
          <Link
            href="/"
            className="text-xs font-medium text-zinc-400 hover:text-white transition-colors"
          >
            Back to Home
          </Link>
        </div>

        <div className="mx-auto w-full max-w-md py-10">
          <div className="mb-7">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              {title}
            </h1>
            <p className="mt-1.5 text-sm text-zinc-400">{subtitle}</p>
          </div>

          {children}

          {footer && <div className="mt-6 pt-6 border-t border-white/[0.08]">{footer}</div>}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-600 font-mono lg:justify-center">
          <span>
            {ASTERIAL_BRAND.name} v{ASTERIAL_BRAND.version} ·{" "}
            {ASTERIAL_BRAND.attribution}
          </span>
          <div className="flex items-center gap-3 lg:hidden">
            <Link href="/privacy" className="hover:text-zinc-300">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-zinc-300">
              Terms
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
