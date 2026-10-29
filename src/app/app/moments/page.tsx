"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Film,
  Flame,
  Flag,
  Globe,
  ImagePlus,
  Orbit,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  formatMomentTimeRemaining,
  momentCreateSchema,
  type ActiveMomentItem,
  type MomentAudience,
  type MomentDurationHours,
  type MomentTone,
} from "@asterial/core";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  mediaService,
  momentsService,
  type MomentViewerDetail,
} from "@/lib/services";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { MobileUtilityActions } from "@/components/workspace/WorkspaceShell";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Textarea } from "@/components/ui/Input";
import { PrivateMediaAsset } from "@/components/ui/PrivateMediaImage";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { formatShortTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

const TONE_CLASSES: Record<MomentTone, string> = {
  obsidian: "bg-[#0B0D12] text-[#F5F7FA] border-white/12",
  graphite: "bg-[#171B24] text-[#F4F5F8] border-white/15",
  slate: "bg-[#1D2436] text-[#F8FAFC] border-indigo-400/25",
  ivory: "bg-[#F4F5F7] text-[#0F1115] border-black/15",
};

interface AuthorMomentGroup {
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatarUrl: string | null;
  items: ActiveMomentItem[];
  hasUnviewed: boolean;
}

export default function MomentsPage() {
  const { user, profile, openReportModal } = useWorkspace();
  const { pushToast } = useToast();

  const [moments, setMoments] = useState<ActiveMomentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [viewerGroupIdx, setViewerGroupIdx] = useState<number | null>(null);
  const [viewerItemIdx, setViewerItemIdx] = useState(0);
  const [viewersList, setViewersList] = useState<MomentViewerDetail[]>([]);
  const [viewersModalOpen, setViewersModalOpen] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [caption, setCaption] = useState("");
  const [tone, setTone] = useState<MomentTone>("obsidian");
  const [audience, setAudience] = useState<MomentAudience>("everyone");
  const [durationHours, setDurationHours] = useState<MomentDurationHours>(24);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [uploadPct, setUploadPct] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const mediaPreviewUrl = useMemo(
    () => (mediaFile ? URL.createObjectURL(mediaFile) : null),
    [mediaFile]
  );

  useEffect(() => {
    return () => {
      if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
    };
  }, [mediaPreviewUrl]);

  const fetchMoments = useCallback(async () => {
    setErrorText(null);
    try {
      const items = await momentsService.fetchActiveMoments(48);
      setMoments(items);
    } catch (err) {
      setErrorText(
        err instanceof Error ? err.message : "Unable to load active Moments."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchMoments();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchMoments]);

  useEffect(() => {
    if (!user?.id) return;
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`web-moments-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "moments" },
        () => {
          void fetchMoments();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchMoments, user?.id]);

  const groups = useMemo<AuthorMomentGroup[]>(() => {
    const map = new Map<string, AuthorMomentGroup>();
    for (const m of moments) {
      const existing = map.get(m.author_id);
      if (existing) {
        existing.items.push(m);
        if (!m.viewer_has_viewed && m.author_id !== user?.id) {
          existing.hasUnviewed = true;
        }
      } else {
        map.set(m.author_id, {
          authorId: m.author_id,
          authorUsername: m.author_username,
          authorDisplayName: m.author_display_name,
          authorAvatarUrl: m.author_avatar_url,
          items: [m],
          hasUnviewed: !m.viewer_has_viewed && m.author_id !== user?.id,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.authorId === user?.id) return -1;
      if (b.authorId === user?.id) return 1;
      if (a.hasUnviewed !== b.hasUnviewed) return a.hasUnviewed ? -1 : 1;
      return 0;
    });
  }, [moments, user?.id]);

  const activeGroup =
    viewerGroupIdx !== null ? groups[viewerGroupIdx] ?? null : null;
  const activeItem = activeGroup
    ? activeGroup.items[viewerItemIdx] ?? null
    : null;

  useEffect(() => {
    if (!activeItem || !user?.id) return;
    if (!activeItem.viewer_has_viewed && activeItem.author_id !== user.id) {
      void momentsService.recordView(activeItem.id).then(() => {
        setMoments((prev) =>
          prev.map((m) =>
            m.id === activeItem.id
              ? { ...m, viewer_has_viewed: true, view_count: m.view_count + 1 }
              : m
          )
        );
      });
    }
  }, [activeItem, user?.id]);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setCreateError(null);

    const parsed = momentCreateSchema.safeParse({
      caption,
      backgroundTone: tone,
      audience,
      durationHours,
    });
    if (!parsed.success) {
      setCreateError(parsed.error.issues[0]?.message || "Invalid Moment.");
      return;
    }
    if (!parsed.data.caption && !mediaFile) {
      setCreateError("Write a caption or attach an image/video.");
      return;
    }

    setPublishing(true);
    setUploadPct(0);
    try {
      let uploadedMedia: {
        storagePath: string;
        mimeType: string;
        width: number | null;
        height: number | null;
      } | null = null;

      if (mediaFile) {
        const res = await mediaService.uploadSocialMediaFile({
          domain: "moments",
          userId: user.id,
          file: mediaFile,
          kind: "social-media",
          onProgress: setUploadPct,
        });
        uploadedMedia = {
          storagePath: res.storagePath,
          mimeType: res.mimeType,
          width: res.width,
          height: res.height,
        };
      }

      await momentsService.createMoment({
        authorId: user.id,
        caption: parsed.data.caption,
        backgroundTone: parsed.data.backgroundTone,
        audience: parsed.data.audience,
        durationHours: parsed.data.durationHours,
        media: uploadedMedia,
      });

      setCreateOpen(false);
      setCaption("");
      setMediaFile(null);
      await fetchMoments();
      pushToast({ title: "Moment published", variant: "success" });
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Could not publish Moment."
      );
    } finally {
      setPublishing(false);
    }
  };

  const handleDeleteMoment = async (momentId: string) => {
    try {
      await momentsService.deleteMoment(momentId);
      setViewerGroupIdx(null);
      await fetchMoments();
      pushToast({ title: "Moment deleted", variant: "success" });
    } catch (err) {
      pushToast({
        title: "Unable to delete Moment",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    }
  };

  const handleOpenViewers = async (momentId: string) => {
    try {
      const list = await momentsService.fetchMomentViewers(momentId);
      setViewersList(list);
      setViewersModalOpen(true);
    } catch (err) {
      pushToast({
        title: "Could not load viewers",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    }
  };

  const audienceBadge = (aud: MomentAudience) => {
    if (aud === "orbit") {
      return (
        <Badge variant="accent" size="sm">
          <Orbit className="h-2.5 w-2.5" />
          Close Orbit
        </Badge>
      );
    }
    if (aud === "contacts") {
      return (
        <Badge variant="neutral" size="sm">
          <Users className="h-2.5 w-2.5" />
          Contacts
        </Badge>
      );
    }
    return (
      <Badge variant="neutral" size="sm">
        <Globe className="h-2.5 w-2.5" />
        Everyone
      </Badge>
    );
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 py-6 sm:px-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                Moments
              </h1>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Ephemeral text, photo, and video updates with database-enforced
                expiration and Everybody, Contacts, or Close Orbit audiences.
              </p>
            </div>
            <MobileUtilityActions />
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void fetchMoments()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                setAudience(profile?.moments_default_audience || "everyone");
                setCreateOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Share Moment
            </Button>
          </div>
        </div>

        {/* Story Ring Tray */}
        {groups.length > 0 && (
          <div className="flex items-center gap-4 overflow-x-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
            {groups.map((grp, idx) => (
              <button
                key={grp.authorId}
                type="button"
                onClick={() => {
                  setViewerGroupIdx(idx);
                  setViewerItemIdx(0);
                }}
                className="flex shrink-0 flex-col items-center gap-1.5 cursor-pointer group"
              >
                <div
                  className={cn(
                    "rounded-full p-0.5 transition-transform group-hover:scale-105",
                    grp.hasUnviewed
                      ? "bg-gradient-to-tr from-[var(--accent-primary)] to-sky-400"
                      : "border border-[var(--border-strong)]"
                  )}
                >
                  <div className="rounded-full bg-[var(--bg-surface)] p-0.5">
                    <Avatar
                      name={grp.authorDisplayName}
                      avatarPath={grp.authorAvatarUrl}
                      size="lg"
                    />
                  </div>
                </div>
                <span className="max-w-[76px] truncate text-[11px] font-medium text-[var(--text-primary)]">
                  {grp.authorId === user?.id ? "You" : grp.authorDisplayName}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Active Moments Cards Grid */}
        {errorText ? (
          <ErrorState
            title="Could not load Moments"
            message={errorText}
            onRetry={() => void fetchMoments()}
          />
        ) : loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-2xl" />
            ))}
          </div>
        ) : moments.length === 0 ? (
          <EmptyState
            icon={<Flame className="h-5 w-5" />}
            title="No active Moments right now"
            description="Share a photo, short video, or status thought that automatically expires after 6, 12, 24, or 48 hours."
            action={
              <Button
                size="sm"
                variant="primary"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Share first Moment
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {moments.map((m) => {
              const gIdx = groups.findIndex((g) => g.authorId === m.author_id);
              const iIdx =
                gIdx >= 0
                  ? groups[gIdx].items.findIndex((x) => x.id === m.id)
                  : 0;
              const isVideo = (m.media_mime || "").startsWith("video/");

              return (
                <div
                  key={m.id}
                  onClick={() => {
                    if (gIdx >= 0) {
                      setViewerGroupIdx(gIdx);
                      setViewerItemIdx(Math.max(0, iIdx));
                    }
                  }}
                  className={cn(
                    "group relative flex h-72 flex-col justify-between overflow-hidden rounded-2xl border p-4 cursor-pointer transition-transform hover:-translate-y-0.5",
                    TONE_CLASSES[m.background_tone] || TONE_CLASSES.obsidian
                  )}
                >
                  {m.media_path && (
                    <div className="absolute inset-0">
                      <PrivateMediaAsset
                        bucket="social-media"
                        path={m.media_path}
                        mimeType={m.media_mime}
                        alt={m.caption || "Moment media"}
                        controls={false}
                        className="h-full w-full rounded-none border-0 object-cover opacity-80 group-hover:opacity-90 transition-opacity"
                      />
                      <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/25 to-black/80" />
                    </div>
                  )}

                  <div className="relative z-10 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar
                        name={m.author_display_name}
                        avatarPath={m.author_avatar_url}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-white">
                          {m.author_display_name}
                        </p>
                        <p className="font-mono text-[10px] text-zinc-300">
                          {formatMomentTimeRemaining(m.expires_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {isVideo && (
                        <Badge variant="neutral" size="sm">
                          <Film className="h-2.5 w-2.5" />
                          Video
                        </Badge>
                      )}
                      {audienceBadge(m.audience)}
                    </div>
                  </div>

                  <div className="relative z-10 space-y-2">
                    {m.caption && (
                      <p
                        className={cn(
                          "line-clamp-4 text-sm font-medium leading-relaxed",
                          m.media_path ? "text-white" : ""
                        )}
                      >
                        {m.caption}
                      </p>
                    )}
                    <div className="flex items-center justify-between font-mono text-[10px] opacity-75">
                      <span>{formatShortTime(m.created_at)}</span>
                      <span className="inline-flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {m.view_count}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fullscreen Moment Lightbox Viewer */}
      {activeGroup && activeItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/92 p-4 backdrop-blur-xs animate-asterial-in"
          onClick={() => setViewerGroupIdx(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "relative flex h-[84dvh] w-full max-w-md flex-col justify-between overflow-hidden rounded-3xl border p-5 shadow-2xl",
              TONE_CLASSES[activeItem.background_tone] || TONE_CLASSES.obsidian
            )}
          >
            {/* Progress segments */}
            <div className="relative z-20 space-y-3">
              <div className="flex gap-1">
                {activeGroup.items.map((seg, i) => (
                  <div
                    key={seg.id}
                    className={cn(
                      "h-1 flex-1 rounded-full",
                      i <= viewerItemIdx ? "bg-white" : "bg-white/25"
                    )}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar
                    name={activeItem.author_display_name}
                    avatarPath={activeItem.author_avatar_url}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-white">
                      {activeItem.author_display_name}
                    </p>
                    <p className="font-mono text-[10px] text-zinc-300">
                      {formatMomentTimeRemaining(activeItem.expires_at)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {activeItem.author_id === user?.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleOpenViewers(activeItem.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-black/40 px-2 py-1 text-[11px] text-white hover:bg-black/60 cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {activeItem.view_count}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteMoment(activeItem.id)}
                        aria-label="Delete Moment"
                        className="rounded-lg bg-black/40 p-1.5 text-red-300 hover:bg-red-500/25 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        openReportModal({
                          reportedUserId: activeItem.author_id,
                          momentId: activeItem.id,
                          label: "Moment",
                        })
                      }
                      aria-label="Report Moment"
                      className="rounded-lg bg-black/40 p-1.5 text-zinc-300 hover:text-white cursor-pointer"
                    >
                      <Flag className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setViewerGroupIdx(null)}
                    aria-label="Close Moment viewer"
                    className="rounded-lg bg-black/40 p-1.5 text-white hover:bg-black/60 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Body / Media */}
            <div className="relative z-10 my-4 flex flex-1 flex-col items-center justify-center overflow-hidden">
              {activeItem.media_path && (
                <PrivateMediaAsset
                  bucket="social-media"
                  path={activeItem.media_path}
                  mimeType={activeItem.media_mime}
                  alt={activeItem.caption || "Moment media"}
                  autoPlay
                  controls
                  className="max-h-[52dvh] w-full object-contain"
                />
              )}
              {activeItem.caption && (
                <p
                  className={cn(
                    "mt-3 text-center leading-relaxed",
                    activeItem.media_path ? "text-sm text-white" : "text-lg font-medium"
                  )}
                >
                  {activeItem.caption}
                </p>
              )}
            </div>

            {/* Prev / Next Controls */}
            <div className="relative z-20 flex items-center justify-between">
              <Button
                size="sm"
                variant="secondary"
                disabled={viewerGroupIdx === 0 && viewerItemIdx === 0}
                onClick={() => {
                  if (viewerItemIdx > 0) {
                    setViewerItemIdx((i) => i - 1);
                  } else if (viewerGroupIdx !== null && viewerGroupIdx > 0) {
                    const prevGroup = groups[viewerGroupIdx - 1];
                    setViewerGroupIdx(viewerGroupIdx - 1);
                    setViewerItemIdx(prevGroup.items.length - 1);
                  }
                }}
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              {audienceBadge(activeItem.audience)}
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  if (viewerItemIdx + 1 < activeGroup.items.length) {
                    setViewerItemIdx((i) => i + 1);
                  } else if (
                    viewerGroupIdx !== null &&
                    viewerGroupIdx + 1 < groups.length
                  ) {
                    setViewerGroupIdx(viewerGroupIdx + 1);
                    setViewerItemIdx(0);
                  } else {
                    setViewerGroupIdx(null);
                  }
                }}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Moment Viewers Modal */}
      {viewersModalOpen && (
        <Dialog
          open
          onClose={() => setViewersModalOpen(false)}
          title="Moment viewers"
          description="People who viewed this Moment before expiration."
        >
          <div className="max-h-72 overflow-y-auto space-y-2">
            {viewersList.length === 0 ? (
              <p className="py-6 text-center text-xs text-[var(--text-muted)]">
                No views recorded yet.
              </p>
            ) : (
              viewersList.map((v) => (
                <div
                  key={v.viewer_id}
                  className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <Avatar
                      name={v.profile?.display_name || "Viewer"}
                      avatarPath={v.profile?.avatar_url}
                      size="sm"
                    />
                    <div>
                      <p className="text-xs font-medium text-[var(--text-primary)]">
                        {v.profile?.display_name || "ASTERIAL Member"}
                      </p>
                      <p className="font-mono text-[10px] text-[var(--text-muted)]">
                        @{v.profile?.username || "member"}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] text-[var(--text-muted)]">
                    {formatShortTime(v.viewed_at)}
                  </span>
                </div>
              ))
            )}
          </div>
        </Dialog>
      )}

      {/* Share Moment Modal */}
      {createOpen && (
        <Dialog
          open
          onClose={() => setCreateOpen(false)}
          title="Share a Moment"
          description="Moments disappear automatically when their timer expires."
        >
          <form onSubmit={handlePublish} className="space-y-4">
            {createError && (
              <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">
                {createError}
              </div>
            )}

            {/* Live Preview Before Publish */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <span className="font-medium">Preview</span>
                <span className="text-[11px] text-[var(--text-muted)]">
                  Expires in {durationHours}h ·{" "}
                  {audience === "orbit"
                    ? "Close Orbit"
                    : audience === "contacts"
                      ? "Contacts"
                      : "Everyone"}
                </span>
              </div>
              <div
                className={cn(
                  "relative flex min-h-[156px] flex-col items-center justify-center overflow-hidden rounded-[14px] border p-4 text-center",
                  TONE_CLASSES[tone]
                )}
              >
                {mediaPreviewUrl && mediaFile ? (
                  mediaFile.type.startsWith("video/") ? (
                    <video
                      src={mediaPreviewUrl}
                      controls
                      playsInline
                      className="max-h-48 w-full rounded-[10px] object-contain"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mediaPreviewUrl}
                      alt="Moment preview"
                      className="max-h-48 w-full rounded-[10px] object-contain"
                    />
                  )
                ) : null}
                <p
                  className={cn(
                    "max-w-xs text-sm leading-relaxed break-words",
                    mediaPreviewUrl ? "mt-2.5 text-xs" : "font-medium"
                  )}
                >
                  {caption.trim() ||
                    (mediaFile
                      ? mediaFile.name
                      : "Your Moment preview appears here as you type…")}
                </p>
              </div>
            </div>

            <Textarea
              label="Caption"
              placeholder="Share what you’re working on or thinking about…"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={500}
            />

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">
                Photo or Video (optional, up to 25 MB)
              </label>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm"
                className="hidden"
                onChange={(e) => setMediaFile(e.target.files?.[0] ?? null)}
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => fileRef.current?.click()}
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  {mediaFile ? "Change media" : "Attach photo or video"}
                </Button>
                {mediaFile && (
                  <span className="truncate text-xs text-[var(--text-secondary)]">
                    {mediaFile.name}
                  </span>
                )}
              </div>
              {publishing && mediaFile && uploadPct > 0 && (
                <p className="font-mono text-[10px] text-[var(--accent-primary)]">
                  Uploading media… {uploadPct}%
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-secondary)]">
                  Audience
                </label>
                <div className="flex flex-col gap-1.5">
                  {(
                    [
                      ["everyone", "Everyone", "All signed-in members"],
                      ["contacts", "Contacts", "Shared direct threads"],
                      ["orbit", "Close Orbit", "Only your Close Orbit"],
                    ] as const
                  ).map(([val, label, hint]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setAudience(val)}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-left text-xs transition-colors cursor-pointer",
                        audience === val
                          ? "border-[var(--accent-primary)] bg-[var(--accent-signal-subtle)] text-[var(--text-primary)] font-medium"
                          : "border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-secondary)]"
                      )}
                    >
                      <span className="block">{label}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {hint}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">
                    Expires after
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {([6, 12, 24, 48] as const).map((hrs) => (
                      <button
                        key={hrs}
                        type="button"
                        onClick={() => setDurationHours(hrs)}
                        className={cn(
                          "inline-flex items-center justify-center gap-1 rounded-xl border py-2 text-xs cursor-pointer",
                          durationHours === hrs
                            ? "border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--accent-primary-fg)] font-medium"
                            : "border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-secondary)]"
                        )}
                      >
                        <Clock className="h-3 w-3" />
                        {hrs}h
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">
                    Card tone
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(["obsidian", "graphite", "slate", "ivory"] as const).map(
                      (t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTone(t)}
                          className={cn(
                            "rounded-xl border py-1.5 text-[11px] capitalize cursor-pointer",
                            tone === t
                              ? "border-[var(--accent-primary)] bg-[var(--accent-signal-subtle)] text-[var(--text-primary)] font-medium"
                              : "border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-secondary)]"
                          )}
                        >
                          {t}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={publishing}>
                Publish Moment
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
