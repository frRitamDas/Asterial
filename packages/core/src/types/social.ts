/**
 * Phase 2+ Social Networking Domain Contracts (Shared across Next.js Web & React Native Android).
 *
 * NOTE: These interfaces define the target data contracts for Phase 2+ additive
 * Supabase migrations (follows, posts, media, likes, comments, bookmarks,
 * social notifications, and push device tokens). No destructive or premature
 * production schema changes are applied in Phase 1.
 */

export type AccountVisibility = "public" | "private";
export type FollowStatus = "accepted" | "pending";
export type PostVisibility = "public" | "followers";
export type SocialNotificationKind =
  | "follow"
  | "follow_request"
  | "follow_accepted"
  | "post_like"
  | "post_comment"
  | "post_reply"
  | "post_mention";
export type DevicePlatform = "android" | "ios" | "web";

export interface FollowRelationshipRow {
  follower_id: string;
  following_id: string;
  status: FollowStatus;
  created_at: string;
  responded_at: string | null;
}

export interface PostRow {
  id: string;
  author_id: string;
  body: string;
  visibility: PostVisibility;
  reply_to_post_id: string | null;
  repost_of_post_id: string | null;
  has_media: boolean;
  like_count: number;
  comment_count: number;
  repost_count: number;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostMediaRow {
  id: string;
  post_id: string;
  uploader_id: string;
  storage_bucket: "post-media";
  storage_path: string;
  mime_type: string;
  byte_size: number;
  width: number | null;
  height: number | null;
  alt_text: string;
  sort_order: number;
  created_at: string;
}

export interface PostLikeRow {
  post_id: string;
  user_id: string;
  created_at: string;
}

export interface PostBookmarkRow {
  post_id: string;
  user_id: string;
  created_at: string;
}

export interface PostCommentRow {
  id: string;
  post_id: string;
  author_id: string;
  parent_comment_id: string | null;
  body: string;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SocialNotificationRow {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  kind: SocialNotificationKind;
  post_id: string | null;
  comment_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface PushDeviceTokenRow {
  id: string;
  user_id: string;
  platform: DevicePlatform;
  token: string;
  device_label: string;
  last_active_at: string;
  created_at: string;
}
