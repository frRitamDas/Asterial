import React from "react";
import Link from "next/link";
import {
  CheckCheck,
  FileLock2,
  Layers,
  MessageSquare,
  Radio,
  Shield,
  Users,
} from "lucide-react";
import { AsterialLogo, AsterialMark } from "@/components/brand/AsterialLogo";
import { ConstellationBackdrop } from "@/components/brand/ConstellationBackdrop";
import { HomeSessionActions } from "@/components/brand/HomeSessionActions";
import { ASTERIAL_BRAND } from "@/lib/constants/brand";

const CAPABILITIES = [
  {
    icon: MessageSquare,
    title: "Real-Time 1:1 Messaging",
    description:
      "Idempotent direct threads, inline replies, edits, message deletion, reactions, and cursor-paginated history.",
  },
  {
    icon: Users,
    title: "Role-Governed Groups",
    description:
      "Owner, administrator, and member permissions enforced on the server and in PostgreSQL policies.",
  },
  {
    icon: CheckCheck,
    title: "Authentic Delivery & Read States",
    description:
      "Database-backed sent, delivered, and read transitions with optional per-user read-receipt privacy.",
  },
  {
    icon: FileLock2,
    title: "Private Scoped Attachments",
    description:
      "Images and documents verified by binary signature and served via short-lived signed URLs to members only.",
  },
  {
    icon: Radio,
    title: "Ephemeral Presence & Typing",
    description:
      "Realtime channel presence and auto-expiring typing signals separated from durable database writes.",
  },
  {
    icon: Shield,
    title: "Strict Row Level Security",
    description:
      "Every exposed table, membership boundary, user block, and storage object verified by PostgreSQL RLS.",
  },
] as const;

export default function HomePage() {
  return (
    <div className="min-h-dvh flex flex-col bg-[var(--bg-void)] text-[var(--text-primary)]">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[var(--bg-void)]/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <AsterialLogo showVersion size="sm" />
          <nav
            aria-label="Primary"
            className="hidden md:flex items-center gap-7 text-xs text-zinc-400"
          >
            <a href="#architecture" className="hover:text-white transition-colors">
              Capabilities
            </a>
            <a href="#security" className="hover:text-white transition-colors">
              Security Model
            </a>
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms
            </Link>
          </nav>
          <HomeSessionActions compact />
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-white/[0.08] py-24 sm:py-32">
          <ConstellationBackdrop />
          <div className="asterial-grid-bg pointer-events-none absolute inset-0 opacity-30" />

          <div className="relative z-10 mx-auto max-w-6xl px-6">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.04] px-3.5 py-1 font-mono text-[11px] tracking-[0.16em] text-zinc-300 uppercase">
                <span>{ASTERIAL_BRAND.name}</span>
                <span className="text-zinc-600">/</span>
                <span>Release {ASTERIAL_BRAND.version}</span>
                <span className="text-zinc-600">/</span>
                <span>{ASTERIAL_BRAND.attribution}</span>
              </div>

              <h1 className="mt-7 text-4xl font-semibold tracking-tight text-white sm:text-6xl sm:leading-[1.08]">
                Precision communication across your digital constellation.
              </h1>

              <p className="mt-6 max-w-2xl text-base text-zinc-400 leading-relaxed sm:text-lg">
                {ASTERIAL_BRAND.name} is a modern real-time messaging workspace
                designed around clarity, speed, and genuine access control.
                Connect one-to-one or coordinate in private groups with zero
                visual clutter.
              </p>

              <div className="mt-9">
                <HomeSessionActions />
              </div>

              <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-xs text-zinc-500">
                <span>Official Developer: {ASTERIAL_BRAND.developer}</span>
                <span className="hidden sm:inline text-zinc-700">·</span>
                <span>{ASTERIAL_BRAND.attribution}</span>
                <span className="hidden sm:inline text-zinc-700">·</span>
                <span>Web &amp; Installable PWA</span>
              </div>
            </div>

            {/* Architectural Workspace Preview Diagram */}
            <div className="mt-16 rounded-2xl border border-white/12 bg-[var(--bg-canvas)] p-2 shadow-2xl">
              <div className="grid rounded-xl border border-white/[0.07] bg-[var(--bg-surface)] md:grid-cols-[240px_1fr_240px] overflow-hidden">
                <div className="border-b md:border-b-0 md:border-r border-white/[0.07] p-4 space-y-3 bg-[var(--bg-void)]/60">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-widest text-zinc-400">
                      Channels
                    </span>
                    <span className="rounded-md border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
                      LIVE
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-white font-medium flex items-center justify-between">
                      <span>Direct Threads</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    </div>
                    <div className="rounded-lg border border-transparent px-3 py-2 text-zinc-400 flex items-center justify-between">
                      <span>Private Groups</span>
                      <Layers className="h-3.5 w-3.5 text-zinc-600" />
                    </div>
                    <div className="rounded-lg border border-transparent px-3 py-2 text-zinc-400 flex items-center justify-between">
                      <span>Contact Discovery</span>
                      <Users className="h-3.5 w-3.5 text-zinc-600" />
                    </div>
                  </div>
                </div>

                <div className="p-5 flex flex-col justify-between min-h-[210px]">
                  <div className="flex items-center justify-between border-b border-white/[0.07] pb-3">
                    <div className="flex items-center gap-2.5">
                      <AsterialMark size={28} />
                      <div>
                        <p className="text-xs font-semibold text-white">
                          {ASTERIAL_BRAND.emptyStateTitle}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          Authenticated real-time workspace · No demo filler
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-[10px] text-zinc-500">
                      RLS · TLS
                    </span>
                  </div>

                  <div className="my-5 space-y-2.5">
                    <div className="max-w-xs rounded-2xl rounded-bl-sm border border-white/10 bg-[var(--bubble-in-bg)] px-3.5 py-2 text-xs text-zinc-200">
                      Sign in or register to search handles and open a real
                      conversation.
                    </div>
                    <div className="ml-auto max-w-xs rounded-2xl rounded-br-sm bg-white px-3.5 py-2 text-xs text-zinc-950 font-medium">
                      Persisted in Supabase PostgreSQL with live delivery states.
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[var(--bg-void)] px-3.5 py-2 text-xs text-zinc-500">
                    <span>Multiline composer · Attachments · Reactions</span>
                    <span className="font-mono text-[10px] text-zinc-400">
                      ↵ Send
                    </span>
                  </div>
                </div>

                <div className="hidden md:flex flex-col justify-between border-l border-white/[0.07] p-4 bg-[var(--bg-void)]/40">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-400">
                      Context Panel
                    </p>
                    <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
                      Collapsible inspector for group roles, shared media,
                      read-receipt status, and privacy controls.
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5 font-mono text-[10px] text-zinc-400">
                    v{ASTERIAL_BRAND.version} · {ASTERIAL_BRAND.developer}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Capabilities Grid */}
        <section
          id="architecture"
          className="border-b border-white/[0.08] py-20 sm:py-24"
        >
          <div className="mx-auto max-w-6xl px-6">
            <div className="max-w-2xl">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
                Core Architecture
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Engineered from database policy to pixel.
              </h2>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {CAPABILITIES.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-white/[0.08] bg-[var(--bg-surface)] p-6 transition-colors hover:border-white/20"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] text-white">
                      <Icon className="h-4 w-4" />
                    </div>
                    <h3 className="mt-4 text-sm font-semibold text-white">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Security & Encryption Honesty Section */}
        <section id="security" className="py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="rounded-2xl border border-white/12 bg-[var(--bg-surface)] p-8 sm:p-10">
              <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
                    Security &amp; Transparency
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                    Verifiable access control without exaggerated claims.
                  </h2>
                  <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
                    {ASTERIAL_BRAND.securityNotice}
                  </p>
                </div>
                <div className="space-y-2.5 rounded-xl border border-white/[0.08] bg-[var(--bg-void)] p-5 text-xs text-zinc-300">
                  <div className="flex items-center justify-between border-b border-white/[0.07] pb-2">
                    <span className="text-zinc-500">Transport Security</span>
                    <span className="font-mono text-white">HTTPS / WSS TLS</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/[0.07] pb-2">
                    <span className="text-zinc-500">Authorization</span>
                    <span className="font-mono text-white">
                      PostgreSQL 17 RLS
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/[0.07] pb-2">
                    <span className="text-zinc-500">Media Storage</span>
                    <span className="font-mono text-white">
                      Private Signed URLs
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">E2E Cryptography</span>
                    <span className="font-mono text-zinc-400">
                      Not enabled in v{ASTERIAL_BRAND.version}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.08] bg-[var(--bg-void)] py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <AsterialLogo showVersion size="sm" />
            <p className="mt-2 font-mono text-xs text-zinc-500">
              Developer: {ASTERIAL_BRAND.developer} ·{" "}
              {ASTERIAL_BRAND.attribution}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs text-zinc-400">
            <Link href="/login" className="hover:text-white transition-colors">
              Sign in
            </Link>
            <Link href="/signup" className="hover:text-white transition-colors">
              Create account
            </Link>
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
