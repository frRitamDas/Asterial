"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Compass,
  CornerDownRight,
  Edit2,
  Flag,
  Globe,
  Heart,
  ImagePlus,
  Loader2,
  MessageCircle,
  Orbit,
  RefreshCw,
  Send,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  postBodySchema,
  postCommentSchema,
  type EnrichedPostComment,
  type FeedPostItem,
  type FeedScope,
  type PostVisibility,
} from "@asterial/core";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { feedService, mediaService } from "@/lib/services";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PrivateMediaAsset } from "@/components/ui/PrivateMediaImage";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { formatShortTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export default function CommunityFeedPage() {
  const { user, profile, openReportModal } = useWorkspace();
  const { pushToast } = useToast();

  const [scope, setScope] = useState<FeedScope>("all");
  const [posts, setPosts] = useState<FeedPostItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Composer State
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<PostVisibility>("public");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [uploadPct, setUploadPct] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);

  // Edit Post State
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Comments & Threaded Replies State
  const [openCommentsPostId, setOpenCommentsPostId] = useState<string | null>(
    null
  );
  const [commentsByPost, setCommentsByPost] = useState<
    Record<string, EnrichedPostComment[]>
  >({});
  const [loadingCommentsId, setLoadingCommentsId] = useState<string | null>(
    null
  );
  const [commentDraft, setCommentDraft] = useState("");
  const [replyingToComment, setReplyingToComment] =
    useState<EnrichedPostComment | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);

  const loadFeed = useCallback(
    async (reset = true, cursor?: { createdAt: string; id: string }) => {
      if (reset) {
        setLoading(true);
        setErrorText(null);
      } else {
        setLoadingMore(true);
      }

      try {
        const res = await feedService.fetchFeedPage({
          scope,
          beforeCreatedAt: cursor?.createdAt ?? null,
          beforeId: cursor?.id ?? null,
        });
        setHasMore(res.hasMore);
        setPosts((prev) => {
          if (reset) return res.posts;
          const existing = new Set(prev.map((p) => p.id));
          return [...prev, ...res.posts.filter((p) => !existing.has(p.id))];
        });
      } catch (err) {
        setErrorText(
          err instanceof Error ? err.message : "Could not load community feed."
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [scope]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadFeed(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadFeed]);

  useEffect(() => {
    if (!user?.id) return;
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`web-feed-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        () => {
          void loadFeed(true);
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadFeed, user?.id]);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setComposerError(null);

    const parsed = postBodySchema.safeParse({ body, visibility });
    if (!parsed.success) {
      setComposerError(parsed.error.issues[0]?.message || "Check post text.");
      return;
    }
    if (!parsed.data.body && !mediaFile) {
      setComposerError("Write something or attach a photo/video.");
      return;
    }

    setPublishing(true);
    setUploadPct(0);
    try {
      let uploadedMedia = null;
      if (mediaFile) {
        uploadedMedia = await mediaService.uploadSocialMediaFile({
          domain: "posts",
          userId: user.id,
          file: mediaFile,
          kind: "social-media",
          onProgress: setUploadPct,
        });
      }

      await feedService.createPost({
        authorId: user.id,
        body: parsed.data.body,
        visibility: parsed.data.visibility,
        media: uploadedMedia,
      });

      setBody("");
      setMediaFile(null);
      await loadFeed(true);
      pushToast({ title: "Post published", variant: "success" });
    } catch (err) {
      setComposerError(
        err instanceof Error ? err.message : "Unable to publish post."
      );
    } finally {
      setPublishing(false);
    }
  };

  const handleToggleLike = async (post: FeedPostItem) => {
    // Optimistic flip
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? {
              ...p,
              viewer_has_liked: !p.viewer_has_liked,
              like_count: p.viewer_has_liked
                ? Math.max(0, p.like_count - 1)
                : p.like_count + 1,
            }
          : p
      )
    );

    try {
      const res = await feedService.toggleLike(post.id);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
                ...p,
                viewer_has_liked: res.liked,
                like_count: res.like_count,
              }
            : p
        )
      );
    } catch {
      await loadFeed(true);
    }
  };

  const handleSaveEdit = async (postId: string) => {
    if (!editBody.trim()) return;
    setSavingEdit(true);
    try {
      await feedService.updatePost({ postId, body: editBody });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                body: editBody.trim(),
                edited_at: new Date().toISOString(),
              }
            : p
        )
      );
      setEditingPostId(null);
      pushToast({ title: "Post updated", variant: "success" });
    } catch (err) {
      pushToast({
        title: "Could not update post",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      await feedService.deletePost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      pushToast({ title: "Post deleted", variant: "success" });
    } catch (err) {
      pushToast({
        title: "Could not delete post",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    }
  };

  const loadCommentsForPost = async (postId: string) => {
    setLoadingCommentsId(postId);
    try {
      const list = await feedService.fetchComments(postId);
      setCommentsByPost((prev) => ({ ...prev, [postId]: list }));
    } catch (err) {
      pushToast({
        title: "Could not load comments",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    } finally {
      setLoadingCommentsId(null);
    }
  };

  const toggleCommentsDrawer = (postId: string) => {
    if (openCommentsPostId === postId) {
      setOpenCommentsPostId(null);
      setReplyingToComment(null);
      return;
    }
    setOpenCommentsPostId(postId);
    setReplyingToComment(null);
    setCommentDraft("");
    void loadCommentsForPost(postId);
  };

  const handleSubmitComment = async (postId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = postCommentSchema.safeParse({
      body: commentDraft,
      parentCommentId: replyingToComment?.id ?? null,
    });
    if (!parsed.success) return;

    setSubmittingComment(true);
    try {
      await feedService.addComment({
        postId,
        authorId: user.id,
        body: parsed.data.body,
        parentCommentId: parsed.data.parentCommentId ?? null,
      });
      setCommentDraft("");
      setReplyingToComment(null);
      await loadCommentsForPost(postId);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p
        )
      );
    } catch (err) {
      pushToast({
        title: "Could not post comment",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    try {
      await feedService.deleteComment(commentId);
      await loadCommentsForPost(postId);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, comment_count: Math.max(0, p.comment_count - 1) }
            : p
        )
      );
    } catch (err) {
      pushToast({
        title: "Could not delete comment",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    }
  };

  const visibilityBadge = (vis: PostVisibility) => {
    if (vis === "orbit") {
      return (
        <Badge variant="accent" size="sm">
          <Orbit className="h-2.5 w-2.5" />
          Close Orbit
        </Badge>
      );
    }
    if (vis === "contacts") {
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
        Public
      </Badge>
    );
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 py-6 sm:px-8">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
              Community Feed
            </h1>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Share updates, media, and threaded discussions with everyone,
              direct contacts, or your Close Orbit.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SegmentedControl<FeedScope>
              ariaLabel="Feed filter"
              value={scope}
              onChange={setScope}
              options={[
                { id: "all", label: "All" },
                { id: "contacts", label: "Contacts" },
                { id: "orbit", label: "Close Orbit" },
              ]}
            />
            <Button
              size="icon"
              variant="secondary"
              title="Refresh feed"
              aria-label="Refresh feed"
              onClick={() => void loadFeed(true)}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Post Composer Card */}
        <form
          onSubmit={handlePublish}
          className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 space-y-3"
        >
          {composerError && (
            <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {composerError}
            </div>
          )}

          <div className="flex items-start gap-3">
            {profile && (
              <Avatar
                name={profile.display_name}
                avatarPath={profile.avatar_url}
                size="md"
              />
            )}
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Share an update, note, or milestone…"
              rows={3}
              maxLength={2000}
              className="flex-1 resize-none bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
            />
          </div>

          {mediaFile && (
            <div className="flex items-center justify-between rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 py-2 text-xs">
              <span className="truncate text-[var(--text-primary)]">
                {mediaFile.name}
                {publishing && uploadPct > 0 ? ` · ${uploadPct}%` : ""}
              </span>
              <button
                type="button"
                onClick={() => setMediaFile(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-3">
            <div className="flex items-center gap-2">
              <input
                ref={mediaInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm"
                className="hidden"
                onChange={(e) => {
                  setMediaFile(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => mediaInputRef.current?.click()}
              >
                <ImagePlus className="h-3.5 w-3.5" />
                Photo / Video
              </Button>

              <SegmentedControl<PostVisibility>
                ariaLabel="Post audience"
                value={visibility}
                onChange={setVisibility}
                options={[
                  { id: "public", label: "Public" },
                  { id: "contacts", label: "Contacts" },
                  { id: "orbit", label: "Orbit" },
                ]}
              />
            </div>

            <Button
              type="submit"
              size="sm"
              variant="primary"
              loading={publishing}
              disabled={!body.trim() && !mediaFile}
            >
              Publish
            </Button>
          </div>
        </form>

        {/* Feed Timeline */}
        {errorText ? (
          <ErrorState
            title="Could not load feed"
            message={errorText}
            onRetry={() => void loadFeed(true)}
          />
        ) : loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-3"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-2.5 w-20" />
                  </div>
                </div>
                <Skeleton className="h-16 w-full" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <EmptyState
            icon={<Compass className="h-5 w-5" />}
            title="No posts in this feed view yet"
            description={
              scope === "orbit"
                ? "Posts from contacts in your Close Orbit will appear here."
                : "Publish the first update to start a conversation."
            }
          />
        ) : (
          <div className="space-y-4">
            {posts.map((post) => {
              const isOwn = post.author_id === user?.id;
              const isEditing = editingPostId === post.id;
              const commentsOpen = openCommentsPostId === post.id;
              const allComments = commentsByPost[post.id] ?? [];
              const rootComments = allComments.filter(
                (c) => !c.parent_comment_id
              );
              const repliesByParent = new Map<string, EnrichedPostComment[]>();
              for (const c of allComments) {
                if (c.parent_comment_id) {
                  const arr = repliesByParent.get(c.parent_comment_id) ?? [];
                  arr.push(c);
                  repliesByParent.set(c.parent_comment_id, arr);
                }
              }

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
                        size="md"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="truncate text-sm font-semibold text-[var(--text-primary)]">
                            {post.author_display_name}
                          </h2>
                          {visibilityBadge(post.visibility)}
                        </div>
                        <p className="font-mono text-xs text-[var(--text-muted)]">
                          @{post.author_username} ·{" "}
                          {formatShortTime(post.created_at)}
                          {post.edited_at ? " · edited" : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {isOwn ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPostId(post.id);
                              setEditBody(post.body);
                            }}
                            aria-label="Edit post"
                            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-white/[0.06] hover:text-[var(--text-primary)] cursor-pointer"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeletePost(post.id)}
                            aria-label="Delete post"
                            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-red-500/15 hover:text-red-300 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            openReportModal({
                              reportedUserId: post.author_id,
                              postId: post.id,
                              label: "post",
                            })
                          }
                          aria-label="Report post"
                          className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-red-500/15 hover:text-red-300 cursor-pointer"
                        >
                          <Flag className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Body */}
                  {isEditing ? (
                    <div className="space-y-2">
                      <textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        rows={3}
                        className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-canvas)] p-3 text-sm text-[var(--text-primary)] focus:outline-none"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingPostId(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          loading={savingEdit}
                          onClick={() => void handleSaveEdit(post.id)}
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    post.body && (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-primary)]">
                        {post.body}
                      </p>
                    )
                  )}

                  {/* Media */}
                  {post.media_path && (
                    <PrivateMediaAsset
                      bucket="social-media"
                      path={post.media_path}
                      mimeType={post.media_mime}
                      alt={post.media_name || "Post attachment"}
                      className="max-h-[440px] w-full"
                    />
                  )}

                  {/* Action Bar */}
                  <div className="flex items-center gap-4 border-t border-[var(--border-subtle)] pt-3">
                    <button
                      type="button"
                      onClick={() => void handleToggleLike(post)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                        post.viewer_has_liked
                          ? "bg-[var(--accent-signal-subtle)] text-[var(--accent-primary)]"
                          : "text-[var(--text-secondary)] hover:bg-white/[0.05] hover:text-[var(--text-primary)]"
                      )}
                    >
                      <Heart
                        className={cn(
                          "h-4 w-4",
                          post.viewer_has_liked && "fill-current"
                        )}
                      />
                      <span>{post.like_count}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleCommentsDrawer(post.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                        commentsOpen
                          ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                          : "text-[var(--text-secondary)] hover:bg-white/[0.05] hover:text-[var(--text-primary)]"
                      )}
                    >
                      <MessageCircle className="h-4 w-4" />
                      <span>{post.comment_count}</span>
                    </button>
                  </div>

                  {/* Threaded Comments Drawer */}
                  {commentsOpen && (
                    <div className="space-y-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3.5">
                      {loadingCommentsId === post.id ? (
                        <div className="flex items-center justify-center py-4 text-xs text-[var(--text-muted)] gap-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Loading comments…
                        </div>
                      ) : rootComments.length === 0 ? (
                        <p className="py-2 text-center text-xs text-[var(--text-muted)]">
                          No comments yet. Start the discussion below.
                        </p>
                      ) : (
                        <div className="space-y-2.5">
                          {rootComments.map((c) => {
                            const replies = repliesByParent.get(c.id) ?? [];
                            return (
                              <div key={c.id} className="space-y-2">
                                <div className="flex items-start justify-between gap-2 rounded-xl bg-[var(--bg-surface)] p-2.5">
                                  <div className="flex items-start gap-2.5 min-w-0">
                                    <Avatar
                                      name={c.author_display_name}
                                      avatarPath={c.author_avatar_url}
                                      size="xs"
                                    />
                                    <div className="min-w-0">
                                      <p className="text-xs">
                                        <span className="font-semibold text-[var(--text-primary)]">
                                          {c.author_display_name}
                                        </span>{" "}
                                        <span className="font-mono text-[10px] text-[var(--text-muted)]">
                                          @{c.author_username} ·{" "}
                                          {formatShortTime(c.created_at)}
                                        </span>
                                      </p>
                                      <p className="mt-0.5 text-xs text-[var(--text-secondary)] break-words">
                                        {c.body}
                                      </p>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setReplyingToComment(c)
                                        }
                                        className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent-primary)] hover:underline cursor-pointer"
                                      >
                                        <CornerDownRight className="h-3 w-3" />
                                        Reply
                                      </button>
                                    </div>
                                  </div>
                                  {c.author_id === user?.id && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void handleDeleteComment(post.id, c.id)
                                      }
                                      aria-label="Delete comment"
                                      className="p-1 text-[var(--text-muted)] hover:text-red-400 cursor-pointer"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>

                                {/* Nested Replies */}
                                {replies.length > 0 && (
                                  <div className="ml-6 space-y-1.5 border-l border-[var(--border-strong)] pl-3">
                                    {replies.map((rep) => (
                                      <div
                                        key={rep.id}
                                        className="flex items-start justify-between gap-2 rounded-xl bg-[var(--bg-surface)]/75 p-2"
                                      >
                                        <div className="flex items-start gap-2 min-w-0">
                                          <Avatar
                                            name={rep.author_display_name}
                                            avatarPath={rep.author_avatar_url}
                                            size="xs"
                                          />
                                          <div className="min-w-0">
                                            <p className="text-xs">
                                              <span className="font-semibold text-[var(--text-primary)]">
                                                {rep.author_display_name}
                                              </span>{" "}
                                              <span className="font-mono text-[10px] text-[var(--text-muted)]">
                                                @{rep.author_username} ·{" "}
                                                {formatShortTime(rep.created_at)}
                                              </span>
                                            </p>
                                            <p className="mt-0.5 text-xs text-[var(--text-secondary)] break-words">
                                              {rep.body}
                                            </p>
                                          </div>
                                        </div>
                                        {rep.author_id === user?.id && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              void handleDeleteComment(
                                                post.id,
                                                rep.id
                                              )
                                            }
                                            aria-label="Delete reply"
                                            className="p-1 text-[var(--text-muted)] hover:text-red-400 cursor-pointer"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Comment / Reply Input */}
                      <form
                        onSubmit={(e) => void handleSubmitComment(post.id, e)}
                        className="space-y-2 pt-1"
                      >
                        {replyingToComment && (
                          <div className="flex items-center justify-between rounded-lg bg-[var(--accent-signal-subtle)] px-2.5 py-1 text-[11px] text-[var(--accent-primary)]">
                            <span>
                              Replying to @{replyingToComment.author_username}
                            </span>
                            <button
                              type="button"
                              onClick={() => setReplyingToComment(null)}
                              className="cursor-pointer"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={commentDraft}
                            onChange={(e) => setCommentDraft(e.target.value)}
                            placeholder={
                              replyingToComment
                                ? `Reply to @${replyingToComment.author_username}…`
                                : "Write a comment…"
                            }
                            maxLength={1000}
                            className="h-9 flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-active)] focus:outline-none"
                          />
                          <Button
                            type="submit"
                            size="sm"
                            variant="primary"
                            loading={submittingComment}
                            disabled={!commentDraft.trim()}
                          >
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </form>
                    </div>
                  )}
                </article>
              );
            })}

            {hasMore && (
              <div className="flex justify-center pt-2">
                <Button
                  size="sm"
                  variant="secondary"
                  loading={loadingMore}
                  onClick={() => {
                    const last = posts[posts.length - 1];
                    if (last) {
                      void loadFeed(false, {
                        createdAt: last.created_at,
                        id: last.id,
                      });
                    }
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
