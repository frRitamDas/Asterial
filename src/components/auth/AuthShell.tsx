import React from "react";
import Link from "next/link";
import { Globe, MessageSquare, ShieldCheck } from "lucide-react";
import { AsterialLogo } from "@/components/brand/AsterialLogo";
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
    <div className="grid min-h-dvh w-full lg:grid-cols-[1.06fr_1fr] bg-[var(--bg-void)]">
      {/* Left Brand Panel (Desktop) */}
      <aside className="relative hidden lg:flex flex-col justify-between border-r border-[var(--border-subtle)] bg-[var(--bg-void)] p-12 overflow-hidden">
        <div className="asterial-grid-bg pointer-events-none absolute inset-0 opacity-20" />
        <div className="relative z-10">
          <Link href="/" className="inline-block">
            <AsterialLogo showVersion showAttribution size="md" />
          </Link>
        </div>

        <div className="relative z-10 max-w-md space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-[var(--bg-surface)] px-3 py-1 font-mono text-[11px] tracking-wider text-zinc-300 uppercase">
            <span>Release {ASTERIAL_BRAND.version}</span>
            <span className="text-zinc-600">·</span>
            <span>Web &amp; Native Android</span>
          </div>
          <h2 className="text-4xl font-semibold tracking-tight text-white leading-[1.08]">
            Your people. Your conversations. All in one place.
          </h2>
          <p className="text-sm text-zinc-400 leading-relaxed max-w-sm">
            A calmer way to stay connected. Pick up a conversation, share a
            moment, or bring your group together — without the clutter.
          </p>

          <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#101014] p-4 shadow-2xl shadow-black/30">
            <div className="mb-4 flex items-center justify-between border-b border-white/[0.07] pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-bold text-black">A</div>
                <div>
                  <p className="text-sm font-semibold text-white">Alex Morgan</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-500"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> online now</p>
                </div>
              </div>
              <span className="text-xl text-zinc-400">···</span>
            </div>
            <div className="space-y-3">
              <div className="max-w-[82%] rounded-2xl rounded-bl-md bg-[#222228] px-3.5 py-3 text-xs leading-relaxed text-zinc-200">Hey! Are we still on for this evening?</div>
              <div className="ml-auto max-w-[78%] rounded-2xl rounded-br-md bg-white px-3.5 py-3 text-xs leading-relaxed text-zinc-900">Absolutely. See you at 6 ✨</div>
              <div className="max-w-[68%] rounded-2xl rounded-bl-md bg-[#222228] px-3.5 py-3 text-xs leading-relaxed text-zinc-200">Perfect, looking forward to it.</div>
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-full border border-white/[0.08] bg-[#18181d] px-4 py-3">
              <span className="flex-1 text-xs text-zinc-500">Write a message…</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-base text-black">↑</span>
            </div>
          </div>

          <div className="grid gap-3 pt-2">
            <div className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-[var(--bg-surface)] p-3.5">
              <MessageSquare className="h-4 w-4 text-zinc-200 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-white">
                  Real-Time Messaging &amp; Presence
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  1:1 and group chats, replies, reactions, and private media.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-[var(--bg-surface)] p-3.5">
              <Globe className="h-4 w-4 text-zinc-200 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-white">
                  Orbits, Moments &amp; Social Feed
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Public or private communities, 6h–48h Moments, and
                  chronological posts.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-[var(--bg-surface)] p-3.5">
              <ShieldCheck className="h-4 w-4 text-zinc-200 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-white">
                  PostgreSQL Row Level Security
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

        <div className="animate-asterial-rise mx-auto w-full max-w-md py-10 sm:py-12">
          <div className="mb-7 rounded-[28px] border border-white/[0.08] bg-[var(--bg-surface)] p-5 shadow-2xl shadow-black/20 sm:p-7">
            <div className="mb-6 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              Secure account access
            </div>
            <div className="mb-7">
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                {title}
              </h1>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{subtitle}</p>
            </div>

            {children}

            {footer && (
              <div className="mt-6 border-t border-white/[0.08] pt-6">
                {footer}
              </div>
            )}
          </div>
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
