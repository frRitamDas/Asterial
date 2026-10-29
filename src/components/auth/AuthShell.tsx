import React from "react";
import Link from "next/link";
import {
  CheckCheck,
  Compass,
  Flame,
  Lock,
  MessageSquare,
  Orbit,
  Send,
  Users,
} from "lucide-react";
import { AsterialLogo, AsterialMark } from "@/components/brand/AsterialLogo";
import { ASTERIAL_BRAND } from "@/lib/constants/brand";
import { cn } from "@/lib/utils/cn";

interface AuthShellProps {
  title: string;
  subtitle: string;
  activeTab?: "login" | "signup";
  stepLabel?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthShell({
  title,
  subtitle,
  activeTab,
  stepLabel = "Step 2 of 5 · Authentication",
  children,
  footer,
}: AuthShellProps) {
  return (
    <div className="grid min-h-dvh w-full bg-[var(--background)] text-[var(--text-primary)] lg:grid-cols-[1.06fr_0.94fr]">
      {/* Left Desktop Product Preview */}
      <aside className="relative hidden min-h-dvh flex-col justify-between border-r border-[var(--border-subtle)] bg-[var(--bg-void)] p-10 xl:p-14 lg:flex">
        <div>
          <Link href="/welcome" className="inline-flex">
            <AsterialLogo size="md" />
          </Link>
        </div>

        <div className="my-10 max-w-[560px]">
          <p className="text-xs font-medium tracking-wide text-[var(--accent)]">
            Messaging-first communication
          </p>
          <h2 className="mt-2.5 text-3xl font-semibold leading-tight tracking-tight text-[var(--text-primary)] xl:text-4xl">
            Every conversation, group, and close circle in one calm workspace.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
            Fast direct messages, structured groups, trusted Orbits, ephemeral
            Moments, and a chronological Feed — backed by strict account-level
            privacy controls.
          </p>

          {/* Realistic restrained preview of the v1.6.0 messaging layout */}
          <div className="mt-8 overflow-hidden rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-xl">
            <div className="grid grid-cols-[48px_176px_1fr] min-h-[268px]">
              {/* Mini Rail */}
              <div className="flex flex-col items-center gap-3 border-r border-[var(--border-subtle)] bg-[var(--bg-void)] py-3.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[var(--accent)] text-white">
                  <MessageSquare className="h-3.5 w-3.5" />
                </div>
                <Orbit className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                <Flame className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                <Compass className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                <Users className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              </div>

              {/* Mini Conversation List */}
              <div className="border-r border-[var(--border-subtle)] bg-[var(--surface)] p-2.5 space-y-1.5">
                <p className="px-1.5 py-1 text-[11px] font-semibold text-[var(--text-primary)]">
                  Chats
                </p>
                <div className="rounded-[10px] bg-[var(--surface-elevated)] px-2.5 py-2 border border-[var(--border-subtle)]">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-[var(--text-primary)]">
                      Maya Chen
                    </span>
                    <span className="text-[9px] text-[var(--text-muted)]">
                      09:42
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[10px] text-[var(--text-secondary)]">
                    Shared the updated release notes
                  </p>
                </div>
                <div className="rounded-[10px] px-2.5 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                      Design Systems
                    </span>
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[9px] font-semibold text-white">
                      3
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[10px] text-[var(--text-muted)]">
                    Arjun: Token contrast looks clean
                  </p>
                </div>
                <div className="rounded-[10px] px-2.5 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                      Elena Rostova
                    </span>
                    <span className="text-[9px] text-[var(--text-muted)]">
                      Yesterday
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[10px] text-[var(--text-muted)]">
                    See you at 6 PM
                  </p>
                </div>
              </div>

              {/* Mini Active Thread */}
              <div className="flex flex-col justify-between bg-[var(--background)] p-3">
                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
                  <div className="flex items-center gap-2">
                    <div className="relative flex h-6 w-6 items-center justify-center rounded-full bg-[var(--surface-elevated)] text-[10px] font-semibold text-[var(--text-primary)]">
                      MC
                      <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-[var(--success)] ring-2 ring-[var(--background)]" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold leading-none text-[var(--text-primary)]">
                        Maya Chen
                      </p>
                      <p className="mt-0.5 text-[9px] text-[var(--text-muted)]">
                        @maya · Active now
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 py-3">
                  <div className="max-w-[84%] rounded-[12px] rounded-bl-[4px] border border-[var(--border-subtle)] bg-[var(--bubble-in-bg)] px-2.5 py-1.5 text-[11px] text-[var(--bubble-in-fg)]">
                    Did the spacing and light mode pass land cleanly?
                  </div>
                  <div className="ml-auto max-w-[84%] rounded-[12px] rounded-br-[4px] border border-[var(--bubble-out-border)] bg-[var(--bubble-out-bg)] px-2.5 py-1.5 text-[11px] text-[var(--bubble-out-fg)]">
                    <span>Yes — synced across web and Android.</span>
                    <span className="mt-0.5 flex items-center justify-end gap-1 text-[9px] text-[var(--text-muted)]">
                      09:42 <CheckCheck className="h-3 w-3 text-[var(--accent)]" />
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface)] px-2.5 py-1.5">
                  <span className="text-[10px] text-[var(--text-muted)]">
                    Message Maya Chen…
                  </span>
                  <span className="flex h-5 w-5 items-center justify-center rounded-[6px] bg-[var(--accent)] text-white">
                    <Send className="h-2.5 w-2.5" />
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <Lock className="h-3.5 w-3.5 text-[var(--text-secondary)] shrink-0" />
            <span>
              Row-level access policies enforce conversation, profile, and media
              boundaries.
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 text-xs text-[var(--text-muted)]">
          <span>
            {ASTERIAL_BRAND.name} · {ASTERIAL_BRAND.attribution}
          </span>
          <div className="flex gap-4">
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
        </div>
      </aside>

      {/* Right Authentication Column */}
      <main className="flex min-h-dvh flex-col justify-between bg-[var(--background)] px-5 py-6 sm:px-8 sm:py-8 lg:px-10 xl:px-14">
        <div className="flex items-center justify-between gap-3">
          <Link href="/welcome" className="inline-flex lg:hidden">
            <AsterialLogo size="sm" />
          </Link>
          <span className="hidden text-xs text-[var(--text-muted)] lg:inline-flex">
            {stepLabel}
          </span>
          <Link
            href="/welcome"
            className="ml-auto rounded-[9px] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors"
          >
            Welcome overview
          </Link>
        </div>

        <div className="mx-auto w-full max-w-[420px] py-8 sm:py-12 animate-asterial-rise">
          <div className="mb-6">
            <div className="mb-4 flex items-center gap-2.5">
              <AsterialMark size={30} />
              <span className="text-[11px] font-medium tracking-wide text-[var(--text-muted)] lg:hidden">
                {stepLabel}
              </span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
              {title}
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
              {subtitle}
            </p>
          </div>

          {activeTab && (
            <div
              role="tablist"
              aria-label="Authentication mode"
              className="mb-5 grid grid-cols-2 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface)] p-1"
            >
              <Link
                href="/login"
                role="tab"
                aria-selected={activeTab === "login"}
                className={cn(
                  "rounded-[9px] py-2 text-center text-xs font-medium transition-colors",
                  activeTab === "login"
                    ? "bg-[var(--surface-elevated)] text-[var(--text-primary)] shadow-xs border border-[var(--border-subtle)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                )}
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                role="tab"
                aria-selected={activeTab === "signup"}
                className={cn(
                  "rounded-[9px] py-2 text-center text-xs font-medium transition-colors",
                  activeTab === "signup"
                    ? "bg-[var(--surface-elevated)] text-[var(--text-primary)] shadow-xs border border-[var(--border-subtle)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                )}
              >
                Create Account
              </Link>
            </div>
          )}

          <div className="rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface)] p-5 sm:p-6 shadow-lg">
            {children}
            {footer && (
              <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
                {footer}
              </div>
            )}
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
          <span>Developer: {ASTERIAL_BRAND.developer}</span>
          <div className="flex gap-4 lg:hidden">
            <Link href="/privacy" className="hover:text-[var(--text-primary)]">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-[var(--text-primary)]">
              Terms
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
