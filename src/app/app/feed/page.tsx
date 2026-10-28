"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  Flag,
  Globe,
  Heart,
  ImagePlus,
  LayoutList,
  MessageCircle,
  MessageSquare,
  Pencil,
  RefreshCw,
  Send,
  Trash2,
  Users,
  X,
} from "lucide-react";
import type {
  EnrichedPostComment,
  FeedPostItem,
  FeedScope,
  PostCommentRow,
  PostVisibility,
  Profile,
} from "@asterial/core";
import {
  FEED_PAGE_SIZE,
  postBodySchema,
  postCommentSchema,
} from "@asterial/core";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  primeAvatarSignedUrls,
  primeBucketSignedUrls,
  uploadSocialMediaFile,
} from "@/lib/supabase/storage";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { PrivateMediaImage } from "@/components/ui/PrivateMediaImage";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils/cn";
import { formatByteSize, formatRelativeTime } from "@/lib/utils/format";

export default function SocialFeedPage() {
  const router = useRouter();
  const {
    user,
    profile,
    openReportModal,
    blockUser,
    startDirectConversation,
  } = useWorkspace();
  const { pushToast } = useToast();

  const [tab, setTab] = useState<"all" | "contacts" | "mine">("all");
  const [posts, setPosts] = useState<FeedPostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [draftBody, setDraftBody] = useState("");
  const [draftVisibility, setDraftVisibility] =
    useState<PostVisibility>("public");
  const [draftImage, setDraftImage] = useState<File | null>(null);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const publishLockRef = useRef(false);

  const [likingIds, setLikingIds] = useState<Set<string>>(() => new Set());
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");

  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [commentsByPost, setCommentsByPost] = useState<
    Record<string, EnrichedPostComment[]>
  >({});
  const [commentDraft, setCommentDraft] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  const fetchFeedPage = useCallback(
    async (cursor?: { createdAt: string; id: string }) => {
      if (!user?.id) return;
      setErrorText(null);
      const supabase = getSupabaseBrowserClient();
      const scope: FeedScope = tab === "contacts" ? "contacts" : "all";
      const authorFilter = tab === "mine" ? user.id : null;

      const { data, error } = await supabase.rpc("get_feed_posts_page", {
        p_before_created_at: cursor?.createdAt || null,
        p_before_id: cursor?.id || null,
        p_author_id: authorFilter,
        p_scope: scope,
        p_limit: FEED_PAGE_SIZE,
      });

      if (error) {
        setErrorText(error.message);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      const items = (data || []) as FeedPostItem[];
      await Promise.all([
        primeAvatarSignedUrls(items.map((p) => p.author_avatar_url)),
        primeBucketSignedUrls(
          "social-media",
          items.map((p) => p.media_path)
        ),
      ]);

      setHasMore(items.length === FEED_PAGE_SIZE);
      if (cursor) {
        setPosts((prev) => {
          const seen = new Set(prev.map((x) => x.id));
          return [...prev, ...items.filter((x) => !seen.has(x.id))];
        });
      } else {
        setPosts(items);
      }
      setLoading(false);
      setLoadingMore(false);
    },
    [tab, user]
  );

  useEffect(() => {
    const id = setTimeout(() => {
      void fetchFeedPage();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchFeedPage]);

  const loadCommentsForPost = useCallback(async (postId: string) => {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("post_comments")
      .select("*")
      .eq("post_id", postId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(100);

    if (error) return;
    const raw = (data || []) as PostCommentRow[];
    const authorIds = Array.from(new Set(raw.map((c) => c.author_id)));
    const profMap: Record<string, Profile> = {};

    if (authorIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("*")
        .in("id", authorIds);
      for (const p of (profs || []) as Profile[]) {
        profMap[p.id] = p;
      }
      await primeAvatarSignedUrls(
        Object.values(profMap).map((p) => p.avatar_url)
      );
    }

    const enriched: EnrichedPostComment[] = raw.map((c) => ({
      ...c,
      author_username: profMap[c.author_id]?.username || "member",
      author_display_name: profMap[c.author_id]?.display_name || "Member",
      author_avatar_url: profMap[c.author_id]?.avatar_url || null,
    }));

    setCommentsByPost((prev) => ({ ...prev, [postId]: enriched }));
  }, []);

  const handlePublishPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || publishLockRef.current) return;

    const parsed = postBodySchema.safeParse({
      body: draftBody,
      visibility: draftVisibility,
    });
    if (!parsed.success) {
      pushToast({
        title: "Invalid post",
        description: parsed.error.issues[0]?.message,
        variant: "error",
      });
      return;
    }

    if (!parsed.data.body && !draftImage) {
      pushToast({
        title: "Post is empty",
        description: "Write something or attach an image to publish.",
        variant: "error",
      });
      return;
    }

    publishLockRef.current = true;
    setPublishing(true);
    try {
      let media: {
        storagePath: string;
        fileName: string;
        mimeType: string;
        byteSize: number;
        width: number | null;
        height: number | null;
      } | null = null;

      if (draftImage) {
        setUploadPercent(0);
        media = await uploadSocialMediaFile({
          domain: "posts",
          userId: user.id,
          file: draftImage,
          kind: "social-image",
          onProgress: (pct) => setUploadPercent(pct),
        });
      }

      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("posts").insert({
        author_id: user.id,
        body: parsed.data.body,
        visibility: parsed.data.visibility,
        media_path: media?.storagePath || null,
        media_name: media?.fileName || null,
        media_mime: media?.mimeType || null,
        media_size: media?.byteSize || null,
        media_width: media?.width || null,
        media_height: media?.height || null,
      });

      if (error) throw new Error(error.message);

      setDraftBody("");
      setDraftImage(null);
      setUploadPercent(null);
      pushToast({ title: "Published to Feed", variant: "success" });
      await fetchFeedPage();
    } catch (err) {
      pushToast({
        title: "Could not publish post",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    } finally {
      setPublishing(false);
      setUploadPercent(null);
      publishLockRef.current = false;
    }
  };

  const handleToggleLike = async (post: FeedPostItem) => {
    if (likingIds.has(post.id)) return;
    setLikingIds((prev) => new Set(prev).add(post.id));

    const optimisticLiked = !post.viewer_has_liked;
    const optimisticCount = Math.max(
      0,
      post.like_count + (optimisticLiked ? 1 : -1)
    );
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? {
              ...p,
              viewer_has_liked: optimisticLiked,
              like_count: optimisticCount,
            }
          : p
      )
    );

    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("toggle_post_like", {
      p_post_id: post.id,
    });

    setLikingIds((prev) => {
      const next = new Set(prev);
      next.delete(post.id);
      return next;
    });

    if (error) {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
                ...p,
                viewer_has_liked: post.viewer_has_liked,
                like_count: post.like_count,
              }
            : p
        )
      );
      pushToast({
        title: "Could not update like",
        description: error.message,
        variant: "error",
      });
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (row && typeof row.liked === "boolean") {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
                ...p,
                viewer_has_liked: row.liked,
                like_count: Number(row.like_count ?? optimisticCount),
              }
            : p
        )
      );
    }
  };

  const handleSaveEditPost = async (postId: string) => {
    const clean = editingBody.trim();
    if (!clean) return;
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from("posts")
      .update({ body: clean })
      .eq("id", postId);
    if (error) {
      pushToast({
        title: "Could not update post",
        description: error.message,
        variant: "error",
      });
      return;
    }
    setEditingPostId(null);
    setEditingBody("");
    await fetchFeedPage();
  };

  const handleDeletePost = async (postId: string) => {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from("posts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", postId);
    if (error) {
      pushToast({
        title: "Could not delete post",
        description: error.message,
        variant: "error",
      });
      return;
    }
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    pushToast({ title: "Post deleted", variant: "success" });
  };

  const handleAddComment = async (postId: string) => {
    if (!user?.id || submittingComment) return;
    const parsed = postCommentSchema.safeParse({ body: commentDraft });
    if (!parsed.success) return;

    setSubmittingComment(true);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from("post_comments").insert({
      post_id: postId,
      author_id: user.id,
      body: parsed.data.body,
    });
    setSubmittingComment(false);

    if (error) {
      pushToast({
        title: "Could not post comment",
        description: error.message,
        variant: "error",
      });
      return;
    }

    setCommentDraft("");
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p
      )
    );
    await loadCommentsForPost(postId);
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from("post_comments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", commentId);
    if (error) {
      pushToast({
        title: "Could not remove comment",
        description: error.message,
        variant: "error",
      });
      return;
    }
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, comment_count: Math.max(0, p.comment_count - 1) }
          : p
      )
    );
    await loadCommentsForPost(postId);
  };

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-[var(--bg-canvas)]">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8 space-y-6">
        {/* Header */}
        <header className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-5">
          <div>
            <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-zinc-400">
              <LayoutList className="h-3.5 w-3.5" />
              <span>Social Feed · Reverse Chronological</span>
            </div>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white">
              Community Feed
            </h1>
            <p className="mt-1 text-xs text-zinc-400">
              Ordered strictly chronologically — zero algorithmic manipulation.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void fetchFeedPage()}
            aria-label="Refresh feed"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </header>

        {/* Composer Card */}
        <form
          onSubmit={handlePublishPost}
          className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 space-y-3"
        >
          <div className="flex items-start gap-3">
            {profile && (
              <Avatar
                name={profile.display_name}
                avatarPath={profile.avatar_url}
                size="sm"
                className="mt-0.5"
              />
            )}
            <div className="flex-1 space-y-2">
              <Textarea
                placeholder="Share a post, release note, or visual update..."
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                maxLength={2000}
              />

              {draftImage && (
                <div className="flex items-center justify-between rounded-xl border border-white/12 bg-[var(--bg-elevated)] px-3 py-2 text-xs text-zinc-200">
                  <span className="truncate">
                    {draftImage.name} ({formatByteSize(draftImage.size)})
                    {uploadPercent !== null ? ` · ${uploadPercent}%` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDraftImage(null)}
                    className="text-zinc-400 hover:text-white cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-[var(--bg-canvas)] px-3 py-1.5 text-xs text-zinc-300 hover:text-white cursor-pointer">
                <ImagePlus className="h-3.5 w-3.5" />
                <span>Photo</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => setDraftImage(e.target.files?.[0] || null)}
                />
              </label>

              <button
                type="button"
                onClick={() =>
                  setDraftVisibility((v) =>
                    v === "public" ? "contacts" : "public"
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-[var(--bg-canvas)] px-3 py-1.5 font-mono text-[11px] text-zinc-300 hover:text-white cursor-pointer"
              >
                {draftVisibility === "public" ? (
                  <>
                    <Globe className="h-3 w-3" />
                    Public
                  </>
                ) : (
                  <>
                    <Users className="h-3 w-3" />
                    Contacts only
                  </>
                )}
              </button>
            </div>

            <Button
              type="submit"
              size="sm"
              variant="primary"
              loading={publishing}
              disabled={!draftBody.trim() && !draftImage}
            >
              Publish
            </Button>
          </div>
        </form>

        {/* Filter Tabs */}
        <div
          role="tablist"
          aria-label="Feed scope"
          className="inline-flex rounded-xl border border-white/10 bg-[var(--bg-surface)] p-1"
        >
          {(
            [
              ["all", "All Posts"],
              ["contacts", "Contacts"],
              ["mine", "My Posts"],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              role="tab"
              aria-selected={tab === val}
              onClick={() => setTab(val)}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                tab === val
                  ? "bg-white text-zinc-950"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {errorText && (
          <div className="flex items-center justify-between rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200">
            <span>{errorText}</span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => void fetchFeedPage()}
            >
              Retry
            </Button>
          </div>
        )}

        {/* Stream */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="rounded-2xl border border-white/10 bg-[var(--bg-surface)] p-5 space-y-3"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[var(--bg-surface)] px-6 py-12 text-center space-y-2">
            <h2 className="text-base font-semibold text-white">
              No posts in this feed view yet
            </h2>
            <p className="text-xs text-zinc-400">
              Publish the first post above or switch scope to view public
              community updates.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => {
              const isMine = post.author_id === user?.id;
              const commentsOpen = expandedPostId === post.id;
              const postComments = commentsByPost[post.id] || [];

              return (
                <article
                  key={post.id}
                  className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-3.5"
                >
                  {/* Author Row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                        name={post.author_display_name}
                        avatarPath={post.author_avatar_url}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-white truncate">
                            {post.author_display_name}
                          </span>
                          <span className="font-mono text-[11px] text-zinc-500 truncate">
                            @{post.author_username}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-500">
                          <span>{formatRelativeTime(post.created_at)}</span>
                          <span>·</span>
                          <span>
                            {post.visibility === "contacts"
                              ? "Contacts"
                              : "Public"}
                          </span>
                          {post.edited_at && <span>· edited</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {isMine ? (
                        <>
                          <button
                            type="button"
                            aria-label="Edit post"
                            onClick={() => {
                              setEditingPostId(post.id);
                              setEditingBody(post.body);
                            }}
                            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-white cursor-pointer"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Delete post"
                            onClick={() => void handleDeletePost(post.id)}
                            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-red-300 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            title={`Message @${post.author_username}`}
                            aria-label={`Message ${post.author_display_name}`}
                            onClick={async () => {
                              const convId = await startDirectConversation(
                                post.author_id
                              );
                              if (convId) router.push(`/app/chats/${convId}`);
                            }}
                            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-white cursor-pointer"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Block author"
                            aria-label="Block author"
                            onClick={async () => {
                              const ok = await blockUser(post.author_id);
                              if (ok) {
                                setPosts((prev) =>
                                  prev.filter(
                                    (x) => x.author_id !== post.author_id
                                  )
                                );
                              }
                            }}
                            className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200 cursor-pointer"
                          >
                            <Ban className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Report post"
                            aria-label="Report post"
                            onClick={() =>
                              openReportModal({
                                postId: post.id,
                                reportedUserId: post.author_id,
                                label: `Post by @${post.author_username}`,
                              })
                            }
                            className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200 cursor-pointer"
                          >
                            <Flag className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Body */}
                  {editingPostId === post.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editingBody}
                        onChange={(e) => setEditingBody(e.target.value)}
                        maxLength={2000}
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="primary"
                          onClick={() => void handleSaveEditPost(post.id)}
                        >
                          Save
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingPostId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    post.body && (
                      <p className="whitespace-pre-wrap break-words text-sm text-zinc-200 leading-relaxed">
                        {post.body}
                      </p>
                    )
                  )}

                  {post.media_path && (
                    <PrivateMediaImage
                      bucket="social-media"
                      path={post.media_path}
                      alt={post.media_name || "Post image"}
                      className="max-h-96 w-full object-contain"
                    />
                  )}

                  {/* Actions Row */}
                  <div className="flex items-center gap-4 border-t border-white/[0.06] pt-3">
                    <button
                      type="button"
                      onClick={() => void handleToggleLike(post)}
                      aria-pressed={post.viewer_has_liked}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 font-mono text-xs transition-colors cursor-pointer",
                        post.viewer_has_liked
                          ? "bg-white text-zinc-950 font-semibold"
                          : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                      )}
                    >
                      <Heart
                        className={cn(
                          "h-3.5 w-3.5",
                          post.viewer_has_liked && "fill-current"
                        )}
                      />
                      <span>{post.like_count}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (commentsOpen) {
                          setExpandedPostId(null);
                        } else {
                          setExpandedPostId(post.id);
                          void loadCommentsForPost(post.id);
                        }
                      }}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 font-mono text-xs transition-colors cursor-pointer",
                        commentsOpen
                          ? "bg-white/[0.08] text-white"
                          : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                      )}
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      <span>{post.comment_count}</span>
                    </button>
                  </div>

                  {/* Comments Section */}
                  {commentsOpen && (
                    <div className="space-y-3 border-t border-white/[0.06] pt-3">
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {postComments.length === 0 ? (
                          <p className="text-xs text-zinc-500">
                            No comments yet. Add a reply below.
                          </p>
                        ) : (
                          postComments.map((c) => {
                            const canRemove =
                              c.author_id === user?.id || isMine;
                            return (
                              <div
                                key={c.id}
                                className="flex items-start justify-between gap-2 rounded-xl bg-[var(--bg-canvas)] px-3 py-2"
                              >
                                <div className="flex items-start gap-2 min-w-0">
                                  <Avatar
                                    name={c.author_display_name}
                                    avatarPath={c.author_avatar_url}
                                    size="xs"
                                    className="mt-0.5"
                                  />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-medium text-white">
                                        {c.author_display_name}
                                      </span>
                                      <span className="font-mono text-[10px] text-zinc-500">
                                        @{c.author_username} ·{" "}
                                        {formatRelativeTime(c.created_at)}
                                      </span>
                                    </div>
                                    <p className="mt-0.5 text-xs text-zinc-300 break-words">
                                      {c.body}
                                    </p>
                                  </div>
                                </div>
                                {canRemove && (
                                  <button
                                    type="button"
                                    aria-label="Delete comment"
                                    onClick={() =>
                                      void handleDeleteComment(post.id, c.id)
                                    }
                                    className="text-zinc-500 hover:text-red-300 cursor-pointer"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={commentDraft}
                          onChange={(e) => setCommentDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              void handleAddComment(post.id);
                            }
                          }}
                          placeholder="Write a comment..."
                          maxLength={1000}
                          className="h-9 flex-1 rounded-xl border border-white/10 bg-[var(--bg-canvas)] px-3 text-xs text-white placeholder:text-zinc-500 focus:border-white/30 focus:outline-none"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="primary"
                          loading={submittingComment}
                          disabled={!commentDraft.trim()}
                          onClick={() => void handleAddComment(post.id)}
                        >
                          <Send className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}

            {hasMore && (
              <div className="flex justify-center pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={loadingMore}
                  onClick={() => {
                    const last = posts[posts.length - 1];
                    if (!last) return;
                    setLoadingMore(true);
                    void fetchFeedPage({
                      createdAt: last.created_at,
                      id: last.id,
                    });
                  }}
                >
                  Load older posts
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
