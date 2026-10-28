"use client";

import { useCallback, useEffect, useState } from "react";
import { ASTERIAL_BRAND } from "@/lib/constants/brand";
import { formatBytes } from "@/lib/utils/format";
import { isUpdateAvailable } from "@/lib/version/semver";

interface ReleaseApiPayload {
  product: string;
  version: string;
  semver: string;
  versionCode: number;
  channel: string;
  developer: string;
  attribution: string;
  androidPackageId: string;
  githubReleasesUrl: string;
  expectedTag: string;
  apkFileName: string;
  apkDownloadUrl: string;
  tagReleasePublished: boolean;
  verifiedApkDownloadUrl: string | null;
  verifiedChecksumUrl: string | null;
  verifiedApkSizeBytes: number | null;
  verifiedReleaseHtmlUrl: string | null;
  signingStatus: "production-keystore" | "debug-signed" | "pending-release";
  latestPublishedTag: string | null;
  latestPublishedUrl: string | null;
  releaseDate: string;
  releaseNotes: string[];
}

export function AppUpdatePanel({ compact = false }: { compact?: boolean }) {
  const [checking, setChecking] = useState(false);
  const [releaseInfo, setReleaseInfo] = useState<ReleaseApiPayload | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  const checkRelease = useCallback(async () => {
    setChecking(true);
    setCheckError(null);
    try {
      const res = await fetch(`${ASTERIAL_BRAND.productionUrl}/api/release`, {
        cache: "no-store",
      }).catch(() => fetch("/api/release", { cache: "no-store" }));

      if (!res.ok) {
        throw new Error(`Release check returned HTTP ${res.status}`);
      }
      const data = (await res.json()) as ReleaseApiPayload;
      setReleaseInfo(data);
    } catch {
      setCheckError(
        "Unable to query live release feed right now. Showing bundled release metadata."
      );
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void checkRelease();
    }, 0);
    return () => window.clearTimeout(id);
  }, [checkRelease]);

  const installedSemver = ASTERIAL_BRAND.semver;
  const installedCode = ASTERIAL_BRAND.versionCode;
  const latestSemver = releaseInfo?.semver || ASTERIAL_BRAND.semver;
  const latestCode = releaseInfo?.versionCode || ASTERIAL_BRAND.versionCode;

  const updateAvailable = isUpdateAvailable({
    currentVersion: installedSemver,
    currentVersionCode: installedCode,
    latestVersion: latestSemver,
    latestVersionCode: latestCode,
  });

  const verifiedApkUrl = releaseInfo?.verifiedApkDownloadUrl || null;
  const verifiedChecksumUrl = releaseInfo?.verifiedChecksumUrl || null;
  const releasesPageUrl = "/download";

  return (
    <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-signal)]">
            Release & Native Android APK
          </p>
          <h3 className="mt-1 font-display text-lg font-bold text-[var(--text-primary)]">
            {ASTERIAL_BRAND.name} v{ASTERIAL_BRAND.version}
          </h3>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            Web Build · Semantic {installedSemver} (versionCode {installedCode}) ·{" "}
            Package{" "}
            <span className="font-mono text-[var(--text-primary)]">
              {ASTERIAL_BRAND.androidPackageId}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => void checkRelease()}
          disabled={checking}
          className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] transition hover:border-[var(--border-strong)] disabled:opacity-50"
        >
          {checking ? "Checking…" : "Check for updates"}
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/60 p-4">
        {updateAvailable ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--accent)]">
                New release available: v{latestSemver} (build {latestCode})
              </p>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                Download the latest React Native Android APK or reload to update.
              </p>
            </div>
            <a
              href={verifiedApkUrl || releasesPageUrl}
              target={verifiedApkUrl ? "_blank" : undefined}
              rel={verifiedApkUrl ? "noreferrer" : undefined}
              className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-zinc-200"
            >
              {verifiedApkUrl ? "Download Verified APK" : "Open Download Center"}
            </a>
          </div>
        ) : releaseInfo?.tagReleasePublished && verifiedApkUrl ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--success)]">
                Official {releaseInfo.expectedTag} release verified & ready
              </p>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                {releaseInfo.apkFileName}
                {releaseInfo.verifiedApkSizeBytes
                  ? ` (${formatBytes(releaseInfo.verifiedApkSizeBytes)})`
                  : ""}{" "}
                ·{" "}
                {releaseInfo.signingStatus === "production-keystore"
                  ? "Production keystore signed"
                  : "Debug-signed standalone APK"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={verifiedApkUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-xl bg-white px-3.5 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-zinc-200"
              >
                Download APK ({releaseInfo.expectedTag})
              </a>
              {verifiedChecksumUrl ? (
                <a
                  href={verifiedChecksumUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
                >
                  SHA-256
                </a>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                Web workspace running v{installedSemver} (versionCode {installedCode})
              </p>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                Official release <span className="font-mono">v{installedSemver}</span>{" "}
                publishes verified universal and multi-ABI Android builds automatically.
              </p>
            </div>
            <a
              href={releasesPageUrl}
              className="inline-flex items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] transition hover:border-[var(--accent)]/40"
            >
              Download Center
            </a>
          </div>
        )}

        {checkError ? (
          <p className="mt-2 text-[11px] text-[var(--text-muted)]">
            {checkError}
          </p>
        ) : null}
      </div>

      {!compact ? (
        <div className="mt-4 space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            v{ASTERIAL_BRAND.version} Release Highlights
          </p>
          <ul className="space-y-1 text-xs leading-relaxed text-[var(--text-secondary)]">
            {(releaseInfo?.releaseNotes || ASTERIAL_BRAND.releaseNotes).map(
              (item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                  <span>{item}</span>
                </li>
              )
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
