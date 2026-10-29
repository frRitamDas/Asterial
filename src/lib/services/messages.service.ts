"use client";

import { MESSAGES_PAGE_SIZE } from "@/lib/constants/brand";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { primeAvatarSignedUrls, primeBucketSignedUrls } from "@/lib/supabase/storage";
import type {
  AttachmentRow,
  EnrichedMessage,
  MessageReactionRow,
  MessageReceiptRow,
  MessageRow,
  Profile,
} from "@/lib/types/database";
import { normalizeServiceError } from "./errors";

export interface MessagesPageResult {
  messages: EnrichedMessage[];
  hasOlder: boolean;
}

async function enrichMessageRows(rows: MessageRow[]): Promise<EnrichedMessage[]> {
  if (rows.length === 0) return [];
  const supabase = getSupabaseBrowserClient();

  const messageIds = rows.map((m) => m.id);
  const replyIds = Array.from(
    new Set(
      rows
        .map((m) => m.reply_to_id)
        .filter((id): id is string => Boolean(id))
    )
  );
  const senderIds = Array.from(
    new Set(
      rows
        .map((m) => m.sender_id)
        .filter((id): id is string => Boolean(id))
    )
  );

  const [attachmentsRes, reactionsRes, receiptsRes, repliesRes, profilesRes] =
    await Promise.all([
      supabase.from("attachments").select("*").in("message_id", messageIds),
      supabase
        .from("message_reactions")
        .select("*")
        .in("message_id", messageIds),
      supabase
        .from("message_receipts")
        .select("*")
        .in("message_id", messageIds),
      replyIds.length > 0
        ? supabase
            .from("messages")
            .select("id, sender_id, body, deleted_at, has_attachments")
            .in("id", replyIds)
        : Promise.resolve({ data: [] }),
      senderIds.length > 0
        ? supabase.from("profiles").select("*").in("id", senderIds)
        : Promise.resolve({ data: [] }),
    ]);

  const replyRows = (repliesRes.data ?? []) as Array<{
    id: string;
    sender_id: string | null;
    body: string;
    deleted_at: string | null;
    has_attachments: boolean;
  }>;

  const missingReplySenderIds = Array.from(
    new Set(
      replyRows
        .map((r) => r.sender_id)
        .filter(
          (id): id is string =>
            Boolean(id) && !senderIds.includes(id as string)
        )
    )
  );

  let extraProfiles: Profile[] = [];
  if (missingReplySenderIds.length > 0) {
    const extraRes = await supabase
      .from("profiles")
      .select("*")
      .in("id", missingReplySenderIds);
    extraProfiles = (extraRes.data ?? []) as Profile[];
  }

  const profileMap = new Map<string, Profile>();
  for (const p of [...((profilesRes.data ?? []) as Profile[]), ...extraProfiles]) {
    profileMap.set(p.id, p);
  }

  const attachmentsByMsg = new Map<string, AttachmentRow[]>();
  const attachmentPaths: string[] = [];
  for (const att of (attachmentsRes.data ?? []) as AttachmentRow[]) {
    const list = attachmentsByMsg.get(att.message_id) ?? [];
    list.push(att);
    attachmentsByMsg.set(att.message_id, list);
    attachmentPaths.push(att.storage_path);
  }

  const reactionsByMsg = new Map<string, MessageReactionRow[]>();
  for (const r of (reactionsRes.data ?? []) as MessageReactionRow[]) {
    const list = reactionsByMsg.get(r.message_id) ?? [];
    list.push(r);
    reactionsByMsg.set(r.message_id, list);
  }

  const receiptsByMsg = new Map<string, MessageReceiptRow[]>();
  for (const rc of (receiptsRes.data ?? []) as MessageReceiptRow[]) {
    const list = receiptsByMsg.get(rc.message_id) ?? [];
    list.push(rc);
    receiptsByMsg.set(rc.message_id, list);
  }

  const replyMap = new Map(replyRows.map((r) => [r.id, r]));

  await Promise.all([
    primeAvatarSignedUrls(
      Array.from(profileMap.values()).map((p) => p.avatar_url)
    ),
    primeBucketSignedUrls("chat-attachments", attachmentPaths),
  ]);

  return rows.map((row) => {
    const senderProfile = row.sender_id
      ? profileMap.get(row.sender_id) ?? null
      : null;
    const rawReply = row.reply_to_id ? replyMap.get(row.reply_to_id) : null;
    const replySender =
      rawReply?.sender_id ? profileMap.get(rawReply.sender_id) : null;

    return {
      ...row,
      senderProfile,
      replyToMessage: rawReply
        ? {
            id: rawReply.id,
            senderDisplayName:
              replySender?.display_name ||
              replySender?.username ||
              "Conversation member",
            body: rawReply.body,
            deleted: Boolean(rawReply.deleted_at),
            hasAttachments: rawReply.has_attachments,
          }
        : null,
      attachments: attachmentsByMsg.get(row.id) ?? [],
      reactions: reactionsByMsg.get(row.id) ?? [],
      receipts: receiptsByMsg.get(row.id) ?? [],
    };
  });
}

export const messagesService = {
  enrichMessageRows,

  async fetchMessagesPage(params: {
    conversationId: string;
    beforeCreatedAt?: string | null;
    beforeId?: string | null;
    pageSize?: number;
  }): Promise<MessagesPageResult> {
    const supabase = getSupabaseBrowserClient();
    const limit = params.pageSize ?? MESSAGES_PAGE_SIZE;

    const { data, error } = await supabase.rpc(
      "get_conversation_messages_page",
      {
        p_conversation_id: params.conversationId,
        p_before_created_at: params.beforeCreatedAt ?? null,
        p_before_id: params.beforeId ?? null,
        p_limit: limit + 1,
      }
    );

    if (error) {
      throw normalizeServiceError(error, "Unable to load messages.");
    }

    const descRows = (data ?? []) as MessageRow[];
    const hasOlder = descRows.length > limit;
    const slicedDesc = hasOlder ? descRows.slice(0, limit) : descRows;
    const chronological = [...slicedDesc].reverse();
    const enriched = await enrichMessageRows(chronological);

    return { messages: enriched, hasOlder };
  },

  async fetchPinnedMessages(conversationId: string): Promise<EnrichedMessage[]> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .is("deleted_at", null)
      .not("pinned_at", "is", null)
      .order("pinned_at", { ascending: false })
      .limit(25);

    if (error) {
      throw normalizeServiceError(error, "Unable to load pinned messages.");
    }

    return enrichMessageRows((data ?? []) as MessageRow[]);
  },

  async sendMessage(params: {
    conversationId: string;
    senderId: string;
    clientId: string;
    body: string;
    replyToId: string | null;
    hasAttachments: boolean;
    attachments?: Array<{
      storagePath: string;
      fileName: string;
      mimeType: string;
      byteSize: number;
      width: number | null;
      height: number | null;
    }>;
  }): Promise<EnrichedMessage> {
    const supabase = getSupabaseBrowserClient();
    const { data: msgData, error: msgError } = await supabase
      .from("messages")
      .insert({
        conversation_id: params.conversationId,
        sender_id: params.senderId,
        client_id: params.clientId,
        kind: "user",
        body: params.body,
        reply_to_id: params.replyToId,
        has_attachments: params.hasAttachments,
      })
      .select("*")
      .single();

    if (msgError || !msgData) {
      throw normalizeServiceError(msgError, "Failed to send message.");
    }

    const row = msgData as MessageRow;

    if (params.attachments && params.attachments.length > 0) {
      const { error: attError } = await supabase.from("attachments").insert(
        params.attachments.map((att) => ({
          message_id: row.id,
          conversation_id: params.conversationId,
          uploader_id: params.senderId,
          storage_bucket: "chat-attachments",
          storage_path: att.storagePath,
          file_name: att.fileName,
          mime_type: att.mimeType,
          byte_size: att.byteSize,
          width: att.width,
          height: att.height,
        }))
      );
      if (attError) {
        throw normalizeServiceError(
          attError,
          "Message created, but attachment metadata failed to save."
        );
      }
    }

    const [enriched] = await enrichMessageRows([row]);
    return enriched;
  },

  async editMessage(messageId: string, nextBody: string): Promise<MessageRow> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("messages")
      .update({ body: nextBody.trim() })
      .eq("id", messageId)
      .select("*")
      .single();

    if (error || !data) {
      throw normalizeServiceError(error, "Unable to edit message.");
    }
    return data as MessageRow;
  },

  async softDeleteMessage(messageId: string): Promise<MessageRow> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("messages")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", messageId)
      .select("*")
      .single();

    if (error || !data) {
      throw normalizeServiceError(error, "Unable to delete message.");
    }
    return data as MessageRow;
  },

  async toggleReaction(params: {
    messageId: string;
    conversationId: string;
    userId: string;
    emoji: string;
    currentlyReacted: boolean;
  }): Promise<void> {
    const supabase = getSupabaseBrowserClient();
    if (params.currentlyReacted) {
      const { error } = await supabase
        .from("message_reactions")
        .delete()
        .eq("message_id", params.messageId)
        .eq("user_id", params.userId)
        .eq("emoji", params.emoji);
      if (error) {
        throw normalizeServiceError(error, "Unable to remove reaction.");
      }
    } else {
      const { error } = await supabase.from("message_reactions").insert({
        message_id: params.messageId,
        conversation_id: params.conversationId,
        user_id: params.userId,
        emoji: params.emoji,
      });
      if (error) {
        throw normalizeServiceError(error, "Unable to add reaction.");
      }
    }
  },

  async togglePin(messageId: string): Promise<{
    pinned: boolean;
    pinned_at: string | null;
    pinned_by: string | null;
  }> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("toggle_message_pin", {
      p_message_id: messageId,
    });
    if (error || !data) {
      throw normalizeServiceError(error, "Unable to update message pin.");
    }
    return data as {
      pinned: boolean;
      pinned_at: string | null;
      pinned_by: string | null;
    };
  },

  async forwardMessage(
    sourceMessageId: string,
    targetConversationIds: string[]
  ): Promise<string[]> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc(
      "forward_message_to_conversations",
      {
        p_source_message_id: sourceMessageId,
        p_target_conversation_ids: targetConversationIds,
      }
    );
    if (error) {
      throw normalizeServiceError(error, "Unable to forward message.");
    }
    return (data ?? []) as string[];
  },
};
