/**
 * ASTERIAL v1.4.0 Shared Social, Community (Orbits) & Temporary Updates (Moments) Contracts
 * Shared across Next.js Web and Dedicated React Native Android.
 */

export type OrbitVisibility = "public" | "private";
export type OrbitRole = "owner" | "admin" | "member";
export type OrbitMemberStatus = "active" | "invited" | "banned" | "left";

export interface OrbitRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon_url: string | null;
  visibility: OrbitVisibility;
  created_by: string | null;
  member_count: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrbitMemberRow {
  orbit_id: string;
  user_id: string;
  role: OrbitRole;
  status: OrbitMemberStatus;
  joined_at: string;
  updated_at: string;
}

export interface OrbitChannelRow {
  id: string;
  orbit_id: string;
  slug: string;
  name: string;
  topic: string;
  is_announcement: boolean;
  sort_order: number;
  last_message_preview: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrbitMessageRow {
  id: string;
  orbit_id: string;
  channel_id: string;
  sender_id: string | null;
  client_id: string | null;
  kind: "user" | "system";
  body: string;
  reply_to_id: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_mime: string | null;
  attachment_size: number | null;
  edited_at: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
}

export type MomentTone = "obsidian" | "graphite" | "slate" | "ivory";
export type MomentAudience = "everyone" | "contacts";
export type MomentDurationHours = 6 | 12 | 24 | 48;

export interface MomentRow {
  id: string;
  author_id: string;
  caption: string;
  background_tone: MomentTone;
  media_path: string | null;
  media_mime: string | null;
  media_width: number | null;
  media_height: number | null;
  audience: MomentAudience;
  duration_hours: MomentDurationHours;
  view_count: number;
  created_at: string;
  expires_at: string;
  deleted_at: string | null;
}

export interface ActiveMomentItem {
  id: string;
  author_id: string;
  author_username: string;
  author_display_name: string;
  author_avatar_url: string | null;
  caption: string;
  background_tone: MomentTone;
  media_path: string | null;
  media_mime: string | null;
  media_width: number | null;
  media_height: number | null;
  audience: MomentAudience;
  duration_hours: number;
  view_count: number;
  viewer_has_viewed: boolean;
  created_at: string;
  expires_at: string;
}

export type PostVisibility = "public" | "contacts";
export type FeedScope = "all" | "contacts";

export interface PostRow {
  id: string;
  author_id: string;
  body: string;
  visibility: PostVisibility;
  media_path: string | null;
  media_mime: string | null;
  media_name: string | null;
  media_size: number | null;
  media_width: number | null;
  media_height: number | null;
  like_count: number;
  comment_count: number;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeedPostItem {
  id: string;
  author_id: string;
  author_username: string;
  author_display_name: string;
  author_avatar_url: string | null;
  body: string;
  visibility: PostVisibility;
  media_path: string | null;
  media_mime: string | null;
  media_name: string | null;
  media_size: number | null;
  media_width: number | null;
  media_height: number | null;
  like_count: number;
  comment_count: number;
  viewer_has_liked: boolean;
  edited_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostCommentRow {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EnrichedPostComment extends PostCommentRow {
  author_username: string;
  author_display_name: string;
  author_avatar_url: string | null;
}

export function formatMomentTimeRemaining(
  expiresAtIso: string,
  nowMs = Date.now()
): string {
  const diffMs = new Date(expiresAtIso).getTime() - nowMs;
  if (!Number.isFinite(diffMs) || diffMs <= 0) return "Expired";
  const totalMinutes = Math.ceil(diffMs / 60_000);
  if (totalMinutes < 60) return `${totalMinutes}m left`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins > 0 ? `${hours}h ${mins}m left` : `${hours}h left`;
}

export function canModerateOrbit(role: OrbitRole | null | undefined): boolean {
  return role === "owner" || role === "admin";
}
