import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCheck,
  Compass,
  Flame,
  MessageSquare,
  Orbit,
  Send,
  ShieldCheck,
  Smartphone,
  Users,
} from "lucide-react";
import { AsterialLogo } from "@/components/brand/AsterialLogo";
import { ASTERIAL_BRAND } from "@/lib/constants/brand";

export default function WelcomePage() {
  return (
    <div className="min-h-dvh bg-[var(--background)] text-[var(--text-primary)] flex flex-col justify-between">
      {/* Header */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="inline-flex">
          <AsterialLogo size="md" />
        </Link>

        <div className="flex items-center gap-2.5">
          <Link
            href="/download"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors"
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span>Android App</span>
          </Link>
          <Link
            href="/login"
            className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface)] px-3.5 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="rounded-[10px] bg-[var(--accent)] px-3.5 py-2 text-xs font-medium text-white hover:bg-[var(--accent-hover)] transition-colors"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Main Screen 1 — Welcome */}
      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-5 py-8 sm:px-8 lg:grid-cols-[1fr_1.08fr] lg:py-12">
        <div className="max-w-xl animate-asterial-rise">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            <span>Step 1 of 5 · Welcome to ASTERIAL</span>
          </div>

          <h1 className="mt-4 text-3xl font-semibold leading-[1.12] tracking-tight text-[var(--text-primary)] sm:text-4xl lg:text-[42px]">
            Direct messages, groups, and close circles without the clutter.
          </h1>

          <p className="mt-4 text-sm sm:text-base leading-relaxed text-[var(--text-secondary)]">
            ASTERIAL brings everyday chats, multi-member groups, trusted Orbits,
            24-hour Moments, and a clean Feed into a fast, quiet workspace built
            around real privacy controls.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[12px] bg-[var(--accent)] px-5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] transition-colors"
            >
              <span>Get Started</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface)] px-5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)] transition-colors"
            >
              Sign In
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface)] p-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                <MessageSquare className="h-4 w-4 text-[var(--accent)]" />
                <span>Messaging first</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                Replies, reactions, voice notes, shared media, and honest
                delivery receipts.
              </p>
            </div>
            <div className="rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface)] p-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                <ShieldCheck className="h-4 w-4 text-[var(--success)]" />
                <span>Privacy you control</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                Choose who sees your online status, read receipts, Moments, and
                group invites.
              </p>
            </div>
          </div>
        </div>

        {/* Subtle Visual Preview of the Messaging Layout */}
        <div className="animate-asterial-rise">
          <div className="overflow-hidden rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-2xl">
            {/* Window Top Bar */}
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-void)] px-4 py-2.5">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--border-strong)]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--border-strong)]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--border-strong)]" />
              </div>
              <span className="text-[11px] font-medium text-[var(--text-muted)]">
                ASTERIAL Workspace
              </span>
              <span className="text-[11px] text-[var(--text-muted)]">Chats</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[54px_200px_1fr] min-h-[340px]">
              {/* Rail */}
              <div className="hidden sm:flex flex-col items-center gap-3 border-r border-[var(--border-subtle)] bg-[var(--bg-void)] py-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[var(--accent)] text-white">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <Orbit className="h-4 w-4 text-[var(--text-muted)]" />
                <Flame className="h-4 w-4 text-[var(--text-muted)]" />
                <Compass className="h-4 w-4 text-[var(--text-muted)]" />
                <Users className="h-4 w-4 text-[var(--text-muted)]" />
              </div>

              {/* Conversation list */}
              <div className="hidden sm:flex flex-col border-r border-[var(--border-subtle)] bg-[var(--surface)] p-3 space-y-1.5">
                <div className="flex items-center justify-between px-1 pb-1">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">
                    Chats
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    All · Unread
                  </span>
                </div>
                <div className="rounded-[11px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--text-primary)]">
                      Aarav Sharma
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      10:14
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-[var(--text-secondary)]">
                    Sent 2 design attachments
                  </p>
                </div>
                <div className="rounded-[11px] p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--text-secondary)]">
                      Core Engineering
                    </span>
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[9px] font-semibold text-white">
                      2
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
                    Neha: Ready to ship this afternoon
                  </p>
                </div>
                <div className="rounded-[11px] p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--text-secondary)]">
                      Maya Chen
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      Tue
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
                    Added you to Close Orbit
                  </p>
                </div>
              </div>

              {/* Active conversation */}
              <div className="flex flex-col justify-between bg-[var(--background)] p-4">
                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-elevated)] text-xs font-semibold text-[var(--text-primary)]">
                      AS
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-[var(--success)] ring-2 ring-[var(--background)]" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[var(--text-primary)]">
                        Aarav Sharma
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        @aarav · Active now
                      </p>
                    </div>
                  </div>
                  <span className="rounded-[8px] border border-[var(--border-subtle)] bg-[var(--surface)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
                    Direct
                  </span>
                </div>

                <div className="space-y-2.5 py-4">
                  <div className="mx-auto w-fit rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-2.5 py-0.5 text-[10px] text-[var(--text-muted)]">
                    Today
                  </div>
                  <div className="max-w-[82%] rounded-[14px] rounded-bl-[4px] border border-[var(--border-subtle)] bg-[var(--bubble-in-bg)] px-3 py-2 text-xs leading-relaxed text-[var(--bubble-in-fg)]">
                    Morning! Have you tried the new Orbit room for the release?
                  </div>
                  <div className="ml-auto max-w-[82%] rounded-[14px] rounded-br-[4px] border border-[var(--bubble-out-border)] bg-[var(--bubble-out-bg)] px-3 py-2 text-xs leading-relaxed text-[var(--bubble-out-fg)]">
                    <p>
                      Just joined — the layout feels super clean on both desktop
                      and mobile.
                    </p>
                    <span className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[var(--text-muted)]">
                      10:14 <CheckCheck className="h-3 w-3 text-[var(--accent)]" />
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2">
                  <span className="text-xs text-[var(--text-muted)]">
                    Write a message…
                  </span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[var(--accent)] text-white">
                    <Send className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-[var(--border-subtle)] px-5 py-5 text-xs text-[var(--text-muted)] sm:px-8">
        <span>
          {ASTERIAL_BRAND.name} · Developer: {ASTERIAL_BRAND.developer} ·{" "}
          {ASTERIAL_BRAND.attribution}
        </span>
        <div className="flex items-center gap-5">
          <Link
            href="/download"
            className="hover:text-[var(--text-primary)] transition-colors"
          >
            Download
          </Link>
          <Link
            href="/privacy"
            className="hover:text-[var(--text-primary)] transition-colors"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="hover:text-[var(--text-primary)] transition-colors"
          >
            Terms
          </Link>
        </div>
      </footer>
    </div>
  );
}
