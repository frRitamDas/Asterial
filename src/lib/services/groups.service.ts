"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { primeAvatarSignedUrls } from "@/lib/supabase/storage";
import type {
  ConversationMemberRow,
  GroupMemberDetail,
  MemberRole,
  Profile,
} from "@/lib/types/database";
import { normalizeServiceError } from "./errors";

export const groupsService = {
  async createGroup(params: {
    name: string;
    description: string;
    memberIds: string[];
    avatarUrl?: string | null;
  }): Promise<string> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("create_group_conversation", {
      p_name: params.name.trim(),
      p_description: params.description.trim(),
      p_member_ids: params.memberIds,
      p_avatar_url: params.avatarUrl ?? null,
    });

    if (error || !data) {
      throw normalizeServiceError(error, "Unable to create group.");
    }

    return data as string;
  },

  async updateGroupDetails(params: {
    conversationId: string;
    name: string;
    description: string;
    avatarUrl?: string | null;
  }): Promise<void> {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("update_group_details", {
      p_conversation_id: params.conversationId,
      p_name: params.name.trim(),
      p_description: params.description.trim(),
      p_avatar_url: params.avatarUrl ?? null,
    });

    if (error) {
      throw normalizeServiceError(error, "Unable to update group details.");
    }
  },

  async fetchGroupMembers(conversationId: string): Promise<GroupMemberDetail[]> {
    const supabase = getSupabaseBrowserClient();
    const { data: memberRows, error } = await supabase
      .from("conversation_members")
      .select("*")
      .eq("conversation_id", conversationId)
      .is("left_at", null)
      .order("joined_at", { ascending: true });

    if (error) {
      throw normalizeServiceError(error, "Unable to load group members.");
    }

    const members = (memberRows ?? []) as ConversationMemberRow[];
    const userIds = members.map((m) => m.user_id);
    if (userIds.length === 0) return [];

    const [profilesRes, presenceRes] = await Promise.all([
      supabase.from("profiles").select("*").in("id", userIds),
      supabase
        .from("user_presence_state")
        .select("user_id, last_seen_at")
        .in("user_id", userIds),
    ]);

    const profileMap = new Map(
      ((profilesRes.data ?? []) as Profile[]).map((p) => [p.id, p])
    );
    const presenceMap = new Map(
      (
        (presenceRes.data ?? []) as Array<{
          user_id: string;
          last_seen_at: string;
        }>
      ).map((pr) => [pr.user_id, pr.last_seen_at])
    );

    await primeAvatarSignedUrls(
      Array.from(profileMap.values()).map((p) => p.avatar_url)
    );

    const roleOrder: Record<MemberRole, number> = {
      owner: 0,
      admin: 1,
      member: 2,
    };

    return members
      .filter((m) => profileMap.has(m.user_id))
      .map((m) => ({
        ...m,
        profile: profileMap.get(m.user_id)!,
        last_seen_at: presenceMap.get(m.user_id) ?? null,
      }))
      .sort((a, b) => roleOrder[a.role] - roleOrder[b.role]);
  },

  async addMembers(conversationId: string, userIds: string[]): Promise<number> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("add_group_members", {
      p_conversation_id: conversationId,
      p_member_ids: userIds,
    });
    if (error) {
      throw normalizeServiceError(error, "Unable to add group members.");
    }
    return Number(data ?? 0);
  },

  async updateMemberRole(
    conversationId: string,
    targetUserId: string,
    newRole: "admin" | "member"
  ): Promise<void> {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("update_group_member_role", {
      p_conversation_id: conversationId,
      p_target_user_id: targetUserId,
      p_new_role: newRole,
    });
    if (error) {
      throw normalizeServiceError(error, "Unable to update member role.");
    }
  },

  async removeMember(
    conversationId: string,
    targetUserId: string
  ): Promise<void> {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("remove_group_member", {
      p_conversation_id: conversationId,
      p_target_user_id: targetUserId,
    });
    if (error) {
      throw normalizeServiceError(error, "Unable to remove group member.");
    }
  },

  async leaveGroup(conversationId: string): Promise<void> {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("leave_group_conversation", {
      p_conversation_id: conversationId,
    });
    if (error) {
      throw normalizeServiceError(error, "Unable to leave group.");
    }
  },
};
