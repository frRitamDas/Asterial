"use client";

import type {
  CloseOrbitContactItem,
  CloseOrbitRow,
  CloseOrbitTier,
  OrbitChannelRow,
  OrbitMemberRow,
  OrbitMessageRow,
  OrbitRow,
  OrbitVisibility,
} from "@asterial/core";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { primeAvatarSignedUrls, primeBucketSignedUrls } from "@/lib/supabase/storage";
import type { Profile } from "@/lib/types/database";
import { normalizeServiceError } from "./errors";

export interface EnrichedOrbitMember extends OrbitMemberRow {
  profile: Profile | null;
}

export interface EnrichedOrbitMessage extends OrbitMessageRow {
  senderProfile: Profile | null;
}

export const orbitsService = {
  // =========================================================================
  // 1. Personal Close-Connections Orbits (strict owner-isolated close_orbits)
  // =========================================================================

  async fetchMyCloseOrbit(): Promise<CloseOrbitContactItem[]> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("get_my_close_orbit");
    if (error) {
      throw normalizeServiceError(error, "Unable to load your Close Orbit.");
    }
    const items = (data ?? []) as CloseOrbitContactItem[];
    await primeAvatarSignedUrls(items.map((c) => c.avatar_url));
    return items;
  },

  async upsertCloseOrbitContact(params: {
    contactId: string;
    tier: CloseOrbitTier;
    note?: string;
  }): Promise<CloseOrbitRow> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("upsert_close_orbit_contact", {
      p_contact_id: params.contactId,
      p_tier: params.tier,
      p_note: params.note?.trim() ?? "",
    });
    if (error || !data) {
      throw normalizeServiceError(
        error,
        "Unable to save contact to Close Orbit."
      );
    }
    return data as CloseOrbitRow;
  },

  async removeCloseOrbitContact(contactId: string): Promise<boolean> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("remove_close_orbit_contact", {
      p_contact_id: contactId,
    });
    if (error) {
      throw normalizeServiceError(
        error,
        "Unable to remove contact from Close Orbit."
      );
    }
    return Boolean(data);
  },

  // =========================================================================
  // 2. Community Orbit Spaces (channels, memberships, moderation)
  // =========================================================================

  async fetchCommunityOrbits(userId: string): Promise<{
    orbits: OrbitRow[];
    myMemberships: Map<string, OrbitMemberRow>;
  }> {
    const supabase = getSupabaseBrowserClient();
    const [orbitsRes, membershipsRes] = await Promise.all([
      supabase
        .from("orbits")
        .select("*")
        .is("deleted_at", null)
        .order("member_count", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.from("orbit_members").select("*").eq("user_id", userId),
    ]);

    if (orbitsRes.error) {
      throw normalizeServiceError(
        orbitsRes.error,
        "Unable to load community spaces."
      );
    }

    const orbits = (orbitsRes.data ?? []) as OrbitRow[];
    const memberships = (membershipsRes.data ?? []) as OrbitMemberRow[];
    await primeAvatarSignedUrls(orbits.map((o) => o.icon_url));

    return {
      orbits,
      myMemberships: new Map(memberships.map((m) => [m.orbit_id, m])),
    };
  },

  async fetchOrbitChannels(orbitId: string): Promise<OrbitChannelRow[]> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("orbit_channels")
      .select("*")
      .eq("orbit_id", orbitId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      throw normalizeServiceError(error, "Unable to load channels.");
    }
    return (data ?? []) as OrbitChannelRow[];
  },

  async fetchOrbitMembers(orbitId: string): Promise<EnrichedOrbitMember[]> {
    const supabase = getSupabaseBrowserClient();
    const { data: membersData, error } = await supabase
      .from("orbit_members")
      .select("*")
      .eq("orbit_id", orbitId)
      .in("status", ["active", "invited", "banned"])
      .order("joined_at", { ascending: true });

    if (error) {
      throw normalizeServiceError(error, "Unable to load space members.");
    }

    const members = (membersData ?? []) as OrbitMemberRow[];
    const userIds = members.map((m) => m.user_id);
    if (userIds.length === 0) return [];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", userIds);

    const profileMap = new Map(
      ((profiles ?? []) as Profile[]).map((p) => [p.id, p])
    );
    await primeAvatarSignedUrls(
      Array.from(profileMap.values()).map((p) => p.avatar_url)
    );

    return members.map((m) => ({
      ...m,
      profile: profileMap.get(m.user_id) ?? null,
    }));
  },

  async fetchChannelMessages(
    channelId: string,
    limit = 40
  ): Promise<EnrichedOrbitMessage[]> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("get_orbit_messages_page", {
      p_channel_id: channelId,
      p_before_created_at: null,
      p_before_id: null,
      p_limit: limit,
    });

    if (error) {
      throw normalizeServiceError(error, "Unable to load channel messages.");
    }

    const rows = ((data ?? []) as OrbitMessageRow[]).reverse();
    const senderIds = Array.from(
      new Set(rows.map((r) => r.sender_id).filter((id): id is string => Boolean(id)))
    );

    const profileMap = new Map<string, Profile>();
    if (senderIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("id", senderIds);
      for (const p of (profiles ?? []) as Profile[]) {
        profileMap.set(p.id, p);
      }
    }

    await Promise.all([
      primeAvatarSignedUrls(
        Array.from(profileMap.values()).map((p) => p.avatar_url)
      ),
      primeBucketSignedUrls(
        "social-media",
        rows.map((r) => r.attachment_path)
      ),
    ]);

    return rows.map((row) => ({
      ...row,
      senderProfile: row.sender_id ? profileMap.get(row.sender_id) ?? null : null,
    }));
  },

  async createOrbit(params: {
    name: string;
    slug: string;
    description: string;
    visibility: OrbitVisibility;
    iconUrl?: string | null;
  }): Promise<string> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("create_orbit", {
      p_name: params.name.trim(),
      p_slug: params.slug.trim().toLowerCase(),
      p_description: params.description.trim(),
      p_visibility: params.visibility,
      p_icon_url: params.iconUrl ?? null,
    });
    if (error || !data) {
      throw normalizeServiceError(error, "Unable to create community space.");
    }
    return data as string;
  },

  async joinOrbit(orbitId: string): Promise<void> {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("join_orbit", {
      p_orbit_id: orbitId,
    });
    if (error) {
      throw normalizeServiceError(error, "Unable to join space.");
    }
  },

  async leaveOrbit(orbitId: string): Promise<void> {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("leave_orbit", {
      p_orbit_id: orbitId,
    });
    if (error) {
      throw normalizeServiceError(error, "Unable to leave space.");
    }
  },

  async createChannel(params: {
    orbitId: string;
    name: string;
    topic: string;
    isAnnouncement: boolean;
  }): Promise<string> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("create_orbit_channel", {
      p_orbit_id: params.orbitId,
      p_name: params.name.trim(),
      p_topic: params.topic.trim(),
      p_is_announcement: params.isAnnouncement,
    });
    if (error || !data) {
      throw normalizeServiceError(error, "Unable to create channel.");
    }
    return data as string;
  },

  async sendChannelMessage(params: {
    orbitId: string;
    channelId: string;
    senderId: string;
    body: string;
    attachment?: {
      storagePath: string;
      fileName: string;
      mimeType: string;
      byteSize: number;
    } | null;
  }): Promise<OrbitMessageRow> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("orbit_messages")
      .insert({
        orbit_id: params.orbitId,
        channel_id: params.channelId,
        sender_id: params.senderId,
        client_id: crypto.randomUUID(),
        kind: "user",
        body: params.body.trim(),
        attachment_path: params.attachment?.storagePath ?? null,
        attachment_name: params.attachment?.fileName ?? null,
        attachment_mime: params.attachment?.mimeType ?? null,
        attachment_size: params.attachment?.byteSize ?? null,
      })
      .select("*")
      .single();

    if (error || !data) {
      throw normalizeServiceError(error, "Unable to post message.");
    }
    return data as OrbitMessageRow;
  },

  async deleteChannelMessage(messageId: string): Promise<void> {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("delete_orbit_message", {
      p_message_id: messageId,
    });
    if (error) {
      throw normalizeServiceError(error, "Unable to delete message.");
    }
  },

  async moderateMember(params: {
    orbitId: string;
    targetUserId: string;
    action: "set_role" | "kick" | "ban" | "unban";
    newRole?: "admin" | "member";
  }): Promise<void> {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("moderate_orbit_member", {
      p_orbit_id: params.orbitId,
      p_target_user_id: params.targetUserId,
      p_action: params.action,
      p_new_role: params.newRole ?? "member",
    });
    if (error) {
      throw normalizeServiceError(error, "Moderation action failed.");
    }
  },
};
