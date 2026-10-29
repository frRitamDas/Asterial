"use client";

import {
  FEED_PAGE_SIZE,
  type EnrichedPostComment,
  type FeedPostItem,
  type FeedScope,
  type PostCommentRow,
  type PostRow,
  type PostVisibility,
} from "@asterial/core";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { primeAvatarSignedUrls, primeBucketSignedUrls } from "@/lib/supabase/storage";
import type { Profile } from "@/lib/types/database";
import { normalizeServiceError } from "./errors";

export const feedService = {
  async fetchFeedPage(params: {
    scope?: FeedScope;
    authorId?: string | null;
    beforeCreatedAt?: string | null;
    beforeId?: string | null;
    pageSize?: number;
  }): Promise<{ posts: FeedPostItem[]; hasMore: boolean }> {
    const supabase = getSupabaseBrowserClient();
    const limit = params.pageSize ?? FEED_PAGE_SIZE;

    const { data, error } = await supabase.rpc("get_feed_posts_page", {
      p_before_created_at: params.beforeCreatedAt ?? null,
      p_before_id: params.beforeId ?? null,
      p_author_id: params.authorId ?? null,
      p_scope: params.scope ?? "all",
      p_limit: limit + 1,
    });

    if (error) {
      throw normalizeServiceError(error, "Unable to load community feed.");
    }

    const rows = (data ?? []) as FeedPostItem[];
    const hasMore = rows.length > limit;
    const posts = hasMore ? rows.slice(0, limit) : rows;

    await Promise.all([
      primeAvatarSignedUrls(posts.map((p) => p.author_avatar_url)),
      primeBucketSignedUrls(
        "social-media",
        posts.map((p) => p.media_path)
      ),
    ]);

    return { posts, hasMore };
  },

  async createPost(params: {
    authorId: string;
    body: string;
    visibility: PostVisibility;
    media?: {
      storagePath: string;
      fileName: string;
      mimeType: string;
      byteSize: number;
      width: number | null;
      height: number | null;
    } | null;
  }): Promise<PostRow> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("posts")
      .insert({
        author_id: params.authorId,
        body: params.body.trim(),
        visibility: params.visibility,
        media_path: params.media?.storagePath ?? null,
        media_name: params.media?.fileName ?? null,
        media_mime: params.media?.mimeType ?? null,
        media_size: params.media?.byteSize ?? null,
        media_width: params.media?.width ?? null,
        media_height: params.media?.height ?? null,
      })
      .select("*")
      .single();

    if (error || !data) {
      throw normalizeServiceError(error, "Unable to publish post.");
    }
    return data as PostRow;
  },

  async updatePost(params: {
    postId: string;
    body: string;
    visibility?: PostVisibility;
  }): Promise<PostRow> {
    const supabase = getSupabaseBrowserClient();
    const updates: Record<string, unknown> = {
      body: params.body.trim(),
      edited_at: new Date().toISOString(),
    };
    if (params.visibility) {
      updates.visibility = params.visibility;
    }

    const { data, error } = await supabase
      .from("posts")
      .update(updates)
      .eq("id", params.postId)
      .select("*")
      .single();

    if (error || !data) {
      throw normalizeServiceError(error, "Unable to update post.");
    }
    return data as PostRow;
  },

  async deletePost(postId: string): Promise<void> {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from("posts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", postId);
    if (error) {
      throw normalizeServiceError(error, "Unable to delete post.");
    }
  },

  async toggleLike(
    postId: string
  ): Promise<{ liked: boolean; like_count: number }> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("toggle_post_like", {
      p_post_id: postId,
    });
    if (error) {
      throw normalizeServiceError(error, "Unable to update reaction.");
    }
    const row = Array.isArray(data) ? data[0] : data;
    return {
      liked: Boolean(row?.liked),
      like_count: Number(row?.like_count ?? 0),
    };
  },

  async fetchComments(postId: string): Promise<EnrichedPostComment[]> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("post_comments")
      .select("*")
      .eq("post_id", postId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) {
      throw normalizeServiceError(error, "Unable to load comments.");
    }

    const comments = (data ?? []) as PostCommentRow[];
    const authorIds = Array.from(new Set(comments.map((c) => c.author_id)));
    if (authorIds.length === 0) return [];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", authorIds);

    const profileMap = new Map(
      ((profiles ?? []) as Profile[]).map((p) => [p.id, p])
    );
    await primeAvatarSignedUrls(
      Array.from(profileMap.values()).map((p) => p.avatar_url)
    );

    return comments.map((c) => {
      const pr = profileMap.get(c.author_id);
      return {
        ...c,
        author_username: pr?.username || "member",
        author_display_name: pr?.display_name || "ASTERIAL User",
        author_avatar_url: pr?.avatar_url ?? null,
      };
    });
  },

  async addComment(params: {
    postId: string;
    authorId: string;
    body: string;
    parentCommentId?: string | null;
  }): Promise<PostCommentRow> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("post_comments")
      .insert({
        post_id: params.postId,
        author_id: params.authorId,
        body: params.body.trim(),
        parent_comment_id: params.parentCommentId ?? null,
      })
      .select("*")
      .single();

    if (error || !data) {
      throw normalizeServiceError(error, "Unable to post comment.");
    }
    return data as PostCommentRow;
  },

  async deleteComment(commentId: string): Promise<void> {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from("post_comments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", commentId);
    if (error) {
      throw normalizeServiceError(error, "Unable to delete comment.");
    }
  },
};
