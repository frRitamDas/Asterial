"use client";

import type {
  ActiveMomentItem,
  MomentAudience,
  MomentDurationHours,
  MomentRow,
  MomentTone,
} from "@asterial/core";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { primeAvatarSignedUrls, primeBucketSignedUrls } from "@/lib/supabase/storage";
import type { Profile } from "@/lib/types/database";
import { normalizeServiceError } from "./errors";

export interface MomentViewerDetail {
  viewer_id: string;
  viewed_at: string;
  profile: Profile | null;
}

export const momentsService = {
  async fetchActiveMoments(limit = 45): Promise<ActiveMomentItem[]> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("get_active_moments", {
      p_limit: limit,
    });
    if (error) {
      throw normalizeServiceError(error, "Unable to load active Moments.");
    }
    const items = (data ?? []) as ActiveMomentItem[];
    await Promise.all([
      primeAvatarSignedUrls(items.map((m) => m.author_avatar_url)),
      primeBucketSignedUrls(
        "social-media",
        items.map((m) => m.media_path)
      ),
    ]);
    return items;
  },

  async createMoment(params: {
    authorId: string;
    caption: string;
    backgroundTone: MomentTone;
    audience: MomentAudience;
    durationHours: MomentDurationHours;
    media?: {
      storagePath: string;
      mimeType: string;
      width: number | null;
      height: number | null;
    } | null;
  }): Promise<MomentRow> {
    const supabase = getSupabaseBrowserClient();
    const expiresAt = new Date(
      Date.now() + params.durationHours * 3600 * 1000
    ).toISOString();

    const { data, error } = await supabase
      .from("moments")
      .insert({
        author_id: params.authorId,
        caption: params.caption.trim(),
        background_tone: params.backgroundTone,
        audience: params.audience,
        duration_hours: params.durationHours,
        expires_at: expiresAt,
        media_path: params.media?.storagePath ?? null,
        media_mime: params.media?.mimeType ?? null,
        media_width: params.media?.width ?? null,
        media_height: params.media?.height ?? null,
      })
      .select("*")
      .single();

    if (error || !data) {
      throw normalizeServiceError(error, "Unable to publish Moment.");
    }
    return data as MomentRow;
  },

  async recordView(momentId: string): Promise<void> {
    const supabase = getSupabaseBrowserClient();
    await supabase.rpc("record_moment_view", { p_moment_id: momentId });
  },

  async deleteMoment(momentId: string): Promise<void> {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from("moments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", momentId);
    if (error) {
      throw normalizeServiceError(error, "Unable to delete Moment.");
    }
  },

  async fetchMomentViewers(momentId: string): Promise<MomentViewerDetail[]> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("moment_views")
      .select("viewer_id, viewed_at")
      .eq("moment_id", momentId)
      .order("viewed_at", { ascending: false });

    if (error) {
      throw normalizeServiceError(error, "Unable to load Moment viewers.");
    }

    const rows = (data ?? []) as Array<{ viewer_id: string; viewed_at: string }>;
    const ids = rows.map((r) => r.viewer_id);
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

    return rows.map((r) => ({
      ...r,
      profile: profileMap.get(r.viewer_id) ?? null,
    }));
  },
};
