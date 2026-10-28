import React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  GitBranch,
  Lock,
  ShieldCheck,
  Smartphone,
  Terminal,
} from "lucide-react";
import { AsterialLogo } from "@/components/brand/AsterialLogo";
import { ConstellationBackdrop } from "@/components/brand/ConstellationBackdrop";
import { AppUpdatePanel } from "@/components/native/AppUpdatePanel";
import { ASTERIAL_BRAND } from "@/lib/constants/brand";
import { buildApkFilename } from "@/lib/version/semver";

export default function DownloadPage() {
  const apkName = buildApkFilename(ASTERIAL_BRAND.semver, "release");

  return (
    <div className="min-h-dvh flex flex-col bg-[var(--bg-void)] text-[var(--text-primary)]">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--bg-void)]/85 backdrop-blur-md pt-safe">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 sm:px-6">
          <AsterialLogo showVersion size="sm" />
          <div className="flex items-center gap-3 text-xs">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] px-3 py-1.5 text-zinc-300 hover:bg-white/[0.06] hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Overview
            </Link>
            <Link
              href="/app/chats"
              className="inline-flex items-center rounded-xl bg-white px-3.5 py-1.5 font-medium text-zinc-950 hover:bg-zinc-200 transition-colors"
            >
              Open Web App
            </Link>
          </div>
        </div>
      </header>

      <main className="relative flex-1 py-14 sm:py-20 overflow-hidden">
        <ConstellationBackdrop />
        <div className="relative z-10 mx-auto max-w-5xl px-5 sm:px-6 space-y-12">
          {/* Hero */}
          <section className="max-w-3xl space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-white/[0.04] px-3.5 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-300">
              <Smartphone className="h-3.5 w-3.5" />
              <span>Android Application · v{ASTERIAL_BRAND.semver}</span>
            </div>

            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">
              {ASTERIAL_BRAND.name} for Android
            </h1>

            <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
              Sign in with the exact same {ASTERIAL_BRAND.name} account on your
              Android phone, tablet, or desktop browser. Conversations, groups,
              private media attachments, and read states stay synchronized in
              real time across every surface.
            </p>

            <div className="grid gap-3 pt-2 sm:grid-cols-3 text-xs">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5">
                <p className="text-zinc-500">Application ID</p>
                <p className="mt-1 font-mono font-medium text-white">
                  {ASTERIAL_BRAND.androidPackageId}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5">
                <p className="text-zinc-500">Current Version</p>
                <p className="mt-1 font-mono font-medium text-white">
                  {ASTERIAL_BRAND.semver} (Code {ASTERIAL_BRAND.versionCode})
                </p>
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5">
                <p className="text-zinc-500">Artifact Format</p>
                <p className="mt-1 font-mono font-medium text-white truncate">
                  {apkName}
                </p>
              </div>
            </div>
          </section>

          {/* Live Release & Update Checker */}
          <section aria-label="Release checker">
            <AppUpdatePanel />
          </section>

          {/* Installation & Architecture Cards */}
          <section className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 space-y-4">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="h-5 w-5 text-zinc-200" />
                <h2 className="text-base font-semibold text-white">
                  Android Installation Steps
                </h2>
              </div>
              <ol className="list-decimal pl-4 space-y-2.5 text-xs text-zinc-300 leading-relaxed">
                <li>
                  Download the official APK (<code className="font-mono">{apkName}</code>)
                  from the verified{" "}
                  <a
                    href={ASTERIAL_BRAND.githubReleasesUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-white"
                  >
                    GitHub Releases
                  </a>{" "}
                  page or the latest successful{" "}
                  <a
                    href={`${ASTERIAL_BRAND.githubActionsUrl}/workflows/android-release.yml`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-white"
                  >
                    Android Release CI run
                  </a>
                  .
                </li>
                <li>
                  Optional integrity check: compare the downloaded file against
                  the accompanying <code className="font-mono">.sha256</code>{" "}
                  checksum published in the build artifact.
                </li>
                <li>
                  Open the APK on Android 8.0+ (API 26+). When prompted by
                  Android&apos;s security controls, allow installation from your
                  browser or file manager.
                </li>
                <li>
                  Launch <strong>{ASTERIAL_BRAND.name}</strong> and sign in with
                  your existing credentials.
                </li>
              </ol>
            </div>

            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 space-y-4">
              <div className="flex items-center gap-2.5">
                <GitBranch className="h-5 w-5 text-zinc-200" />
                <h2 className="text-base font-semibold text-white">
                  Unified Web + APK Update Architecture
                </h2>
              </div>
              <div className="space-y-3 text-xs text-zinc-300 leading-relaxed">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                  <p>
                    <strong>Shared Live Backend:</strong> Both the website and
                    Android app connect to the same Supabase PostgreSQL,
                    Realtime, Auth, and private Storage project.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                  <p>
                    <strong>Dedicated Native Frontend:</strong> Built with React
                    Native + TypeScript and rendered via native Android Views
                    (never a WebView or iframe wrapper), sharing{" "}
                    <code className="font-mono">@asterial/core</code> validation
                    and domain models with the Next.js web application.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <Lock className="h-4 w-4 shrink-0 text-zinc-300 mt-0.5" />
                  <p>
                    <strong>Automated APK Builds:</strong> Compiled via Gradle
                    + Hermes in GitHub Actions with monotonic{" "}
                    <code className="font-mono">versionCode</code> increments
                    and SHA-256 checksums.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Checksum Verification Reference */}
          <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 space-y-3">
            <div className="flex items-center gap-2 font-mono text-xs text-zinc-300">
              <Terminal className="h-4 w-4" />
              <span>Verify APK Checksum (macOS / Linux / PowerShell)</span>
            </div>
            <pre className="overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-void)] p-3.5 font-mono text-xs text-zinc-300">
              {`sha256sum -c ${apkName}.sha256`}
            </pre>
          </section>
        </div>
      </main>

      <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-void)] py-8 pb-safe">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 sm:px-6 text-xs text-zinc-500">
          <span className="font-mono">
            {ASTERIAL_BRAND.name} v{ASTERIAL_BRAND.semver} · Developer:{" "}
            {ASTERIAL_BRAND.developer} · {ASTERIAL_BRAND.attribution}
          </span>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
