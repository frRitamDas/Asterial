"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { primeAvatarSignedUrls } from "@/lib/supabase/storage";
import type {
  Profile,
  ReportCategory,
  UserBlockRow,
  UserSearchResult,
} from "@/lib/types/database";
import { normalizeServiceError } from "./errors";

export interface BlockedUserDetail extends UserBlockRow {
  profile: Profile | null;
}

export const contactsService = {
  async searchUsers(query = "", limit = 30): Promise<UserSearchResult[]> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("search_users", {
      p_query: query.trim(),
      p_limit: limit,
    });
    if (error) {
      throw normalizeServiceError(error, "Unable to search directory.");
    }
    const items = (data ?? []) as UserSearchResult[];
    await primeAvatarSignedUrls(items.map((u) => u.avatar_url));
    return items;
  },

  async fetchBlockedUsers(userId: string): Promise<BlockedUserDetail[]> {
    const supabase = getSupabaseBrowserClient();
    const { data: blocks, error } = await supabase
      .from("user_blocks")
      .select("*")
      .eq("blocker_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw normalizeServiceError(error, "Unable to load blocked users.");
    }

    const rows = (blocks ?? []) as UserBlockRow[];
    const ids = rows.map((b) => b.blocked_id);
    if (ids.length === 0) return [];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", ids);

    const profileMap = new Map(
      ((profiles ?? []) as Profile[]).map((p) => [p.id, p])
    );

    await primeAvatarSignedUrls(
      Array.from(profileMap.values()).map((p) => p.avatar_url)
    );

    return rows.map((row) => ({
      ...row,
      profile: profileMap.get(row.blocked_id) ?? null,
    }));
  },

  async blockUser(params: {
    blockerId: string;
    blockedId: string;
    reason?: string;
  }): Promise<void> {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from("user_blocks").upsert(
      {
        blocker_id: params.blockerId,
        blocked_id: params.blockedId,
        reason: params.reason ?? "",
      },
      { onConflict: "blocker_id,blocked_id" }
    );
    if (error) {
      throw normalizeServiceError(error, "Unable to block user.");
    }
  },

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from("user_blocks")
      .delete()
      .eq("blocker_id", blockerId)
      .eq("blocked_id", blockedId);
    if (error) {
      throw normalizeServiceError(error, "Unable to unblock user.");
    }
  },

  async submitReport(params: {
    reporterId: string;
    reportedUserId?: string | null;
    conversationId?: string | null;
    messageId?: string | null;
    orbitId?: string | null;
    postId?: string | null;
    momentId?: string | null;
    category: ReportCategory;
    details: string;
  }): Promise<void> {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from("reports").insert({
      reporter_id: params.reporterId,
      reported_user_id: params.reportedUserId ?? null,
      conversation_id: params.conversationId ?? null,
      message_id: params.messageId ?? null,
      orbit_id: params.orbitId ?? null,
      post_id: params.postId ?? null,
      moment_id: params.momentId ?? null,
      category: params.category,
      details: params.details.trim().slice(0, 1000),
    });
    if (error) {
      throw normalizeServiceError(error, "Unable to submit report.");
    }
  },

  async submitSocialReport(params: {
    reporterId: string;
    targetType: "orbit" | "orbit_message" | "moment" | "post" | "post_comment";
    targetId: string;
    reportedUserId?: string | null;
    category: ReportCategory;
    details: string;
  }): Promise<void> {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from("social_reports").insert({
      reporter_id: params.reporterId,
      target_type: params.targetType,
      target_id: params.targetId,
      reported_user_id: params.reportedUserId ?? null,
      category: params.category,
      details: params.details.trim(),
    });
    if (error) {
      throw normalizeServiceError(error, "Unable to submit report.");
    }
  },
};
