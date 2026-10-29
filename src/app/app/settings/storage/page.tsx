"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  FileText,
  Film,
  HardDrive,
  Image as ImageIcon,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { SettingsMobileSubpageHeader } from "@/components/settings/SettingsNav";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import {
  clearSignedUrlCache,
  getSignedUrlCacheCount,
} from "@/lib/supabase/storage";
import {
  settingsService,
  type UserStorageSummary,
} from "@/lib/services/settings.service";
import { formatBytes, formatShortTime } from "@/lib/utils/format";

function computeLocalBrowserBytes(): { draftBytes: number; draftCount: number } {
  if (typeof window === "undefined") return { draftBytes: 0, draftCount: 0 };
  try {
    let bytes = 0;
    let count = 0;
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith("asterial_drafts_v1:")) {
        const val = window.localStorage.getItem(key) || "";
        bytes += val.length * 2;
        const parsed = JSON.parse(val) as Record<string, string>;
        count += Object.keys(parsed).length;
      }
    }
    return { draftBytes: bytes, draftCount: count };
  } catch {
    return { draftBytes: 0, draftCount: 0 };
  }
}

export default function SettingsStoragePage() {
  const { user } = useWorkspace();
  const { pushToast } = useToast();

  const [summary, setSummary] = useState<UserStorageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [signedCacheCount, setSignedCacheCount] = useState<number>(() =>
    getSignedUrlCacheCount()
  );
  const [localStats, setLocalStats] = useState<{
    draftBytes: number;
    draftCount: number;
  }>(() => computeLocalBrowserBytes());

  const loadStorageSummary = useCallback(async () => {
    setLoading(true);
    setErrorText(null);
    try {
      const data = await settingsService.getMyStorageSummary();
      setSummary(data);
      setSignedCacheCount(getSignedUrlCacheCount());
      setLocalStats(computeLocalBrowserBytes());
    } catch (err) {
      setErrorText(
        err instanceof Error ? err.message : "Could not load storage summary."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadStorageSummary();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadStorageSummary]);

  const handleClearSignedMediaCache = () => {
    const cleared = clearSignedUrlCache();
    setSignedCacheCount(0);
    pushToast({
      title: "Cleared local media URL cache",
      description: `Removed ${cleared} cached signed media link(s). Stored account files were not deleted.`,
      variant: "success",
    });
  };

  const handleClearLocalDrafts = () => {
    if (!user?.id || typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(`asterial_drafts_v1:${user.id}`);
      setLocalStats(computeLocalBrowserBytes());
      pushToast({
        title: "Cleared unsent local drafts",
        variant: "success",
      });
    } catch {
      // Ignore storage error
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <SettingsMobileSubpageHeader title="Storage & Media" />

      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-7">
        <div className="mx-auto w-full max-w-2xl space-y-6 pb-10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
                Storage &amp; Media
              </h2>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                Real storage footprint of your uploaded attachments vs
                clearable local browser cache.
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void loadStorageSummary()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh</span>
            </Button>
          </div>

          {errorText ? (
            <ErrorState
              title="Unable to query storage usage"
              message={errorText}
              onRetry={() => void loadStorageSummary()}
            />
          ) : loading || !summary ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full rounded-[18px]" />
              <Skeleton className="h-44 w-full rounded-[18px]" />
            </div>
          ) : (
            <>
              {/* Account Cloud Storage Footprint */}
              <section className="space-y-4 rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] text-[var(--accent)]">
                      <HardDrive className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                        Total Tracked Cloud Media
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Across private chat attachments, feed posts, and Orbits
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-base font-semibold text-[var(--text-primary)]">
                    {formatBytes(summary.total_tracked_bytes)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 border-t border-[var(--border-subtle)] pt-4 sm:grid-cols-3">
                  <div className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-primary)]">
                      <FileText className="h-3.5 w-3.5 text-[var(--accent)]" />
                      <span>Chat Files ({summary.chat_attachment_count})</span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-[var(--text-secondary)]">
                      {formatBytes(summary.chat_attachment_bytes)}
                    </p>
                  </div>

                  <div className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-primary)]">
                      <ImageIcon className="h-3.5 w-3.5 text-[var(--accent)]" />
                      <span>Feed Media ({summary.feed_media_count})</span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-[var(--text-secondary)]">
                      {formatBytes(summary.feed_media_bytes)}
                    </p>
                  </div>

                  <div className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-primary)]">
                      <Film className="h-3.5 w-3.5 text-[var(--accent)]" />
                      <span>Orbit Media ({summary.orbit_media_count})</span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-[var(--text-secondary)]">
                      {formatBytes(summary.orbit_media_bytes)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5 text-xs">
                  <div className="rounded-[11px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-2">
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Feed media posts
                    </p>
                    <p className="mt-0.5 font-semibold text-[var(--text-primary)]">
                      {summary.feed_media_count}
                    </p>
                  </div>
                  <div className="rounded-[11px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-2">
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Orbit attachments
                    </p>
                    <p className="mt-0.5 font-semibold text-[var(--text-primary)]">
                      {summary.orbit_media_count}
                    </p>
                  </div>
                  <div className="rounded-[11px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-2">
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Active Moments
                    </p>
                    <p className="mt-0.5 font-semibold text-[var(--text-primary)]">
                      {summary.active_moment_media_count}
                    </p>
                  </div>
                </div>
              </section>

              {/* Recent Uploaded Attachments */}
              <section className="space-y-3 rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    Recent Uploaded Files
                  </h3>
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                    Delete an individual message inside its conversation to
                    remove its attachment from storage.
                  </p>
                </div>

                {summary.recent_uploads.length === 0 ? (
                  <p className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-3.5 text-xs text-[var(--text-muted)]">
                    You have not uploaded any chat attachments yet.
                  </p>
                ) : (
                  <div className="divide-y divide-[var(--border-subtle)] rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)]">
                    {summary.recent_uploads.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[var(--text-primary)]">
                            {item.file_name}
                          </p>
                          <p className="text-[11px] text-[var(--text-muted)]">
                            {item.mime_type} · {formatShortTime(item.created_at)}
                          </p>
                        </div>
                        <span className="shrink-0 font-mono text-[11px] text-[var(--text-secondary)]">
                          {formatBytes(item.byte_size)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Clearable Local Browser Cache */}
              <section className="space-y-3 rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    Local Browser Cache
                  </h3>
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                    Clearing local cache only resets temporary signed media URLs
                    or unsent drafts in this browser — your stored messages and
                    media remain safe.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-3 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3.5 py-2.5">
                    <div>
                      <p className="text-xs font-medium text-[var(--text-primary)]">
                        Signed media link cache
                      </p>
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        {signedCacheCount} active signed URL(s) in memory
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={signedCacheCount === 0}
                      onClick={handleClearSignedMediaCache}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Clear cache</span>
                    </Button>
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3.5 py-2.5">
                    <div>
                      <p className="text-xs font-medium text-[var(--text-primary)]">
                        Unsent local message drafts
                      </p>
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        {localStats.draftCount} draft(s) (
                        {formatBytes(localStats.draftBytes)})
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={localStats.draftCount === 0}
                      onClick={handleClearLocalDrafts}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Clear drafts</span>
                    </Button>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
