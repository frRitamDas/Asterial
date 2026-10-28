"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Aperture,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Flag,
  ImagePlus,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  X,
} from "lucide-react";
import type {
  ActiveMomentItem,
  MomentAudience,
  MomentDurationHours,
  MomentTone,
} from "@asterial/core";
import { formatMomentTimeRemaining, momentCreateSchema } from "@asterial/core";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  primeAvatarSignedUrls,
  primeBucketSignedUrls,
  uploadSocialMediaFile,
} from "@/lib/supabase/storage";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Textarea } from "@/components/ui/Input";
import { PrivateMediaImage } from "@/components/ui/PrivateMediaImage";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils/cn";
import { formatByteSize, formatRelativeTime } from "@/lib/utils/format";

const TONE_CLASSES: Record<
  MomentTone,
  { card: string; text: string; label: string }
> = {
  obsidian: {
    card: "bg-[#0B0B0E] border-white/14",
    text: "text-zinc-100",
    label: "Obsidian",
  },
  graphite: {
    card: "bg-[#18181D] border-white/14",
    text: "text-zinc-100",
    label: "Graphite",
  },
  slate: {
    card: "bg-[#24242C] border-white/16",
    text: "text-white",
    label: "Charcoal",
  },
  ivory: {
    card: "bg-[#F4F4F6] border-zinc-300",
    text: "text-zinc-950",
    label: "Alabaster",
  },
};

export default function MomentsPage() {
  const { user, openReportModal } = useWorkspace();
  const { pushToast } = useToast();

  const [moments, setMoments] = useState<ActiveMomentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const [composeOpen, setComposeOpen] = useState(false);
  const [caption, setCaption] = useState("");
  const [tone, setTone] = useState<MomentTone>("obsidian");
  const [audience, setAudience] = useState<MomentAudience>("everyone");
  const [durationHours, setDurationHours] = useState<MomentDurationHours>(24);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const loadMoments = useCallback(async () => {
    if (!user?.id) return;
    setErrorText(null);
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("get_active_moments", {
      p_limit: 60,
    });

    if (error) {
      setErrorText(error.message);
      setLoading(false);
      return;
    }

    const nowMs = Date.now();
    const activeRows = ((data || []) as ActiveMomentItem[]).filter(
      (m) => new Date(m.expires_at).getTime() > nowMs
    );

    await Promise.all([
      primeAvatarSignedUrls(activeRows.map((m) => m.author_avatar_url)),
      primeBucketSignedUrls(
        "social-media",
        activeRows.map((m) => m.media_path)
      ),
    ]);

    setMoments(activeRows);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMoments();
    const expiryTimer = setInterval(() => {
      setMoments((prev) =>
        prev.filter((m) => new Date(m.expires_at).getTime() > Date.now())
      );
    }, 30_000);
    return () => clearInterval(expiryTimer);
  }, [loadMoments]);

  useEffect(() => {
    if (!user?.id) return;
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`web-moments-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "moments" },
        () => {
          void loadMoments();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadMoments, user?.id]);

  const activeMoment = useMemo(
    () =>
      activeIndex !== null && moments[activeIndex]
        ? moments[activeIndex]
        : null,
    [activeIndex, moments]
  );

  useEffect(() => {
    if (!activeMoment || !user?.id) return;
    if (activeMoment.author_id !== user.id && !activeMoment.viewer_has_viewed) {
      const supabase = getSupabaseBrowserClient();
      void supabase
        .rpc("record_moment_view", { p_moment_id: activeMoment.id })
        .then(() => {
          setMoments((prev) =>
            prev.map((m) =>
              m.id === activeMoment.id
                ? {
                    ...m,
                    viewer_has_viewed: true,
                    view_count: m.view_count + 1,
                  }
                : m
            )
          );
        });
    }
  }, [activeMoment, user?.id]);

  useEffect(() => {
    if (activeIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveIndex(null);
      if (e.key === "ArrowRight") {
        setActiveIndex((idx) =>
          idx !== null && idx < moments.length - 1 ? idx + 1 : null
        );
      }
      if (e.key === "ArrowLeft") {
        setActiveIndex((idx) => (idx !== null && idx > 0 ? idx - 1 : idx));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, moments.length]);

  const handlePublishMoment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || publishing) return;

    const parsed = momentCreateSchema.safeParse({
      caption,
      backgroundTone: tone,
      audience,
      durationHours,
    });

    if (!parsed.success) {
      pushToast({
        title: "Check Moment details",
        description: parsed.error.issues[0]?.message,
        variant: "error",
      });
      return;
    }

    if (!parsed.data.caption && !mediaFile) {
      pushToast({
        title: "Empty Moment",
        description: "Add a caption or attach an image before sharing.",
        variant: "error",
      });
      return;
    }

    setPublishing(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let uploaded: {
        storagePath: string;
        mimeType: string;
        width: number | null;
        height: number | null;
      } | null = null;

      if (mediaFile) {
        setUploadPercent(0);
        uploaded = await uploadSocialMediaFile({
          domain: "moments",
          userId: user.id,
          file: mediaFile,
          kind: "social-image",
          onProgress: (pct) => setUploadPercent(pct),
          signal: controller.signal,
        });
      }

      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("moments").insert({
        author_id: user.id,
        caption: parsed.data.caption,
        background_tone: parsed.data.backgroundTone,
        audience: parsed.data.audience,
        duration_hours: parsed.data.durationHours,
        media_path: uploaded?.storagePath || null,
        media_mime: uploaded?.mimeType || null,
        media_width: uploaded?.width || null,
        media_height: uploaded?.height || null,
      });

      if (error) throw new Error(error.message);

      setComposeOpen(false);
      setCaption("");
      setMediaFile(null);
      setUploadPercent(null);
      pushToast({
        title: "Moment published",
        description: `Visible for ${parsed.data.durationHours} hours.`,
        variant: "success",
      });
      await loadMoments();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        pushToast({ title: "Upload cancelled", variant: "default" });
      } else {
        pushToast({
          title: "Could not publish Moment",
          description: err instanceof Error ? err.message : "Try again.",
          variant: "error",
        });
      }
    } finally {
      setPublishing(false);
      setUploadPercent(null);
      abortRef.current = null;
    }
  };

  const handleDeleteMoment = async (momentId: string) => {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from("moments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", momentId);
    if (error) {
      pushToast({
        title: "Could not delete Moment",
        description: error.message,
        variant: "error",
      });
      return;
    }
    setActiveIndex(null);
    pushToast({ title: "Moment deleted", variant: "success" });
    await loadMoments();
  };

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-[var(--bg-canvas)]">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8 sm:py-8 space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--border-subtle)] pb-6">
          <div>
            <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-zinc-400">
              <Aperture className="h-3.5 w-3.5" />
              <span>Moments · Ephemeral Updates</span>
            </div>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white">
              Temporary updates with automatic expiration
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Share lightweight visual or text updates for 6, 12, 24, or 48
              hours. Database Row Level Security and private media policies stop
              serving Moments automatically once{" "}
              <code className="font-mono text-xs text-zinc-300">expires_at</code>{" "}
              passes.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void loadMoments()}
              aria-label="Refresh Moments"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setComposeOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Share Moment
            </Button>
          </div>
        </header>

        {errorText && (
          <div className="flex items-center justify-between rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200">
            <span>{errorText}</span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => void loadMoments()}
            >
              Retry
            </Button>
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <Skeleton key={n} className="h-64 rounded-2xl" />
            ))}
          </div>
        ) : moments.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[var(--bg-surface)] px-6 py-14 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/12 bg-[var(--bg-elevated)] text-zinc-300">
              <Clock className="h-5 w-5" />
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h2 className="text-base font-semibold text-white">
                No active Moments right now
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Moments automatically disappear after their configured lifespan.
                Publish a text or photo Moment to share what you&apos;re working
                on right now.
              </p>
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setComposeOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Share a Moment
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {moments.map((item, index) => {
              const toneStyle =
                TONE_CLASSES[item.background_tone] || TONE_CLASSES.obsidian;
              const unread =
                item.author_id !== user?.id && !item.viewer_has_viewed;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={cn(
                    "group relative flex h-72 flex-col justify-between overflow-hidden rounded-2xl border p-5 text-left transition-all cursor-pointer",
                    toneStyle.card,
                    unread
                      ? "ring-2 ring-white/80"
                      : "hover:border-white/30"
                  )}
                >
                  {item.media_path && (
                    <div className="absolute inset-0 opacity-45 group-hover:opacity-55 transition-opacity">
                      <PrivateMediaImage
                        bucket="social-media"
                        path={item.media_path}
                        alt={item.caption || "Moment"}
                        className="h-full w-full rounded-none border-0"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/50" />
                    </div>
                  )}

                  <div className="relative z-10 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar
                        name={item.author_display_name}
                        avatarPath={item.author_avatar_url}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "text-xs font-semibold truncate",
                            item.media_path ? "text-white" : toneStyle.text
                          )}
                        >
                          {item.author_display_name}
                        </p>
                        <p className="font-mono text-[10px] text-zinc-400 truncate">
                          @{item.author_username}
                        </p>
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-0.5 font-mono text-[10px] text-zinc-200 backdrop-blur-sm shrink-0">
                      <Clock className="h-2.5 w-2.5" />
                      {formatMomentTimeRemaining(item.expires_at)}
                    </span>
                  </div>

                  <div className="relative z-10 space-y-2">
                    {item.caption && (
                      <p
                        className={cn(
                          "line-clamp-4 text-sm font-medium leading-relaxed",
                          item.media_path ? "text-white" : toneStyle.text
                        )}
                      >
                        {item.caption}
                      </p>
                    )}
                    <div className="flex items-center justify-between font-mono text-[10px] text-zinc-400">
                      <span>{formatRelativeTime(item.created_at)}</span>
                      <span className="inline-flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {item.view_count}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Full-Screen Moment Viewer */}
      {activeMoment && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Moment viewer"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
        >
          <div className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/15 bg-[var(--bg-surface)]">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar
                  name={activeMoment.author_display_name}
                  avatarPath={activeMoment.author_avatar_url}
                  size="sm"
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">
                    {activeMoment.author_display_name}
                  </p>
                  <p className="font-mono text-[10px] text-zinc-400">
                    @{activeMoment.author_username} ·{" "}
                    {formatMomentTimeRemaining(activeMoment.expires_at)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {activeMoment.author_id === user?.id ? (
                  <button
                    type="button"
                    aria-label="Delete Moment"
                    onClick={() => void handleDeleteMoment(activeMoment.id)}
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-red-300 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label="Report Moment"
                    onClick={() => {
                      openReportModal({
                        momentId: activeMoment.id,
                        reportedUserId: activeMoment.author_id,
                        label: `Moment by @${activeMoment.author_username}`,
                      });
                    }}
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white cursor-pointer"
                  >
                    <Flag className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Close viewer"
                  onClick={() => setActiveIndex(null)}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div
              className={cn(
                "flex min-h-[360px] flex-col items-center justify-center p-6 text-center space-y-4",
                TONE_CLASSES[activeMoment.background_tone]?.card ||
                  TONE_CLASSES.obsidian.card
              )}
            >
              {activeMoment.media_path && (
                <PrivateMediaImage
                  bucket="social-media"
                  path={activeMoment.media_path}
                  alt={activeMoment.caption || "Moment media"}
                  className="max-h-80 w-auto object-contain"
                />
              )}
              {activeMoment.caption && (
                <p
                  className={cn(
                    "max-w-md whitespace-pre-wrap text-base font-medium leading-relaxed",
                    activeMoment.background_tone === "ivory" &&
                      !activeMoment.media_path
                      ? "text-zinc-950"
                      : "text-white"
                  )}
                >
                  {activeMoment.caption}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-white/10 px-5 py-3 text-xs text-zinc-400">
              <div className="flex items-center gap-3 font-mono text-[11px]">
                <span className="inline-flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" />
                  {activeMoment.view_count} views
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {activeMoment.audience === "contacts"
                    ? "Contacts only"
                    : "Everyone"}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={activeIndex === 0}
                  onClick={() =>
                    setActiveIndex((i) => (i !== null && i > 0 ? i - 1 : i))
                  }
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={activeIndex === moments.length - 1}
                  onClick={() =>
                    setActiveIndex((i) =>
                      i !== null && i < moments.length - 1 ? i + 1 : i
                    )
                  }
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compose Moment Modal */}
      <Dialog
        open={composeOpen}
        onClose={() => {
          if (publishing) {
            abortRef.current?.abort();
          }
          setComposeOpen(false);
        }}
        title="Share a Moment"
        description="Moments automatically hide from viewers and signed media URLs after expiration. Standard database backups rotate on routine infrastructure schedules."
      >
        <form onSubmit={handlePublishMoment} className="space-y-4">
          <Textarea
            label="Caption"
            placeholder="Share a brief thought, update, or milestone..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={500}
          />

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">
              Surface tone
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(["obsidian", "graphite", "slate", "ivory"] as const).map(
                (t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTone(t)}
                    className={cn(
                      "rounded-xl border px-2.5 py-2 text-xs font-medium transition-all cursor-pointer",
                      tone === t
                        ? "border-white bg-white text-zinc-950"
                        : "border-white/10 text-zinc-400 hover:text-white"
                    )}
                  >
                    {TONE_CLASSES[t].label}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">
                Audience
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    ["everyone", "Everyone"],
                    ["contacts", "Contacts"],
                  ] as const
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAudience(val)}
                    className={cn(
                      "rounded-xl border px-2.5 py-2 text-xs cursor-pointer",
                      audience === val
                        ? "border-white bg-white text-zinc-950 font-medium"
                        : "border-white/10 text-zinc-400"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">
                Expires after
              </label>
              <div className="grid grid-cols-4 gap-1">
                {([6, 12, 24, 48] as const).map((hrs) => (
                  <button
                    key={hrs}
                    type="button"
                    onClick={() => setDurationHours(hrs)}
                    className={cn(
                      "rounded-xl border py-2 font-mono text-xs cursor-pointer",
                      durationHours === hrs
                        ? "border-white bg-white text-zinc-950 font-semibold"
                        : "border-white/10 text-zinc-400"
                    )}
                  >
                    {hrs}h
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-[var(--bg-elevated)] px-3.5 py-2 text-xs text-zinc-200 hover:border-white/25 cursor-pointer">
              <ImagePlus className="h-4 w-4" />
              <span>
                {mediaFile
                  ? `${mediaFile.name} (${formatByteSize(mediaFile.size)})`
                  : "Attach photo (optional)"}
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
              />
            </label>
            {uploadPercent !== null && (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-white transition-all"
                  style={{ width: `${uploadPercent}%` }}
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                abortRef.current?.abort();
                setComposeOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={publishing}>
              Publish Moment
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
