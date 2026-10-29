import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  FEED_PAGE_SIZE,
  formatByteSize,
  formatRelativeTime,
  postBodySchema,
  postCommentSchema,
  type EnrichedPostComment,
  type FeedPostItem,
  type FeedScope,
  type PostCommentRow,
  type PostVisibility,
  type ProfileRow,
} from "@asterial/core";
import { NativeAvatar } from "../components/NativeAvatar";
import { NativePrivateImage } from "../components/NativePrivateImage";
import { ReportModal } from "../components/ReportModal";
import { useMobileWorkspace } from "../context/MobileWorkspaceContext";
import {
  buildSocialMediaStoragePath,
  pickAndValidateNativeFile,
  primePrivateSignedUrls,
  uploadValidatedNativeFile,
  type ValidatedNativeFile,
} from "../lib/storage";

export function FeedScreen({
  onOpenConversation,
}: {
  onOpenConversation: (conversationId: string) => void;
}) {
  const {
    supabase,
    user,
    palette,
    startDirectChat,
    toggleBlockUser,
    submitReport,
    showToast,
  } = useMobileWorkspace();

  const [tab, setTab] = useState<"all" | "contacts" | "orbit" | "mine">("all");
  const [posts, setPosts] = useState<FeedPostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const [draftBody, setDraftBody] = useState("");
  const [draftVis, setDraftVis] = useState<PostVisibility>("public");
  const [draftImage, setDraftImage] = useState<ValidatedNativeFile | null>(
    null
  );
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const publishLockRef = useRef(false);

  const [editingPost, setEditingPost] = useState<FeedPostItem | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [commentPost, setCommentPost] = useState<FeedPostItem | null>(null);
  const [comments, setComments] = useState<EnrichedPostComment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [reportPost, setReportPost] = useState<FeedPostItem | null>(null);

  const loadFeed = useCallback(
    async (cursor?: { createdAt: string; id: string }) => {
      if (!supabase || !user) return;
      const scope: FeedScope =
        tab === "contacts" ? "contacts" : tab === "orbit" ? "orbit" : "all";
      const authorFilter = tab === "mine" ? user.id : null;

      const { data, error } = await supabase.rpc("get_feed_posts_page", {
        p_before_created_at: cursor?.createdAt || null,
        p_before_id: cursor?.id || null,
        p_author_id: authorFilter,
        p_scope: scope,
        p_limit: FEED_PAGE_SIZE,
      });

      if (error) {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
        return;
      }

      const items = (data || []) as FeedPostItem[];
      await Promise.all([
        primePrivateSignedUrls(
          supabase,
          "avatars",
          items.map((p) => p.author_avatar_url)
        ),
        primePrivateSignedUrls(
          supabase,
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
      setRefreshing(false);
      setLoadingMore(false);
    },
    [supabase, tab, user]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    void loadFeed();
  }, [loadFeed]);

  const loadComments = useCallback(
    async (postId: string) => {
      if (!supabase) return;
      const { data } = await supabase
        .from("post_comments")
        .select("*")
        .eq("post_id", postId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(100);

      const raw = (data || []) as PostCommentRow[];
      const uids = Array.from(new Set(raw.map((c) => c.author_id)));
      const profMap: Record<string, ProfileRow> = {};
      if (uids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("*")
          .in("id", uids);
        for (const p of (profs || []) as ProfileRow[]) {
          profMap[p.id] = p;
        }
      }

      setComments(
        raw.map((c) => ({
          ...c,
          author_username: profMap[c.author_id]?.username || "member",
          author_display_name: profMap[c.author_id]?.display_name || "Member",
          author_avatar_url: profMap[c.author_id]?.avatar_url || null,
        }))
      );
    },
    [supabase]
  );

  const handlePublish = async () => {
    if (!supabase || !user || publishLockRef.current) return;
    const parsed = postBodySchema.safeParse({
      body: draftBody,
      visibility: draftVis,
    });
    if (!parsed.success) {
      showToast(
        parsed.error.issues[0]?.message || "Check post text.",
        "error"
      );
      return;
    }
    if (!parsed.data.body && !draftImage) {
      showToast("Write something or attach a photo.", "error");
      return;
    }

    publishLockRef.current = true;
    setPublishing(true);
    try {
      let mediaPath: string | null = null;
      if (draftImage) {
        setUploadPercent(0);
        mediaPath = buildSocialMediaStoragePath(
          "posts",
          user.id,
          draftImage.fileName
        );
        await uploadValidatedNativeFile({
          supabase,
          bucket: "social-media",
          storagePath: mediaPath,
          file: draftImage,
          onProgress: (pct) => setUploadPercent(pct),
        });
      }

      const { error } = await supabase.from("posts").insert({
        author_id: user.id,
        body: parsed.data.body,
        visibility: parsed.data.visibility,
        media_path: mediaPath,
        media_name: draftImage?.fileName || null,
        media_mime: draftImage?.normalizedMime || null,
        media_size: draftImage?.byteSize || null,
        media_width: draftImage?.width || null,
        media_height: draftImage?.height || null,
      });
      if (error) throw new Error(error.message);

      setDraftBody("");
      setDraftImage(null);
      setUploadPercent(null);
      showToast("Published to Feed.", "success");
      await loadFeed();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not publish post.",
        "error"
      );
    } finally {
      setPublishing(false);
      setUploadPercent(null);
      publishLockRef.current = false;
    }
  };

  const handleToggleLike = async (post: FeedPostItem) => {
    if (!supabase) return;
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

    const { data, error } = await supabase.rpc("toggle_post_like", {
      p_post_id: post.id,
    });
    if (error) {
      await loadFeed();
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

  const handleDeletePost = async (postId: string) => {
    if (!supabase) return;
    const { error } = await supabase
      .from("posts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", postId);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    showToast("Post deleted.", "info");
  };

  const handleSendComment = async () => {
    if (!supabase || !user || !commentPost) return;
    const parsed = postCommentSchema.safeParse({ body: commentDraft });
    if (!parsed.success) return;

    const { error } = await supabase.from("post_comments").insert({
      post_id: commentPost.id,
      author_id: user.id,
      body: parsed.data.body,
    });
    if (error) {
      showToast(error.message, "error");
      return;
    }
    setCommentDraft("");
    setPosts((prev) =>
      prev.map((p) =>
        p.id === commentPost.id
          ? { ...p, comment_count: p.comment_count + 1 }
          : p
      )
    );
    await loadComments(commentPost.id);
  };

  return (
    <View style={[styles.root, { backgroundColor: palette.bgCanvas }]}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void loadFeed();
            }}
            tintColor={palette.accent}
          />
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (!hasMore || loadingMore || posts.length === 0) return;
          const last = posts[posts.length - 1];
          setLoadingMore(true);
          void loadFeed({ createdAt: last.created_at, id: last.id });
        }}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <View>
              <Text style={[styles.eyebrow, { color: palette.textMuted }]}>
                CHRONOLOGICAL STREAM
              </Text>
              <Text style={[styles.title, { color: palette.textPrimary }]}>
                Social Feed
              </Text>
            </View>

            {/* Composer */}
            <View
              style={[
                styles.composerCard,
                {
                  backgroundColor: palette.bgSurface,
                  borderColor: palette.borderSubtle,
                },
              ]}
            >
              <TextInput
                value={draftBody}
                onChangeText={setDraftBody}
                placeholder="Share a post, milestone, or visual update…"
                placeholderTextColor={palette.textMuted}
                multiline
                maxLength={2000}
                style={[
                  styles.postInput,
                  {
                    backgroundColor: palette.bgCanvas,
                    borderColor: palette.borderSubtle,
                    color: palette.textPrimary,
                  },
                ]}
              />

              {draftImage ? (
                <View style={styles.stagedRow}>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: palette.textSecondary,
                      fontSize: 11.5,
                      flex: 1,
                    }}
                  >
                    {draftImage.fileName} ({formatByteSize(draftImage.byteSize)}
                    ){uploadPercent !== null ? ` · ${uploadPercent}%` : ""}
                  </Text>
                  <Pressable onPress={() => setDraftImage(null)}>
                    <Text style={{ color: palette.danger, fontWeight: "800" }}>
                      ✕
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.composerActions}>
                <Pressable
                  onPress={async () => {
                    try {
                      const img =
                        await pickAndValidateNativeFile("social-image");
                      if (img) setDraftImage(img);
                    } catch (err) {
                      showToast(
                        err instanceof Error ? err.message : "Image rejected.",
                        "error"
                      );
                    }
                  }}
                  style={[
                    styles.metaBtn,
                    {
                      backgroundColor: palette.bgCanvas,
                      borderColor: palette.borderSubtle,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: palette.textSecondary,
                      fontSize: 12,
                      fontWeight: "700",
                    }}
                  >
                    + Photo
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() =>
                    setDraftVis((v) =>
                      v === "public"
                        ? "contacts"
                        : v === "contacts"
                          ? "orbit"
                          : "public"
                    )
                  }
                  style={[
                    styles.metaBtn,
                    {
                      backgroundColor: palette.bgCanvas,
                      borderColor: palette.borderSubtle,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: palette.textSecondary,
                      fontSize: 12,
                      fontWeight: "700",
                    }}
                  >
                    {draftVis === "public"
                      ? "Public"
                      : draftVis === "contacts"
                        ? "Contacts"
                        : "Close Orbit"}
                  </Text>
                </Pressable>

                <Pressable
                  disabled={publishing || (!draftBody.trim() && !draftImage)}
                  onPress={() => void handlePublish()}
                  style={[
                    styles.publishBtn,
                    {
                      backgroundColor: palette.accentBg,
                      opacity:
                        publishing || (!draftBody.trim() && !draftImage)
                          ? 0.5
                          : 1,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: palette.accentFg,
                      fontSize: 12.5,
                      fontWeight: "800",
                    }}
                  >
                    {publishing ? "Publishing…" : "Publish"}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Scope Tabs */}
            <View
              style={[
                styles.scopeBar,
                {
                  backgroundColor: palette.bgSurface,
                  borderColor: palette.borderSubtle,
                },
              ]}
            >
              {(
                [
                  ["all", "All"],
                  ["contacts", "Contacts"],
                  ["orbit", "Orbit"],
                  ["mine", "Mine"],
                ] as const
              ).map(([val, label]) => (
                <Pressable
                  key={val}
                  onPress={() => setTab(val)}
                  style={[
                    styles.scopeItem,
                    tab === val && { backgroundColor: palette.accentBg },
                  ]}
                >
                  <Text
                    style={{
                      color:
                        tab === val ? palette.accentFg : palette.textSecondary,
                      fontSize: 12,
                      fontWeight: "700",
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ paddingVertical: 32, alignItems: "center" }}>
              <ActivityIndicator color={palette.accent} />
            </View>
          ) : (
            <View
              style={[
                styles.emptyCard,
                {
                  backgroundColor: palette.bgSurface,
                  borderColor: palette.borderSubtle,
                },
              ]}
            >
              <Text
                style={{
                  color: palette.textPrimary,
                  fontSize: 15,
                  fontWeight: "800",
                }}
              >
                No posts in this scope yet
              </Text>
              <Text
                style={{
                  color: palette.textSecondary,
                  fontSize: 12.5,
                  marginTop: 5,
                  textAlign: "center",
                }}
              >
                Publish the first post above or switch scope.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const isMine = item.author_id === user?.id;
          return (
            <View
              style={[
                styles.postCard,
                {
                  backgroundColor: palette.bgSurface,
                  borderColor: palette.borderSubtle,
                },
              ]}
            >
              <View style={styles.authorRow}>
                <NativeAvatar
                  supabase={supabase}
                  palette={palette}
                  label={item.author_display_name}
                  storagePath={item.author_avatar_url}
                  size={36}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: palette.textPrimary,
                      fontSize: 13.5,
                      fontWeight: "800",
                    }}
                  >
                    {item.author_display_name}
                  </Text>
                  <Text style={{ color: palette.textMuted, fontSize: 11 }}>
                    @{item.author_username} ·{" "}
                    {formatRelativeTime(item.created_at)}
                    {item.edited_at ? " · edited" : ""}
                  </Text>
                </View>

                {isMine ? (
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <Pressable
                      onPress={() => {
                        setEditingPost(item);
                        setEditingBody(item.body);
                      }}
                    >
                      <Text
                        style={{
                          color: palette.textSecondary,
                          fontSize: 12,
                          fontWeight: "700",
                        }}
                      >
                        Edit
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => void handleDeletePost(item.id)}>
                      <Text
                        style={{
                          color: palette.danger,
                          fontSize: 12,
                          fontWeight: "700",
                        }}
                      >
                        Delete
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <Pressable
                      onPress={async () => {
                        const convId = await startDirectChat(item.author_id);
                        onOpenConversation(convId);
                      }}
                    >
                      <Text
                        style={{
                          color: palette.textPrimary,
                          fontSize: 12,
                          fontWeight: "700",
                        }}
                      >
                        DM
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => setReportPost(item)}>
                      <Text
                        style={{ color: palette.textMuted, fontSize: 12 }}
                      >
                        Report
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>

              {item.body ? (
                <Text
                  style={{
                    color: palette.textPrimary,
                    fontSize: 14,
                    lineHeight: 20,
                  }}
                >
                  {item.body}
                </Text>
              ) : null}

              {item.media_path ? (
                <NativePrivateImage
                  supabase={supabase}
                  bucket="social-media"
                  path={item.media_path}
                  alt={item.media_name || "Post image"}
                  palette={palette}
                />
              ) : null}

              <View
                style={[
                  styles.postFooter,
                  { borderTopColor: palette.borderSubtle },
                ]}
              >
                <Pressable
                  onPress={() => void handleToggleLike(item)}
                  style={[
                    styles.engageBtn,
                    item.viewer_has_liked && {
                      backgroundColor: palette.accentBg,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: item.viewer_has_liked
                        ? palette.accentFg
                        : palette.textSecondary,
                      fontSize: 12,
                      fontWeight: "800",
                    }}
                  >
                    ♥ {item.like_count}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    setCommentPost(item);
                    void loadComments(item.id);
                  }}
                  style={styles.engageBtn}
                >
                  <Text
                    style={{
                      color: palette.textSecondary,
                      fontSize: 12,
                      fontWeight: "700",
                    }}
                  >
                    💬 {item.comment_count}
                  </Text>
                </Pressable>

                {!isMine ? (
                  <Pressable
                    onPress={async () => {
                      const blocked = await toggleBlockUser(item.author_id);
                      if (blocked) {
                        setPosts((prev) =>
                          prev.filter((p) => p.author_id !== item.author_id)
                        );
                      }
                    }}
                    style={{ marginLeft: "auto" }}
                  >
                    <Text style={{ color: palette.textMuted, fontSize: 11.5 }}>
                      Block
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        }}
      />

      {/* Edit Post Modal */}
      <Modal
        visible={Boolean(editingPost)}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingPost(null)}
      >
        <View style={styles.backdrop}>
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: palette.bgSurface,
                borderColor: palette.borderSubtle,
              },
            ]}
          >
            <Text
              style={{
                color: palette.textPrimary,
                fontSize: 17,
                fontWeight: "800",
              }}
            >
              Edit Post
            </Text>
            <TextInput
              value={editingBody}
              onChangeText={setEditingBody}
              multiline
              maxLength={2000}
              style={[
                styles.postInput,
                {
                  marginTop: 12,
                  backgroundColor: palette.bgCanvas,
                  borderColor: palette.borderSubtle,
                  color: palette.textPrimary,
                },
              ]}
            />
            <View style={{ marginTop: 14, flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => setEditingPost(null)}
                style={[
                  styles.metaBtn,
                  { flex: 1, alignItems: "center", borderColor: palette.borderSubtle },
                ]}
              >
                <Text style={{ color: palette.textSecondary }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  if (!supabase || !editingPost || !editingBody.trim()) return;
                  const { error } = await supabase
                    .from("posts")
                    .update({ body: editingBody.trim() })
                    .eq("id", editingPost.id);
                  if (error) showToast(error.message, "error");
                  else {
                    setEditingPost(null);
                    await loadFeed();
                  }
                }}
                style={[
                  styles.publishBtn,
                  { flex: 1, alignItems: "center", backgroundColor: palette.accentBg },
                ]}
              >
                <Text style={{ color: palette.accentFg, fontWeight: "800" }}>
                  Save
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Comments Modal */}
      <Modal
        visible={Boolean(commentPost)}
        transparent
        animationType="slide"
        onRequestClose={() => setCommentPost(null)}
      >
        <View style={styles.backdrop}>
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: palette.bgSurface,
                borderColor: palette.borderSubtle,
              },
            ]}
          >
            <View style={styles.authorRow}>
              <Text
                style={{
                  color: palette.textPrimary,
                  fontSize: 16,
                  fontWeight: "800",
                  flex: 1,
                }}
              >
                Comments
              </Text>
              <Pressable onPress={() => setCommentPost(null)}>
                <Text style={{ color: palette.textSecondary, fontWeight: "800" }}>
                  Close
                </Text>
              </Pressable>
            </View>

            <FlatList
              data={comments}
              keyExtractor={(c) => c.id}
              style={{ maxHeight: 260, marginTop: 10 }}
              contentContainerStyle={{ gap: 8 }}
              ListEmptyComponent={
                <Text style={{ color: palette.textMuted, fontSize: 12.5 }}>
                  No comments yet.
                </Text>
              }
              renderItem={({ item: c }) => (
                <View
                  style={[
                    styles.commentRow,
                    {
                      backgroundColor: palette.bgCanvas,
                      borderColor: palette.borderSubtle,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: palette.textPrimary,
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      {c.author_display_name} (@{c.author_username})
                    </Text>
                    <Text
                      style={{
                        color: palette.textSecondary,
                        fontSize: 12.5,
                        marginTop: 2,
                      }}
                    >
                      {c.body}
                    </Text>
                  </View>
                  {c.author_id === user?.id ||
                  commentPost?.author_id === user?.id ? (
                    <Pressable
                      onPress={async () => {
                        if (!supabase || !commentPost) return;
                        await supabase
                          .from("post_comments")
                          .update({ deleted_at: new Date().toISOString() })
                          .eq("id", c.id);
                        await loadComments(commentPost.id);
                        await loadFeed();
                      }}
                    >
                      <Text style={{ color: palette.danger, fontSize: 11.5 }}>
                        Delete
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              )}
            />

            <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>
              <TextInput
                value={commentDraft}
                onChangeText={setCommentDraft}
                placeholder="Write a comment…"
                placeholderTextColor={palette.textMuted}
                maxLength={1000}
                style={[
                  styles.commentInput,
                  {
                    backgroundColor: palette.bgCanvas,
                    borderColor: palette.borderSubtle,
                    color: palette.textPrimary,
                  },
                ]}
              />
              <Pressable
                onPress={() => void handleSendComment()}
                style={[
                  styles.publishBtn,
                  { backgroundColor: palette.accentBg },
                ]}
              >
                <Text style={{ color: palette.accentFg, fontWeight: "800" }}>
                  Post
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ReportModal
        visible={Boolean(reportPost)}
        palette={palette}
        subjectLabel={
          reportPost ? `Post by @${reportPost.author_username}` : "Post"
        }
        onClose={() => setReportPost(null)}
        onSubmit={async (reason, details) => {
          if (!reportPost) return;
          await submitReport({
            postId: reportPost.id,
            reportedUserId: reportPost.author_id,
            reason,
            details,
          });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  listContent: {
    padding: 14,
    gap: 12,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.6,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
  },
  composerCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  postInput: {
    borderWidth: 1,
    borderRadius: 13,
    minHeight: 72,
    padding: 12,
    fontSize: 13.5,
    textAlignVertical: "top",
  },
  stagedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  composerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  publishBtn: {
    marginLeft: "auto",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    justifyContent: "center",
  },
  scopeBar: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 12,
    padding: 3,
  },
  scopeItem: {
    flex: 1,
    borderRadius: 9,
    paddingVertical: 7,
    alignItems: "center",
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
  },
  postCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 15,
    gap: 11,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  postFooter: {
    borderTopWidth: 1,
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  engageBtn: {
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: 20,
  },
  commentRow: {
    borderWidth: 1,
    borderRadius: 11,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
  },
});
