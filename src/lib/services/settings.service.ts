"use client";

import { ASTERIAL_BRAND } from "@/lib/constants/brand";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  AccentColor,
  AllowDirectMessages,
  AppearanceTheme,
  ChatWallpaper,
  MessageDensity,
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
      supabase.from("close_orbits").select("*").eq("owner_id", userId),
      supabase
        .from("conversation_members")
        .select(
          "conversation_id, role, pinned, is_muted, archived, joined_at, left_at"
        )
        .eq("user_id", userId),
      supabase
        .from("moments")
        .select(
          "id, caption, audience, duration_hours, view_count, created_at, expires_at, deleted_at"
        )
        .eq("author_id", userId)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("posts")
        .select(
          "id, body, visibility, like_count, comment_count, created_at, edited_at, deleted_at"
        )
        .eq("author_id", userId)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    if (profileRes.error) {
      throw normalizeServiceError(
        profileRes.error,
        "Unable to export account archive."
      );
    }

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
      throw normalizeServiceError(
        error,
        "Unable to delete account right now."
      );
    }
    await supabase.auth.signOut().catch(() => undefined);
  },
};
