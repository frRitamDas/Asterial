"use client";

import React, { useCallback, useState } from "react";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  RefreshCw,
  Smartphone,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ASTERIAL_BRAND } from "@/lib/constants/brand";
import { buildApkFilename, isUpdateAvailable } from "@/lib/version/semver";

interface RemoteReleasePayload {
  version: string;
  versionCode: number;
  commitSha: string | null;
  releaseDate: string;
  releaseNotes: string[];
  releasesUrl: string;
  apkDownloadUrl: string;
  hasPublishedGithubAsset: boolean;
}

export function AppUpdatePanel() {
  const installedVersion = ASTERIAL_BRAND.semver;
  const installedCode = ASTERIAL_BRAND.versionCode;
  const buildCommit =
    (process.env.NEXT_PUBLIC_GIT_SHA || "").slice(0, 7) || null;

  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [remote, setRemote] = useState<RemoteReleasePayload | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  const openExternalUrl = useCallback((url: string) => {
    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }, []);

  const checkUpdates = useCallback(async () => {
    setChecking(true);
    setCheckError(null);

    try {
      const apiRes = await fetch("/api/release", {
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });

      if (!apiRes.ok) {
        throw new Error(`Release service responded with ${apiRes.status}`);
      }

      const apiData = (await apiRes.json()) as {
        version: string;
        versionCode: number;
        commitSha: string | null;
        releaseDate: string;
        releaseNotes: string[];
        releasesUrl: string;
      };

      let latestVersion = apiData.version;
      const latestVersionCode = apiData.versionCode;
      let releaseNotes = apiData.releaseNotes || [];
      let apkDownloadUrl = apiData.releasesUrl;
      let hasPublishedGithubAsset = false;

      try {
        const ghRes = await fetch(
          `https://api.github.com/repos/${ASTERIAL_BRAND.githubRepo}/releases/latest`,
          {
            headers: { Accept: "application/vnd.github+json" },
            signal: AbortSignal.timeout(6000),
          }
        );
        if (ghRes.ok) {
          const ghJson = (await ghRes.json()) as {
            tag_name?: string;
            body?: string;
            html_url?: string;
            assets?: Array<{ name?: string; browser_download_url?: string }>;
          };
          if (ghJson.tag_name) {
            latestVersion = ghJson.tag_name.replace(/^v/i, "");
          }
          const apkAsset = (ghJson.assets || []).find(
            (a) =>
              typeof a.name === "string" &&
              a.name.endsWith(".apk") &&
              typeof a.browser_download_url === "string"
          );
          if (apkAsset?.browser_download_url) {
            apkDownloadUrl = apkAsset.browser_download_url;
            hasPublishedGithubAsset = true;
          } else if (ghJson.html_url) {
            apkDownloadUrl = ghJson.html_url;
          }
          if (ghJson.body && ghJson.body.trim().length > 0) {
            const parsedLines = ghJson.body
              .split("\n")
              .map((l) => l.replace(/^[-*]\s*/, "").trim())
              .filter((l) => l.length > 0 && !l.startsWith("#"))
              .slice(0, 6);
            if (parsedLines.length > 0) {
              releaseNotes = parsedLines;
            }
          }
        }
      } catch {
        // GitHub API rate-limited or unreachable; /api/release remains authoritative
      }

      setRemote({
        version: latestVersion,
        versionCode: latestVersionCode,
        commitSha: apiData.commitSha,
        releaseDate: apiData.releaseDate,
        releaseNotes,
        releasesUrl: apiData.releasesUrl,
        apkDownloadUrl,
        hasPublishedGithubAsset,
      });
      setCheckedAt(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    } catch (err) {
      setCheckError(
        err instanceof Error
          ? err.message
          : "Unable to reach release metadata server. Check your connection and try again."
      );
    } finally {
      setChecking(false);
    }
  }, []);

  const updateAvailable = remote
    ? isUpdateAvailable({
        currentVersion: installedVersion,
        currentVersionCode: installedCode,
        latestVersion: remote.version,
        latestVersionCode: remote.versionCode,
      })
    : false;

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)]">
            <Smartphone className="h-4.5 w-4.5 text-[var(--text-primary)]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-white">
                Android App &amp; Release Updates
              </h3>
              <span className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-0.5 font-mono text-[10px] text-zinc-400">
                Web Workspace
              </span>
            </div>
            <p className="mt-0.5 text-xs text-zinc-400">
              Android Package{" "}
              <code className="font-mono">
                {ASTERIAL_BRAND.androidPackageId}
              </code>{" "}
              · Release v{installedVersion} (code {installedCode}
              {buildCommit ? ` · ${buildCommit}` : ""})
            </p>
          </div>
        </div>

        <Button
          size="sm"
          variant="secondary"
          loading={checking}
          onClick={() => void checkUpdates()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Check releases
        </Button>
      </div>

      {checkError && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Could not verify latest release</p>
            <p className="mt-0.5 opacity-90">{checkError}</p>
          </div>
        </div>
      )}

      {remote && !checkError && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {updateAvailable ? (
                <>
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-semibold text-white">
                    Newer release published: v{remote.version} (code{" "}
                    {remote.versionCode})
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-white">
                    Aligned with latest release (v{remote.version})
                  </span>
                </>
              )}
            </div>
            {checkedAt && (
              <span className="font-mono text-[10px] text-zinc-500">
                Checked {checkedAt}
              </span>
            )}
          </div>

          {remote.releaseNotes.length > 0 && (
            <div className="space-y-1.5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                Release Notes · v{remote.version}
              </p>
              <ul className="list-disc pl-4 space-y-1 text-xs text-zinc-300">
                {remote.releaseNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {remote.hasPublishedGithubAsset ? (
              <Button
                size="sm"
                variant="primary"
                onClick={() => openExternalUrl(remote.apkDownloadUrl)}
              >
                <Download className="h-3.5 w-3.5" />
                Download official APK (v{remote.version})
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => openExternalUrl(remote.releasesUrl)}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open GitHub Releases
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                openExternalUrl(
                  `${ASTERIAL_BRAND.githubActionsUrl}/workflows/android-release.yml`
                )
              }
            >
              <ExternalLink className="h-3.5 w-3.5" />
              CI Build Artifacts ({buildApkFilename(remote.version, "release")})
            </Button>
          </div>
        </div>
      )}

      <p className="text-[11px] text-zinc-500 leading-relaxed">
        The ASTERIAL website deploys automatically via Vercel, while the
        dedicated React Native Android application (
        <code className="font-mono">{ASTERIAL_BRAND.androidPackageId}</code>) is
        compiled natively via GitHub Actions against the shared Supabase
        backend.
      </p>
    </div>
  );
}
