import type {
  ConversationSummary,
  MemberRole,
  MessageReactionRow,
  MessageReceiptRow,
  OutgoingDeliveryState,
} from "../types/database";
import { parseSemver } from "../version/semver";

export type InboxFilterKind =
  | "all"
  | "unread"
  | "direct"
  | "groups"
  | "archived";

export interface AggregatedReaction {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

/**
 * Computes outgoing message state while enforcing mutual read-receipt privacy:
 * if either the recipient withheld read_at OR the viewing sender disabled
 * read_receipts_enabled, status caps at "delivered" instead of "read".
 */
export function computeOutgoingDeliveryState(params: {
  optimisticState?: "sending" | "failed";
  receipts: readonly MessageReceiptRow[];
  senderId: string | null | undefined;
  viewerReadReceiptsEnabled: boolean;
}): OutgoingDeliveryState {
  if (params.optimisticState === "sending") return "sending";
  if (params.optimisticState === "failed") return "failed";

  const peerReceipts = params.receipts.filter(
    (r) => r.user_id !== params.senderId
  );
  if (peerReceipts.length === 0) return "sent";

  if (
    params.viewerReadReceiptsEnabled &&
    peerReceipts.some((r) => Boolean(r.read_at))
  ) {
    return "read";
  }

  return "delivered";
}

export function sortConversationSummaries(
  items: readonly ConversationSummary[]
): ConversationSummary[] {
  return [...items].sort((a, b) => {
    if (a.membership.pinned !== b.membership.pinned) {
      return a.membership.pinned ? -1 : 1;
    }
    if (a.membership.pinned && b.membership.pinned) {
      const pinA = a.membership.pinned_at
        ? new Date(a.membership.pinned_at).getTime()
        : 0;
      const pinB = b.membership.pinned_at
        ? new Date(b.membership.pinned_at).getTime()
        : 0;
      if (pinA !== pinB) return pinB - pinA;
    }
    const timeA = new Date(
      a.conversation.last_message_at || a.conversation.created_at
    ).getTime();
    const timeB = new Date(
      b.conversation.last_message_at || b.conversation.created_at
    ).getTime();
    return timeB - timeA;
  });
}

export function filterConversationSummaries(
  items: readonly ConversationSummary[],
  filter: InboxFilterKind,
  query: string
): ConversationSummary[] {
  const q = query.trim().toLowerCase();
  return items.filter((item) => {
    if (filter === "archived") {
      if (!item.membership.archived) return false;
    } else {
      if (item.membership.archived) return false;
      if (filter === "unread" && item.membership.unread_count <= 0) {
        return false;
      }
      if (filter === "direct" && item.conversation.type !== "direct") {
        return false;
      }
      if (filter === "groups" && item.conversation.type !== "group") {
        return false;
      }
    }

    if (!q) return true;
    return (
      item.displayTitle.toLowerCase().includes(q) ||
      item.displaySubtitle.toLowerCase().includes(q) ||
      (item.conversation.last_message_preview || "").toLowerCase().includes(q)
    );
  });
}

export function groupReactionsByEmoji(
  reactions: readonly MessageReactionRow[],
  currentUserId: string | null | undefined
): AggregatedReaction[] {
  const map = new Map<string, { count: number; reactedByMe: boolean }>();
  for (const r of reactions) {
    const entry = map.get(r.emoji) || { count: 0, reactedByMe: false };
    entry.count += 1;
    if (currentUserId && r.user_id === currentUserId) {
      entry.reactedByMe = true;
    }
    map.set(r.emoji, entry);
  }
  return Array.from(map.entries()).map(([emoji, meta]) => ({
    emoji,
    count: meta.count,
    reactedByMe: meta.reactedByMe,
  }));
}

export function canManageGroupSettings(role: MemberRole | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

export function canActorRemoveGroupMember(
  actorRole: MemberRole | null | undefined,
  targetRole: MemberRole | null | undefined,
  isSelf: boolean
): boolean {
  if (isSelf) return false;
  if (actorRole !== "owner" && actorRole !== "admin") return false;
  if (!targetRole || targetRole === "owner") return false;
  if (actorRole === "admin" && targetRole === "admin") return false;
  return true;
}

/**
 * Validates that a Git release tag (e.g. "v1.3.0") is strict canonical semver
 * and matches the centralized version in version.json ("1.3.0").
 */
export function validateReleaseTagParity(
  gitTag: string,
  manifestVersion: string
): { ok: true; normalizedVersion: string } | { ok: false; error: string } {
  const cleanTag = gitTag.trim().replace(/^refs\/tags\//, "");
  if (!/^v\d+\.\d+\.\d+$/.test(cleanTag)) {
    return {
      ok: false,
      error: `Release tag "${cleanTag}" must follow canonical vMAJOR.MINOR.PATCH format (e.g. v1.3.0).`,
    };
  }
  const tagVer = cleanTag.slice(1);
  if (!parseSemver(tagVer)) {
    return { ok: false, error: `Invalid semantic version in tag "${cleanTag}".` };
  }
  if (tagVer !== manifestVersion.trim()) {
    return {
      ok: false,
      error: `Tag "${cleanTag}" does not match version.json (${manifestVersion}).`,
    };
  }
  return { ok: true, normalizedVersion: tagVer };
}
