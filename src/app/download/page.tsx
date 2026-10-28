import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Cpu, ShieldCheck, Smartphone, Terminal } from "lucide-react";
import { AsterialLogo } from "@/components/brand/AsterialLogo";
import { AppUpdatePanel } from "@/components/native/AppUpdatePanel";
import { ASTERIAL_BRAND } from "@/lib/constants/brand";
import { formatBytes } from "@/lib/utils/format";
import { resolveAsterialReleaseInfo } from "@/lib/version/githubRelease";

export const metadata: Metadata = {
  title: `Download Android APK (v${ASTERIAL_BRAND.version})`,
  description: `Download the standalone React Native Android APK for ${ASTERIAL_BRAND.name} v${ASTERIAL_BRAND.version} (${ASTERIAL_BRAND.androidPackageId}). Official Developer: ${ASTERIAL_BRAND.developer} (${ASTERIAL_BRAND.attribution}).`,
};

export const revalidate = 60;

export default async function DownloadPage() {
  const release = await resolveAsterialReleaseInfo();

  return (
    <div className="min-h-dvh flex flex-col bg-[var(--bg-void)] text-[var(--text-primary)]">
      <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--bg-void)] pt-safe">
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

      <main className="relative flex-1 py-14 sm:py-20">
        <div className="mx-auto max-w-5xl space-y-8 px-4 sm:px-6">
          <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-7 sm:p-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--accent-signal-subtle)] px-3.5 py-1 text-xs font-semibold text-[var(--text-primary)]">
              <Smartphone className="h-3.5 w-3.5" />
              <span>Dedicated React Native Android Release</span>
              <span>·</span>
              <span>v{release.semver}</span>
            </div>

            <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">
              {ASTERIAL_BRAND.name} for Android
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--text-secondary)]">
              Install the dedicated React Native 0.83{" "}
              <strong className="font-semibold text-[var(--text-primary)]">
                {ASTERIAL_BRAND.name} v{release.version}
              </strong>{" "}
              Android application. Includes native email authentication, 1:1 &amp;
              group messaging, Orbits communities, Moments temporary updates, and
              the chronological Social Feed — synchronized live with{" "}
              <span className="font-mono text-xs text-[var(--text-primary)]">
                asterial.vercel.app
              </span>{" "}
              with zero WebViews.
            </p>

            {release.tagReleasePublished && release.verifiedApkDownloadUrl ? (
              <div className="mt-8 space-y-5">
                <div className="flex flex-wrap items-center gap-3.5">
                  <a
                    href={release.verifiedApkDownloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2.5 rounded-2xl bg-white px-6 py-3.5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
                  >
                    Download Universal APK ({release.apkFileName})
                    {release.verifiedApkSizeBytes
                      ? ` · ${formatBytes(release.verifiedApkSizeBytes)}`
                      : ""}
                  </a>

                  {release.verifiedChecksumUrl ? (
                    <a
                      href={release.verifiedChecksumUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-5 py-3.5 text-sm font-semibold text-[var(--text-primary)] transition hover:border-white/40"
                    >
                      SHA-256 Checksum
                    </a>
                  ) : null}

                  <a
                    href={release.verifiedReleaseHtmlUrl || release.githubReleasesUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border-subtle)] px-5 py-3.5 text-sm font-medium text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
                  >
                    Release Notes ({release.expectedTag})
                  </a>
                </div>

                {release.verifiedAbiApks.length > 0 && (
                  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 space-y-2.5">
                    <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-zinc-400">
                      <Cpu className="h-3.5 w-3.5" />
                      <span>Architecture-Specific APKs</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {release.verifiedAbiApks.map((item) => (
                        <a
                          key={item.abi}
                          href={item.downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between rounded-xl border border-white/10 bg-[var(--bg-surface)] px-3.5 py-2.5 text-xs hover:border-white/30 transition-colors"
                        >
                          <span className="font-mono font-semibold text-white">
                            {item.abi}
                          </span>
                          <span className="font-mono text-[11px] text-zinc-400">
                            {formatBytes(item.sizeBytes)}
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-8 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                  <ShieldCheck className="h-4 w-4 text-[var(--accent-signal)]" />
                  <span>
                    Tag {release.expectedTag} release status: Awaiting official
                    Git tag publication
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-secondary)]">
                  {ASTERIAL_BRAND.name} never advertises unverified or unpublished
                  APK links as available. Pushing Git tag{" "}
                  <span className="font-mono text-[var(--text-primary)]">
                    {release.expectedTag}
                  </span>{" "}
                  triggers GitHub Actions to compile universal + multi-ABI APKs
                  (<span className="font-mono">arm64-v8a</span>,{" "}
                  <span className="font-mono">armeabi-v7a</span>,{" "}
                  <span className="font-mono">x86_64</span>), verify their
                  embedded Hermes bundle and signatures, compute{" "}
                  <span className="font-mono text-[var(--text-primary)]">
                    .sha256
                  </span>{" "}
                  digests, and publish them directly to GitHub Releases.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <a
                    href={release.githubReleasesUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-xs font-semibold text-zinc-950 transition hover:bg-zinc-200"
                  >
                    Open GitHub Releases
                  </a>
                  {release.latestPublishedTag && release.latestPublishedUrl ? (
                    <a
                      href={release.latestPublishedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 py-3 text-xs font-semibold text-[var(--text-primary)] transition hover:border-white/30"
                    >
                      Previous Published Tag ({release.latestPublishedTag})
                    </a>
                  ) : null}
                </div>
              </div>
            )}

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Application ID
                </p>
                <p className="mt-1 font-mono text-xs text-[var(--text-primary)]">
                  {release.androidPackageId}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Release Version
                </p>
                <p className="mt-1 font-mono text-xs text-[var(--text-primary)]">
                  {release.semver} (versionCode {release.versionCode}+)
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Signing Verification
                </p>
                <p className="mt-1 text-xs font-medium text-[var(--text-primary)]">
                  {release.signingStatus === "production-keystore"
                    ? "Production Keystore (V1/V2/V3)"
                    : release.signingStatus === "debug-signed"
                    ? "Debug-Signed Test Artifact"
                    : `Verified on ${release.expectedTag} Tag`}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Official Developer
                </p>
                <p className="mt-1 text-xs font-medium text-[var(--text-primary)]">
                  {release.developer} · {release.attribution}
                </p>
              </div>
            </div>

            <div className="mt-8 space-y-2.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5">
              <div className="flex items-center gap-2 font-mono text-xs text-zinc-300">
                <Terminal className="h-4 w-4" />
                <span>Verify APK Checksum (macOS / Linux / PowerShell)</span>
              </div>
              <pre className="overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-void)] p-3.5 font-mono text-xs text-zinc-300">
                {`sha256sum -c ${release.apkFileName}.sha256`}
              </pre>
            </div>
          </div>

          <AppUpdatePanel />
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
