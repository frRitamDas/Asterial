"use client";

import type {
  FeedPostSearchResult,
  MomentSearchResult,
} from "@asterial/core";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { primeAvatarSignedUrls } from "@/lib/supabase/storage";
import type {
  ConversationSummary,
  MessageSearchResult,
  UserSearchResult,
} from "@/lib/types/database";
import { normalizeServiceError } from "./errors";

export interface UnifiedSearchResults {
  users: UserSearchResult[];
  conversations: ConversationSummary[];
  groups: ConversationSummary[];
  messages: MessageSearchResult[];
  moments: MomentSearchResult[];
  posts: FeedPostSearchResult[];
}

export const searchService = {
  async searchMessages(
    query: string,
    conversationId?: string | null,
    limit = 25
  ): Promise<MessageSearchResult[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("search_messages", {
      p_query: trimmed,
      p_conversation_id: conversationId ?? null,
      p_limit: limit,
    });
    if (error) {
      throw normalizeServiceError(error, "Unable to search messages.");
    }
    return (data ?? []) as MessageSearchResult[];
  },

  async unifiedSearch(params: {
    query: string;
    localConversations: ConversationSummary[];
    limitPerSection?: number;
  }): Promise<UnifiedSearchResults> {
    const q = params.query.trim();
    const qLower = q.toLowerCase();
    const limit = params.limitPerSection ?? 12;

    if (q.length < 2) {
      return {
        users: [],
        conversations: [],
        groups: [],
        messages: [],
        moments: [],
        posts: [],
      };
    }

    const supabase = getSupabaseBrowserClient();

    const [usersRes, messagesRes, momentsRes, postsRes] = await Promise.all([
      supabase.rpc("search_users", { p_query: q, p_limit: limit }),
      supabase.rpc("search_messages", {
        p_query: q,
        p_conversation_id: null,
        p_limit: limit,
      }),
      supabase.rpc("search_moments", { p_query: q, p_limit: limit }),
      supabase.rpc("search_feed_posts", { p_query: q, p_limit: limit }),
    ]);

    if (usersRes.error) {
      throw normalizeServiceError(usersRes.error, "Search failed.");
    }

    const users = (usersRes.data ?? []) as UserSearchResult[];
    const messages = (messagesRes.data ?? []) as MessageSearchResult[];
    const moments = (momentsRes.data ?? []) as MomentSearchResult[];
    const posts = (postsRes.data ?? []) as FeedPostSearchResult[];

    const matchedConversations = params.localConversations.filter(
      (c) =>
        c.conversation.type === "direct" &&
        (c.displayTitle.toLowerCase().includes(qLower) ||
          c.displaySubtitle.toLowerCase().includes(qLower) ||
          (c.conversation.last_message_preview || "")
            .toLowerCase()
            .includes(qLower))
    );

    const matchedGroups = params.localConversations.filter(
      (c) =>
        c.conversation.type === "group" &&
        (c.displayTitle.toLowerCase().includes(qLower) ||
          c.conversation.description.toLowerCase().includes(qLower))
    );

    await primeAvatarSignedUrls([
      ...users.map((u) => u.avatar_url),
      ...moments.map((m) => m.author_avatar_url),
      ...posts.map((p) => p.author_avatar_url),
    ]);

    return {
      users,
      conversations: matchedConversations.slice(0, limit),
      groups: matchedGroups.slice(0, limit),
      messages,
      moments,
      posts,
    };
  },
};
