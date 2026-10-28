export type PresenceVisibility = "everyone" | "contacts" | "nobody";
export type AllowDirectMessages = "everyone" | "none";
export type AppearanceTheme = "obsidian" | "pitch" | "graphite" | "alabaster";
export type MessageDensity = "compact" | "comfortable";
export type ConversationType = "direct" | "group";
export type MemberRole = "owner" | "admin" | "member";
export type MessageKind = "user" | "system";
export type ReportCategory =
  | "spam"
  | "harassment"
  | "impersonation"
  | "illegal_content"
  | "other";

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string;
  status_text: string;
  presence_visibility: PresenceVisibility;
  read_receipts_enabled: boolean;
  allow_direct_messages: AllowDirectMessages;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferences {
  user_id: string;
  in_app_enabled: boolean;
  browser_enabled: boolean;
  sound_enabled: boolean;
  message_preview: boolean;
  dm_notifications: boolean;
  group_notifications: boolean;
  appearance_theme: AppearanceTheme;
  message_density: MessageDensity;
  reduced_motion: boolean;
  updated_at: string;
}

export interface ConversationRow {
  id: string;
  type: ConversationType;
  direct_pair_key: string | null;
  name: string | null;
  description: string;
  avatar_url: string | null;
  created_by: string | null;
  last_message_id: string | null;
  last_message_preview: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationMemberRow {
  conversation_id: string;
  user_id: string;
  role: MemberRole;
  pinned: boolean;
  pinned_at: string | null;
  is_muted: boolean;
  archived: boolean;
  archived_at: string | null;
  last_read_message_id: string | null;
  last_read_at: string;
  unread_count: number;
  joined_at: string;
  left_at: string | null;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  client_id: string | null;
  kind: MessageKind;
  body: string;
  reply_to_id: string | null;
  has_attachments: boolean;
  edited_at: string | null;
  deleted_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AttachmentRow {
  id: string;
  message_id: string;
  conversation_id: string;
  uploader_id: string;
  storage_bucket: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  byte_size: number;
  width: number | null;
  height: number | null;
  created_at: string;
}

export interface MessageReceiptRow {
  message_id: string;
  user_id: string;
  conversation_id: string;
  delivered_at: string;
  read_at: string | null;
}

export interface MessageReactionRow {
  message_id: string;
  conversation_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface UserBlockRow {
  blocker_id: string;
  blocked_id: string;
  reason: string;
  created_at: string;
}

export interface UserSearchResult {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string;
  status_text: string;
  allow_direct_messages: AllowDirectMessages;
  last_seen_at: string | null;
  is_blocked_by_me: boolean;
}

export interface MessageSearchResult {
  message_id: string;
  conversation_id: string;
  conversation_type: ConversationType;
  conversation_name: string | null;
  sender_id: string | null;
  sender_display_name: string | null;
  sender_username: string | null;
  body: string;
  created_at: string;
}

export interface GroupMemberDetail extends ConversationMemberRow {
  profile: Profile;
  last_seen_at: string | null;
}

export interface ConversationSummary {
  conversation: ConversationRow;
  membership: ConversationMemberRow;
  peerProfile: Profile | null;
  peerLastSeenAt: string | null;
  memberCount: number;
  displayTitle: string;
  displaySubtitle: string;
  displayAvatarPath: string | null;
}

export type OutgoingDeliveryState =
  | "sending"
  | "failed"
  | "sent"
  | "delivered"
  | "read";

export interface EnrichedMessage extends MessageRow {
  senderProfile: Profile | null;
  replyToMessage: {
    id: string;
    senderDisplayName: string;
    body: string;
    deleted: boolean;
    hasAttachments: boolean;
  } | null;
  attachments: AttachmentRow[];
  reactions: MessageReactionRow[];
  receipts: MessageReceiptRow[];
  optimisticState?: "sending" | "failed";
  optimisticError?: string;
}
