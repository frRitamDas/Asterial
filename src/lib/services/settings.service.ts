"use client";

import { ASTERIAL_BRAND } from "@/lib/constants/brand";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  AccentColor,
  AllowDirectMessages,
  AppearanceTheme,
  ChatWallpaper,
  GroupInvitePermission,
  MediaAutoDownload,
  MessageDensity,
  MomentsDefaultAudience,
  NotificationPreferences,
  PresenceVisibility,
  Profile,
} from "@/lib/types/database";
import { normalizeServiceError } from "./errors";

export interface AccountDataExport {
  exportedAt: string;
  application: string;
  version: string;
  userId: string;
  email: string | null;
  profile: Profile | null;
  preferences: NotificationPreferences | null;
  closeOrbit: unknown[];
  conversations: unknown[];
  authoredMoments: unknown[];
  authoredPosts: unknown[];
}

export interface StorageRecentUploadItem {
  id: string;
  source: "chat" | "feed";
  conversation_id: string | null;
  file_name: string;
  mime_type: string;
  byte_size: number;
  storage_path: string;
  bucket: "chat-attachments" | "social-media";
  created_at: string;
}

export interface UserStorageSummary {
  chat_attachment_count: number;
  chat_attachment_bytes: number;
  feed_media_count: number;
  feed_media_bytes: number;
  orbit_media_count: number;
  orbit_media_bytes: number;
  active_moment_media_count: number;
  total_tracked_bytes: number;
  recent_uploads: StorageRecentUploadItem[];
}

export const settingsService = {
  async updateProfile(
    userId: string,
    updates: Partial<
      Pick<
        Profile,
        | "username"
        | "display_name"
        | "bio"
        | "status_text"
        | "avatar_url"
        | "presence_visibility"
        | "read_receipts_enabled"
        | "allow_direct_messages"
        | "moments_default_audience"
        | "group_invite_permission"
        | "discoverable_by_search"
        | "onboarding_completed"
      >
    >
  ): Promise<Profile> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId)
      .select("*")
      .single();

    if (error || !data) {
      throw normalizeServiceError(error, "Unable to save profile changes.");
    }
    return data as Profile;
  },

  async updatePrivacy(
    userId: string,
    updates: {
      presence_visibility?: PresenceVisibility;
      read_receipts_enabled?: boolean;
      allow_direct_messages?: AllowDirectMessages;
      moments_default_audience?: MomentsDefaultAudience;
      group_invite_permission?: GroupInvitePermission;
      discoverable_by_search?: boolean;
    }
  ): Promise<Profile> {
    return settingsService.updateProfile(userId, updates);
  },

  async upsertPreferences(
    userId: string,
    updates: Partial<{
      in_app_enabled: boolean;
      browser_enabled: boolean;
      sound_enabled: boolean;
      message_preview: boolean;
      dm_notifications: boolean;
      group_notifications: boolean;
      appearance_theme: AppearanceTheme;
      accent_color: AccentColor;
      chat_wallpaper: ChatWallpaper;
      message_density: MessageDensity;
      reduced_motion: boolean;
      enter_to_send: boolean;
      show_link_previews: boolean;
      media_auto_download: MediaAutoDownload;
      keep_chats_archived: boolean;
    }>
  ): Promise<NotificationPreferences> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("notification_preferences")
      .upsert(
        {
          user_id: userId,
          ...updates,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select("*")
      .single();

    if (error || !data) {
      throw normalizeServiceError(error, "Unable to save preferences.");
    }
    return data as NotificationPreferences;
  },

  async getMyStorageSummary(): Promise<UserStorageSummary> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("get_my_storage_summary");
    if (error || !data) {
      throw normalizeServiceError(
        error,
        "Unable to fetch server storage summary."
      );
    }
    const raw = data as Partial<UserStorageSummary>;
    return {
      chat_attachment_count: Number(raw.chat_attachment_count ?? 0),
      chat_attachment_bytes: Number(raw.chat_attachment_bytes ?? 0),
      feed_media_count: Number(raw.feed_media_count ?? 0),
      feed_media_bytes: Number(raw.feed_media_bytes ?? 0),
      orbit_media_count: Number(raw.orbit_media_count ?? 0),
      orbit_media_bytes: Number(raw.orbit_media_bytes ?? 0),
      active_moment_media_count: Number(raw.active_moment_media_count ?? 0),
      total_tracked_bytes: Number(raw.total_tracked_bytes ?? 0),
      recent_uploads: Array.isArray(raw.recent_uploads)
        ? (raw.recent_uploads as StorageRecentUploadItem[])
        : [],
    };
  },

  async exportMyAccountData(
    userId: string,
    email: string | null
  ): Promise<AccountDataExport> {
    const supabase = getSupabaseBrowserClient();
    const [
      profileRes,
      prefsRes,
      closeOrbitRes,
      membershipsRes,
      momentsRes,
      postsRes,
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase.rpc("get_my_close_orbit"),
      supabase
        .from("conversation_members")
        .select("conversation_id, role, pinned, is_muted, archived, joined_at")
        .eq("user_id", userId)
        .is("left_at", null),
      supabase
        .from("moments")
        .select("id, caption, audience, created_at, expires_at")
        .eq("author_id", userId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("posts")
        .select("id, body, visibility, like_count, comment_count, created_at")
        .eq("author_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      application: ASTERIAL_BRAND.name,
      version: ASTERIAL_BRAND.version,
      userId,
      email,
      profile: (profileRes.data as Profile | null) ?? null,
      preferences: (prefsRes.data as NotificationPreferences | null) ?? null,
      closeOrbit: closeOrbitRes.data ?? [],
      conversations: membershipsRes.data ?? [],
      authoredMoments: momentsRes.data ?? [],
      authoredPosts: postsRes.data ?? [],
    };
  },

  async deleteOwnAccount(): Promise<void> {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("delete_own_account");
    if (error) {
      throw normalizeServiceError(error, "Unable to delete account.");
    }
    await supabase.auth.signOut().catch(() => undefined);
  },
};
