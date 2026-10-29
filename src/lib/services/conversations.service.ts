"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  ConversationMemberRow,
  ConversationRow,
  ConversationSummary,
  NotificationPreferences,
  Profile,
} from "@/lib/types/database";
import { primeAvatarSignedUrls } from "@/lib/supabase/storage";
import { normalizeServiceError } from "./errors";

export interface WorkspaceBootstrapPayload {
  profile: Profile;
  preferences: NotificationPreferences | null;
  conversations: ConversationSummary[];
  blockedIds: Set<string>;
}

export const conversationsService = {
  async fetchWorkspaceBootstrap(userId: string): Promise<WorkspaceBootstrapPayload> {
    const supabase = getSupabaseBrowserClient();

    const [profileRes, prefsRes, membershipsRes, blocksRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("conversation_members")
        .select("*")
        .eq("user_id", userId)
        .is("left_at", null),
      supabase.from("user_blocks").select("blocked_id").eq("blocker_id", userId),
    ]);

    if (profileRes.error || !profileRes.data) {
      throw normalizeServiceError(
        profileRes.error,
        "Unable to load your profile."
      );
    }

    const profile = profileRes.data as Profile;
    const preferences = (prefsRes.data as NotificationPreferences | null) ?? null;
    const blockedIds = new Set(
      ((blocksRes.data ?? []) as Array<{ blocked_id: string }>).map(
        (b) => b.blocked_id
      )
    );

    const myMemberships = (membershipsRes.data ?? []) as ConversationMemberRow[];
    const convIds = myMemberships.map((m) => m.conversation_id);

    if (convIds.length === 0) {
      await primeAvatarSignedUrls([profile.avatar_url]);
      return { profile, preferences, conversations: [], blockedIds };
    }

    const [convsRes, allMembersRes] = await Promise.all([
      supabase.from("conversations").select("*").in("id", convIds),
      supabase
        .from("conversation_members")
        .select("*")
        .in("conversation_id", convIds)
        .is("left_at", null),
    ]);

    if (convsRes.error) {
      throw normalizeServiceError(
        convsRes.error,
        "Unable to load conversations."
      );
    }

    const convRows = (convsRes.data ?? []) as ConversationRow[];
    const allMembers = (allMembersRes.data ?? []) as ConversationMemberRow[];

    const peerUserIds = Array.from(
      new Set(
        allMembers
          .filter((m) => m.user_id !== userId)
          .map((m) => m.user_id)
      )
    );

    const peerProfileMap = new Map<string, Profile>();
    const peerPresenceMap = new Map<string, string>();

    if (peerUserIds.length > 0) {
      const [peerProfilesRes, presenceRes] = await Promise.all([
        supabase.from("profiles").select("*").in("id", peerUserIds),
        supabase
          .from("user_presence_state")
          .select("user_id, last_seen_at")
          .in("user_id", peerUserIds),
      ]);

      for (const p of (peerProfilesRes.data ?? []) as Profile[]) {
        peerProfileMap.set(p.id, p);
      }
      for (const pr of (presenceRes.data ?? []) as Array<{
        user_id: string;
        last_seen_at: string;
      }>) {
        peerPresenceMap.set(pr.user_id, pr.last_seen_at);
      }
    }

    const myMembershipByConv = new Map(
      myMemberships.map((m) => [m.conversation_id, m])
    );
    const membersByConv = new Map<string, ConversationMemberRow[]>();
    for (const m of allMembers) {
      const list = membersByConv.get(m.conversation_id) ?? [];
      list.push(m);
      membersByConv.set(m.conversation_id, list);
    }

    const summaries: ConversationSummary[] = [];
    const avatarPaths: Array<string | null | undefined> = [profile.avatar_url];

    for (const conv of convRows) {
      const membership = myMembershipByConv.get(conv.id);
      if (!membership) continue;
      const members = membersByConv.get(conv.id) ?? [membership];

      if (conv.type === "direct") {
        const peerMember = members.find((m) => m.user_id !== userId);
        const peerProfile = peerMember
          ? peerProfileMap.get(peerMember.user_id) ?? null
          : null;
        const peerLastSeenAt = peerProfile
          ? peerPresenceMap.get(peerProfile.id) ?? null
          : null;
        const displayTitle =
          peerProfile?.display_name || peerProfile?.username || "Direct chat";
        const displaySubtitle = peerProfile
          ? `@${peerProfile.username}`
          : "Direct conversation";
        const displayAvatarPath = peerProfile?.avatar_url ?? null;
        avatarPaths.push(displayAvatarPath);

        summaries.push({
          conversation: conv,
          membership,
          peerProfile,
          peerLastSeenAt,
          memberCount: members.length,
          displayTitle,
          displaySubtitle,
          displayAvatarPath,
        });
      } else {
        avatarPaths.push(conv.avatar_url);
        summaries.push({
          conversation: conv,
          membership,
          peerProfile: null,
          peerLastSeenAt: null,
          memberCount: members.length,
          displayTitle: conv.name || "Untitled Group",
          displaySubtitle: `${members.length} ${
            members.length === 1 ? "member" : "members"
          }`,
          displayAvatarPath: conv.avatar_url,
        });
      }
    }

    summaries.sort((a, b) => {
      if (a.membership.pinned !== b.membership.pinned) {
        return a.membership.pinned ? -1 : 1;
      }
      const aTime = a.conversation.last_message_at || a.conversation.created_at;
      const bTime = b.conversation.last_message_at || b.conversation.created_at;
      return bTime.localeCompare(aTime);
    });

    await primeAvatarSignedUrls(avatarPaths);

    return {
      profile,
      preferences,
      conversations: summaries,
      blockedIds,
    };
  },

  async createOrGetDirectConversation(targetUserId: string): Promise<string> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc(
      "create_or_get_direct_conversation",
      { p_target_user_id: targetUserId }
    );
    if (error || !data) {
      throw normalizeServiceError(
        error,
        "Unable to start direct conversation."
      );
    }
    return data as string;
  },

  async setPinned(
    conversationId: string,
    userId: string,
    pinned: boolean
  ): Promise<void> {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from("conversation_members")
      .update({
        pinned,
        pinned_at: pinned ? new Date().toISOString() : null,
      })
      .eq("conversation_id", conversationId)
      .eq("user_id", userId);
    if (error) {
      throw normalizeServiceError(error, "Unable to update pin state.");
    }
  },

  async setMuted(
    conversationId: string,
    userId: string,
    isMuted: boolean
  ): Promise<void> {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from("conversation_members")
      .update({ is_muted: isMuted })
      .eq("conversation_id", conversationId)
      .eq("user_id", userId);
    if (error) {
      throw normalizeServiceError(error, "Unable to update mute setting.");
    }
  },

  async setArchived(
    conversationId: string,
    userId: string,
    archived: boolean
  ): Promise<void> {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from("conversation_members")
      .update({
        archived,
        archived_at: archived ? new Date().toISOString() : null,
      })
      .eq("conversation_id", conversationId)
      .eq("user_id", userId);
    if (error) {
      throw normalizeServiceError(error, "Unable to update archive state.");
    }
  },

  async markDelivered(conversationId: string | null = null): Promise<void> {
    const supabase = getSupabaseBrowserClient();
    await supabase.rpc("acknowledge_delivery", {
      p_conversation_id: conversationId,
    });
  },

  async markRead(conversationId: string): Promise<void> {
    const supabase = getSupabaseBrowserClient();
    await supabase.rpc("mark_conversation_read", {
      p_conversation_id: conversationId,
    });
  },

  async heartbeatPresence(): Promise<void> {
    const supabase = getSupabaseBrowserClient();
    await supabase.rpc("touch_presence");
  },
};
