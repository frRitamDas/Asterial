"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  Check,
  CheckCheck,
  Clock,
  Copy,
  CornerUpLeft,
  CornerUpRight,
  Edit2,
  Flag,
  History,
  Info,
  Loader2,
  Lock,
  Orbit,
  Pin,
  PinOff,
  RotateCcw,
  Search,
  SmilePlus,
  Trash2,
  X,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { primeAvatarSignedUrls } from "@/lib/supabase/storage";
import { messagesService } from "@/lib/services";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { AttachmentMedia } from "@/components/chat/AttachmentMedia";
import { MessageComposer } from "@/components/chat/MessageComposer";
import { ConversationInfoDrawer } from "@/components/chat/ConversationInfoDrawer";
import {
  MESSAGES_PAGE_SIZE,
  QUICK_REACTION_EMOJIS,
} from "@/lib/constants/brand";
import {
  formatDateDivider,
  formatLastSeen,
  formatMessageTimestamp,
  formatShortTime,
} from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type {
  AttachmentRow,
  ConversationMemberRow,
  EnrichedMessage,
  GroupMemberDetail,
  MessageReactionRow,
  MessageReceiptRow,
  MessageRow,
  MessageSearchResult,
  OutgoingDeliveryState,
  Profile,
} from "@/lib/types/database";

interface ConversationViewProps {
  conversationId: string;
}

export function ConversationView({ conversationId }: ConversationViewProps) {
  const searchParams = useSearchParams();
  const highlightMessageId = searchParams.get("highlight");
  const {
    user,
    profile,
    conversations,
    onlineUserIds,
    closeOrbitMap,
    drafts,
    setDraft,
    setForwardingMessage,
    markConversationRead,
    refreshConversations,
    isBlockedByMe,
    openReportModal,
  } = useWorkspace();
  const { pushToast } = useToast();

  const timelineRef = useRef<HTMLDivElement | null>(null);
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);
  const channelRef = useRef<ReturnType<
    ReturnType<typeof getSupabaseBrowserClient>["channel"]
  > | null>(null);
  const lastTypingSentRef = useRef<number>(0);
  const profilesCacheRef = useRef<Map<string, Profile>>(new Map());

  const [messages, setMessages] = useState<EnrichedMessage[]>([]);
  const [members, setMembers] = useState<GroupMemberDetail[]>([]);
  const [sharedAttachments, setSharedAttachments] = useState<AttachmentRow[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const [infoOpen, setInfoOpen] = useState(false);
  const [inChatSearchOpen, setInChatSearchOpen] = useState(false);
  const [inChatQuery, setInChatQuery] = useState("");
  const [inChatSearchPayload, setInChatSearchPayload] = useState<{
    query: string;
    results: MessageSearchResult[];
  } | null>(null);

  const userId = user?.id ?? null;

  const [replyTo, setReplyTo] = useState<{
    id: string;
    senderDisplayName: string;
    body: string;
    hasAttachments: boolean;
  } | null>(null);

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState<string | null>(
    null
  );
  const [typingUsers, setTypingUsers] = useState<
    Map<string, { name: string; expiresAt: number }>
  >(new Map());
  const [blockedBetweenPeer, setBlockedBetweenPeer] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [initialUnreadCutoff] = useState<string | null>(() => {
    const match = conversations.find(
      (c) => c.conversation.id === conversationId
    );
    if (match && match.membership.unread_count > 0) {
      return match.membership.last_read_at;
    }
    return null;
  });

  const summary = useMemo(
    () =>
      conversations.find((c) => c.conversation.id === conversationId) || null,
    [conversationId, conversations]
  );

  // Hydrate raw MessageRow[] into EnrichedMessage[]
  const enrichMessageBatch = useCallback(
    async (rawRows: MessageRow[]): Promise<EnrichedMessage[]> => {
      if (rawRows.length === 0) return [];
      const supabase = getSupabaseBrowserClient();

      const msgIds = rawRows.map((m) => m.id);
      const replyIds = Array.from(
        new Set(
          rawRows
            .map((m) => m.reply_to_id)
            .filter((id): id is string => Boolean(id))
        )
      );
      const senderIds = Array.from(
        new Set(
          rawRows
            .map((m) => m.sender_id)
            .filter(
              (id): id is string =>
                Boolean(id) && !profilesCacheRef.current.has(id!)
            )
        )
      );

      const [attRes, reactRes, rcptRes, sendersRes, repliesRes] =
        await Promise.all([
          supabase.from("attachments").select("*").in("message_id", msgIds),
          supabase
            .from("message_reactions")
            .select("*")
            .in("message_id", msgIds),
          supabase
            .from("message_receipts")
            .select("*")
            .in("message_id", msgIds),
          senderIds.length > 0
            ? supabase.from("profiles").select("*").in("id", senderIds)
            : Promise.resolve({ data: [] }),
          replyIds.length > 0
            ? supabase
                .from("messages")
                .select("id,sender_id,body,deleted_at,has_attachments")
                .in("id", replyIds)
            : Promise.resolve({ data: [] }),
        ]);

      for (const p of (sendersRes.data || []) as Profile[]) {
        profilesCacheRef.current.set(p.id, p);
      }

      // Ensure reply authors are also in profile cache
      const replyRows = (repliesRes.data || []) as Array<{
        id: string;
        sender_id: string | null;
        body: string;
        deleted_at: string | null;
        has_attachments: boolean;
      }>;
      const missingReplySenders = Array.from(
        new Set(
          replyRows
            .map((r) => r.sender_id)
            .filter(
              (id): id is string =>
                Boolean(id) && !profilesCacheRef.current.has(id!)
            )
        )
      );
      if (missingReplySenders.length > 0) {
        const { data: extraProfs } = await supabase
          .from("profiles")
          .select("*")
          .in("id", missingReplySenders);
        for (const p of (extraProfs || []) as Profile[]) {
          profilesCacheRef.current.set(p.id, p);
        }
      }

      void primeAvatarSignedUrls(
        Array.from(profilesCacheRef.current.values()).map((p) => p.avatar_url)
      );

      const attByMsg = new Map<string, AttachmentRow[]>();
      for (const a of (attRes.data || []) as AttachmentRow[]) {
        const arr = attByMsg.get(a.message_id) || [];
        arr.push(a);
        attByMsg.set(a.message_id, arr);
      }

      const reactByMsg = new Map<string, MessageReactionRow[]>();
      for (const r of (reactRes.data || []) as MessageReactionRow[]) {
        const arr = reactByMsg.get(r.message_id) || [];
        arr.push(r);
        reactByMsg.set(r.message_id, arr);
      }

      const rcptByMsg = new Map<string, MessageReceiptRow[]>();
      for (const rc of (rcptRes.data || []) as MessageReceiptRow[]) {
        const arr = rcptByMsg.get(rc.message_id) || [];
        arr.push(rc);
        rcptByMsg.set(rc.message_id, arr);
      }

      const replyMap = new Map(replyRows.map((r) => [r.id, r]));

      return rawRows.map((row) => {
        const senderProfile = row.sender_id
          ? profilesCacheRef.current.get(row.sender_id) || null
          : null;
        const replyTarget = row.reply_to_id
          ? replyMap.get(row.reply_to_id)
          : undefined;
        const replyAuthor = replyTarget?.sender_id
          ? profilesCacheRef.current.get(replyTarget.sender_id)
          : null;

        return {
          ...row,
          senderProfile,
          replyToMessage: replyTarget
            ? {
                id: replyTarget.id,
                senderDisplayName: replyAuthor?.display_name || "Member",
                body: replyTarget.deleted_at ? "Message deleted" : replyTarget.body,
                deleted: Boolean(replyTarget.deleted_at),
                hasAttachments: replyTarget.has_attachments,
              }
            : null,
          attachments: attByMsg.get(row.id) || [],
          reactions: reactByMsg.get(row.id) || [],
          receipts: rcptByMsg.get(row.id) || [],
        };
      });
    },
    []
  );

  const fetchConversationMeta = useCallback(async () => {
    if (!userId) return;
    const supabase = getSupabaseBrowserClient();

    const [membersRes, sharedAttRes] = await Promise.all([
      supabase
        .from("conversation_members")
        .select("*")
        .eq("conversation_id", conversationId)
        .is("left_at", null)
        .order("joined_at", { ascending: true }),
      supabase
        .from("attachments")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(24),
    ]);

    const memRows = (membersRes.data || []) as ConversationMemberRow[];
    if (memRows.length === 0) {
      setAccessDenied(true);
      return;
    }

    const userIds = memRows.map((m) => m.user_id);
    const [profsRes, presRes] = await Promise.all([
      supabase.from("profiles").select("*").in("id", userIds),
      supabase
        .from("user_presence_state")
        .select("user_id,last_seen_at")
        .in("user_id", userIds),
    ]);

    const profMap = new Map<string, Profile>();
    for (const p of (profsRes.data || []) as Profile[]) {
      profMap.set(p.id, p);
      profilesCacheRef.current.set(p.id, p);
    }
    void primeAvatarSignedUrls(
      Array.from(profMap.values()).map((p) => p.avatar_url)
    );

    const presMap = new Map<string, string>();
    for (const pr of (presRes.data || []) as Array<{
      user_id: string;
      last_seen_at: string;
    }>) {
      presMap.set(pr.user_id, pr.last_seen_at);
    }

    const detailed: GroupMemberDetail[] = memRows
      .filter((m) => profMap.has(m.user_id))
      .map((m) => ({
        ...m,
        profile: profMap.get(m.user_id)!,
        last_seen_at: presMap.get(m.user_id) || null,
      }));

    setMembers(detailed);
    setSharedAttachments((sharedAttRes.data || []) as AttachmentRow[]);

    // Check mutual block state for direct conversation
    const peerMem = detailed.find((m) => m.user_id !== userId);
    if (peerMem) {
      const { data: blocked } = await supabase.rpc("is_blocked_between", {
        p_user_a: userId,
        p_user_b: peerMem.user_id,
      });
      setBlockedBetweenPeer(Boolean(blocked));
    } else {
      setBlockedBetweenPeer(false);
    }
  }, [conversationId, userId]);

  // Initial load of conversation & latest messages
  useEffect(() => {
    if (!user?.id) return;
    let active = true;

    const load = async () => {
      setLoading(true);
      setAccessDenied(false);
      setReplyTo(null);
      setEditingMessageId(null);
      setInChatSearchOpen(false);
      setInChatQuery("");

      const supabase = getSupabaseBrowserClient();

      // Verify membership & conversation readability via RLS
      const { data: convCheck, error: convErr } = await supabase
        .from("conversations")
        .select("id")
        .eq("id", conversationId)
        .maybeSingle();

      if (!active) return;

      if (convErr || !convCheck) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      const [, msgRes] = await Promise.all([
        fetchConversationMeta(),
        supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(MESSAGES_PAGE_SIZE + 1),
      ]);

      if (!active) return;

      const fetched = (msgRes.data || []) as MessageRow[];
      setHasOlderMessages(fetched.length > MESSAGES_PAGE_SIZE);
      const slice = fetched.slice(0, MESSAGES_PAGE_SIZE).reverse();
      const enriched = await enrichMessageBatch(slice);

      if (!active) return;
      setMessages(enriched);
      setLoading(false);

      void markConversationRead(conversationId);

      window.requestAnimationFrame(() => {
        bottomAnchorRef.current?.scrollIntoView({ behavior: "instant" });
      });
    };

    void load();

    return () => {
      active = false;
    };
  }, [
    conversationId,
    enrichMessageBatch,
    fetchConversationMeta,
    markConversationRead,
    user?.id,
  ]);

  // Highlight jumped message from search if present
  useEffect(() => {
    if (!highlightMessageId || loading) return;
    const el = document.getElementById(`msg-${highlightMessageId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightMessageId, loading]);

  // Mark conversation read when tab becomes visible
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible" && !accessDenied) {
        void markConversationRead(conversationId);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [accessDenied, conversationId, markConversationRead]);

  // Expire stale typing indicators cleanly
  useEffect(() => {
    if (typingUsers.size === 0) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [uid, info] of next.entries()) {
          if (info.expiresAt <= now) {
            next.delete(uid);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 800);
    return () => window.clearInterval(timer);
  }, [typingUsers.size]);

  // Realtime subscription for this conversation (Messages, Attachments, Reactions, Receipts, Typing)
  useEffect(() => {
    if (!user?.id || accessDenied) return;
    const supabase = getSupabaseBrowserClient();

    const channel = supabase
      .channel(`asterial:conv:${conversationId}`)
      .on("broadcast", { event: "typing" }, (payload) => {
        const data = payload.payload as {
          userId?: string;
          displayName?: string;
        };
        if (!data?.userId || data.userId === user.id) return;
        setTypingUsers((prev) => {
          const next = new Map(prev);
          next.set(data.userId!, {
            name: data.displayName || "Someone",
            expiresAt: Date.now() + 3500,
          });
          return next;
        });
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const inserted = payload.new as MessageRow;
          // Clear typing state for sender immediately
          if (inserted.sender_id) {
            setTypingUsers((prev) => {
              if (!prev.has(inserted.sender_id!)) return prev;
              const next = new Map(prev);
              next.delete(inserted.sender_id!);
              return next;
            });
          }

          const [hydrated] = await enrichMessageBatch([inserted]);
          if (!hydrated) return;

          setMessages((prev) => {
            if (prev.some((m) => m.id === hydrated.id)) {
              return prev.map((m) => (m.id === hydrated.id ? hydrated : m));
            }
            if (hydrated.client_id) {
              const optIdx = prev.findIndex(
                (m) => m.client_id === hydrated.client_id
              );
              if (optIdx !== -1) {
                const clone = [...prev];
                clone[optIdx] = hydrated;
                return clone;
              }
            }
            return [...prev, hydrated];
          });

          if (
            inserted.sender_id &&
            inserted.sender_id !== user.id &&
            document.visibilityState === "visible"
          ) {
            void markConversationRead(conversationId);
          }

          window.requestAnimationFrame(() => {
            bottomAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const updated = payload.new as MessageRow;
          const [hydrated] = await enrichMessageBatch([updated]);
          if (!hydrated) return;
          setMessages((prev) =>
            prev.map((m) => (m.id === hydrated.id ? hydrated : m))
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "attachments",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const att = payload.new as AttachmentRow;
          setSharedAttachments((prev) =>
            prev.some((a) => a.id === att.id) ? prev : [att, ...prev]
          );
          setMessages((prev) =>
            prev.map((m) =>
              m.id === att.message_id &&
              !m.attachments.some((a) => a.id === att.id)
                ? { ...m, attachments: [...m.attachments, att] }
                : m
            )
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_reactions",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const reaction = payload.new as MessageReactionRow;
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== reaction.message_id) return m;
              const exists = m.reactions.some(
                (r) =>
                  r.user_id === reaction.user_id && r.emoji === reaction.emoji
              );
              return exists
                ? m
                : { ...m, reactions: [...m.reactions, reaction] };
            })
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "message_reactions",
        },
        (payload) => {
          const oldR = payload.old as Partial<MessageReactionRow>;
          if (!oldR.message_id) return;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === oldR.message_id
                ? {
                    ...m,
                    reactions: m.reactions.filter(
                      (r) =>
                        !(
                          r.user_id === oldR.user_id && r.emoji === oldR.emoji
                        )
                    ),
                  }
                : m
            )
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_receipts",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const rcpt = payload.new as MessageReceiptRow | undefined;
          if (!rcpt?.message_id) return;
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== rcpt.message_id) return m;
              const existingIdx = m.receipts.findIndex(
                (r) => r.user_id === rcpt.user_id
              );
              if (existingIdx === -1) {
                return { ...m, receipts: [...m.receipts, rcpt] };
              }
              const nextReceipts = [...m.receipts];
              nextReceipts[existingIdx] = rcpt;
              return { ...m, receipts: nextReceipts };
            })
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_members",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          void fetchConversationMeta();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [
    accessDenied,
    conversationId,
    enrichMessageBatch,
    fetchConversationMeta,
    markConversationRead,
    user?.id,
  ]);

  // In-conversation message search
  const trimmedInChatQuery = inChatQuery.trim();
  useEffect(() => {
    if (!inChatSearchOpen || trimmedInChatQuery.length < 2) {
      return;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.rpc("search_messages", {
        p_query: trimmedInChatQuery,
        p_conversation_id: conversationId,
        p_limit: 20,
      });
      if (active) {
        setInChatSearchPayload({
          query: trimmedInChatQuery,
          results: (data || []) as MessageSearchResult[],
        });
      }
    }, 240);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [conversationId, inChatSearchOpen, trimmedInChatQuery]);

  const searchingInChat =
    inChatSearchOpen &&
    trimmedInChatQuery.length >= 2 &&
    inChatSearchPayload?.query !== trimmedInChatQuery;
  const inChatResults =
    inChatSearchOpen &&
    trimmedInChatQuery.length >= 2 &&
    inChatSearchPayload?.query === trimmedInChatQuery
      ? inChatSearchPayload.results
      : [];

  const handleLoadOlderMessages = async () => {
    if (loadingOlder || !hasOlderMessages || messages.length === 0) return;
    const oldest = messages[0];
    if (!oldest) return;

    const container = timelineRef.current;
    const previousScrollHeight = container?.scrollHeight || 0;

    setLoadingOlder(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: rpcRows, error: rpcErr } = await supabase.rpc(
        "get_conversation_messages_page",
        {
          p_conversation_id: conversationId,
          p_before_created_at: oldest.created_at,
          p_before_id: oldest.id,
          p_limit: MESSAGES_PAGE_SIZE + 1,
        }
      );

      let rows: MessageRow[];
      if (!rpcErr && Array.isArray(rpcRows)) {
        rows = rpcRows as MessageRow[];
      } else {
        const { data } = await supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", conversationId)
          .lt("created_at", oldest.created_at)
          .order("created_at", { ascending: false })
          .limit(MESSAGES_PAGE_SIZE + 1);
        rows = (data || []) as MessageRow[];
      }
      setHasOlderMessages(rows.length > MESSAGES_PAGE_SIZE);
      const batch = rows.slice(0, MESSAGES_PAGE_SIZE).reverse();
      const hydrated = await enrichMessageBatch(batch);

      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const uniqueOlder = hydrated.filter((m) => !existingIds.has(m.id));
        return [...uniqueOlder, ...prev];
      });

      window.requestAnimationFrame(() => {
        if (container) {
          const delta = container.scrollHeight - previousScrollHeight;
          container.scrollTop += delta;
        }
      });
    } finally {
      setLoadingOlder(false);
    }
  };

  const emitTyping = useCallback(() => {
    if (!userId || !profile || !channelRef.current) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 1500) return;
    lastTypingSentRef.current = now;

    void channelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: {
        userId,
        displayName: profile.display_name,
      },
    });
  }, [profile, userId]);

  const executeSend = async (params: {
    clientId: string;
    body: string;
    replyToId: string | null;
    attachments: Array<{
      storagePath: string;
      fileName: string;
      mimeType: string;
      byteSize: number;
      width: number | null;
      height: number | null;
    }>;
  }) => {
    if (!user?.id) return;
    const supabase = getSupabaseBrowserClient();
    const hasAttachments = params.attachments.length > 0;

    const { data: insertedRow, error: msgErr } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        client_id: params.clientId,
        kind: "user",
        body: params.body,
        reply_to_id: params.replyToId,
        has_attachments: hasAttachments,
      })
      .select("*")
      .single();

    if (msgErr || !insertedRow) {
      setMessages((prev) =>
        prev.map((m) =>
          m.client_id === params.clientId
            ? {
                ...m,
                optimisticState: "failed",
                optimisticError: msgErr?.message || "Failed to send message.",
              }
            : m
        )
      );
      return;
    }

    const realMsg = insertedRow as MessageRow;
    let insertedAttachments: AttachmentRow[] = [];

    if (hasAttachments) {
      const { data: attData, error: attErr } = await supabase
        .from("attachments")
        .insert(
          params.attachments.map((a) => ({
            message_id: realMsg.id,
            conversation_id: conversationId,
            uploader_id: user.id,
            storage_bucket: "chat-attachments",
            storage_path: a.storagePath,
            file_name: a.fileName,
            mime_type: a.mimeType,
            byte_size: a.byteSize,
            width: a.width,
            height: a.height,
          }))
        )
        .select("*");

      if (!attErr && attData) {
        insertedAttachments = attData as AttachmentRow[];
        setSharedAttachments((prev) => [...insertedAttachments, ...prev]);
      }
    }

    const [hydrated] = await enrichMessageBatch([realMsg]);
    if (hydrated) {
      const finalMsg: EnrichedMessage = {
        ...hydrated,
        attachments:
          insertedAttachments.length > 0
            ? insertedAttachments
            : hydrated.attachments,
      };
      setMessages((prev) => {
        // Deduplicate if Realtime already delivered it
        const withoutTemp = prev.filter(
          (m) => m.client_id !== params.clientId && m.id !== finalMsg.id
        );
        return [...withoutTemp, finalMsg].sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      });
    }

    void refreshConversations();
  };

  const handleSendMessage = async (params: {
    body: string;
    replyToId: string | null;
    attachments: Array<{
      storagePath: string;
      fileName: string;
      mimeType: string;
      byteSize: number;
      width: number | null;
      height: number | null;
    }>;
  }) => {
    if (!user?.id || !profile) return;
    const clientId = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    const targetReply = params.replyToId
      ? messages.find((m) => m.id === params.replyToId)
      : undefined;

    const optimisticMsg: EnrichedMessage = {
      id: `opt-${clientId}`,
      conversation_id: conversationId,
      sender_id: user.id,
      client_id: clientId,
      kind: "user",
      body: params.body,
      reply_to_id: params.replyToId,
      has_attachments: params.attachments.length > 0,
      edited_at: null,
      deleted_at: null,
      metadata: { pendingAttachments: params.attachments },
      created_at: nowIso,
      updated_at: nowIso,
      senderProfile: profile,
      replyToMessage: targetReply
        ? {
            id: targetReply.id,
            senderDisplayName:
              targetReply.senderProfile?.display_name || "Member",
            body: targetReply.body,
            deleted: Boolean(targetReply.deleted_at),
            hasAttachments: targetReply.has_attachments,
          }
        : null,
      attachments: params.attachments.map((a, idx) => ({
        id: `opt-att-${idx}-${clientId}`,
        message_id: `opt-${clientId}`,
        conversation_id: conversationId,
        uploader_id: user.id,
        storage_bucket: "chat-attachments",
        storage_path: a.storagePath,
        file_name: a.fileName,
        mime_type: a.mimeType,
        byte_size: a.byteSize,
        width: a.width,
        height: a.height,
        created_at: nowIso,
      })),
      reactions: [],
      receipts: [],
      optimisticState: "sending",
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    window.requestAnimationFrame(() => {
      bottomAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
    });

    await executeSend({
      clientId,
      body: params.body,
      replyToId: params.replyToId,
      attachments: params.attachments,
    });
  };

  const handleRetryFailedMessage = async (msg: EnrichedMessage) => {
    if (!msg.client_id) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msg.id
          ? { ...m, optimisticState: "sending", optimisticError: undefined }
          : m
      )
    );
    const pendingAttachments =
      (msg.metadata?.pendingAttachments as Array<{
        storagePath: string;
        fileName: string;
        mimeType: string;
        byteSize: number;
        width: number | null;
        height: number | null;
      }>) || [];

    await executeSend({
      clientId: msg.client_id,
      body: msg.body,
      replyToId: msg.reply_to_id,
      attachments: pendingAttachments,
    });
  };

  const handleSaveEdit = async (msgId: string) => {
    const trimmed = editDraft.trim();
    if (!trimmed) return;
    setSavingEdit(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("messages")
        .update({ body: trimmed })
        .eq("id", msgId);

      if (error) {
        pushToast({
          title: "Could not edit message",
          description: error.message,
          variant: "error",
        });
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? { ...m, body: trimmed, edited_at: new Date().toISOString() }
              : m
          )
        );
        setEditingMessageId(null);
      }
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    const supabase = getSupabaseBrowserClient();
    const targetMsg = messages.find((m) => m.id === msgId);
    const storagePaths = (targetMsg?.attachments || []).map(
      (a) => a.storage_path
    );
    if (storagePaths.length > 0) {
      await supabase.storage
        .from("chat-attachments")
        .remove(storagePaths)
        .catch(() => {});
    }

    const { error } = await supabase
      .from("messages")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", msgId);

    if (error) {
      pushToast({
        title: "Could not delete message",
        description: error.message,
        variant: "error",
      });
    } else {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                body: "",
                has_attachments: false,
                attachments: [],
                deleted_at: new Date().toISOString(),
              }
            : m
        )
      );
      void refreshConversations();
    }
  };

  const handleToggleReaction = async (msg: EnrichedMessage, emoji: string) => {
    if (!user?.id) return;
    setReactionPickerMsgId(null);
    const supabase = getSupabaseBrowserClient();
    const alreadyReacted = msg.reactions.some(
      (r) => r.user_id === user.id && r.emoji === emoji
    );

    if (alreadyReacted) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id
            ? {
                ...m,
                reactions: m.reactions.filter(
                  (r) => !(r.user_id === user.id && r.emoji === emoji)
                ),
              }
            : m
        )
      );
      await supabase
        .from("message_reactions")
        .delete()
        .eq("message_id", msg.id)
        .eq("user_id", user.id)
        .eq("emoji", emoji);
    } else {
      const optimisticReaction: MessageReactionRow = {
        message_id: msg.id,
        conversation_id: conversationId,
        user_id: user.id,
        emoji,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id
            ? { ...m, reactions: [...m.reactions, optimisticReaction] }
            : m
        )
      );
      const { error } = await supabase.from("message_reactions").insert({
        message_id: msg.id,
        conversation_id: conversationId,
        user_id: user.id,
        emoji,
      });
      if (error) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.id
              ? {
                  ...m,
                  reactions: m.reactions.filter(
                    (r) => !(r.user_id === user.id && r.emoji === emoji)
                  ),
                }
              : m
          )
        );
      }
    }
  };

  const handleTogglePinMessage = async (msg: EnrichedMessage) => {
    try {
      const result = await messagesService.togglePin(msg.id);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id
            ? {
                ...m,
                pinned_at: result.pinned_at,
                pinned_by: result.pinned_by,
              }
            : m
        )
      );
      pushToast({
        title: result.pinned ? "Message pinned" : "Message unpinned",
        variant: "success",
      });
    } catch (err) {
      pushToast({
        title: "Could not update message pin",
        description: err instanceof Error ? err.message : "Permission denied.",
        variant: "error",
      });
    }
  };

  const computeOutgoingState = (msg: EnrichedMessage): OutgoingDeliveryState => {
    if (msg.optimisticState === "sending") return "sending";
    if (msg.optimisticState === "failed") return "failed";
    const peerReceipts = msg.receipts.filter((r) => r.user_id !== user?.id);
    if (peerReceipts.length === 0) return "sent";
    const shareReads = profile?.read_receipts_enabled !== false;
    if (shareReads && peerReceipts.some((r) => Boolean(r.read_at))) {
      return "read";
    }
    return "delivered";
  };

  const pinnedMessages = useMemo(
    () =>
      messages
        .filter((m) => Boolean(m.pinned_at) && !m.deleted_at)
        .sort((a, b) => (b.pinned_at || "").localeCompare(a.pinned_at || "")),
    [messages]
  );
  const latestPinned = pinnedMessages[0] ?? null;

  const firstUnreadMessageId = useMemo(() => {
    if (!initialUnreadCutoff) return null;
    const cutoffMs = new Date(initialUnreadCutoff).getTime();
    const target = messages.find(
      (m) =>
        m.kind === "user" &&
        m.sender_id !== user?.id &&
        new Date(m.created_at).getTime() > cutoffMs
    );
    return target?.id ?? null;
  }, [initialUnreadCutoff, messages, user?.id]);

  if (accessDenied) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.04]">
          <Lock className="h-5 w-5 text-zinc-300" />
        </div>
        <h2 className="mt-4 text-base font-semibold text-white">
          Conversation unavailable
        </h2>
        <p className="mt-1.5 max-w-sm text-xs text-zinc-400 leading-relaxed">
          You do not have active membership in this conversation, or it does not
          exist.
        </p>
        <Link
          href="/app/chats"
          className="mt-5 inline-flex h-9 items-center gap-2 rounded-xl bg-white px-4 text-xs font-medium text-zinc-950 hover:bg-zinc-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to conversations
        </Link>
      </div>
    );
  }

  const isGroup = summary?.conversation.type === "group";
  const myRole = summary?.membership.role;
  const canPinMessages = !isGroup || myRole === "owner" || myRole === "admin";
  const peer = summary?.peerProfile || null;
  const peerOnline = Boolean(peer && onlineUserIds.has(peer.id));
  const peerInOrbit = Boolean(peer && closeOrbitMap.has(peer.id));
  const peerBlockedByMe = Boolean(peer && isBlockedByMe(peer.id));
  const typingNames = Array.from(typingUsers.values()).map((t) => t.name);

  const headerSubtitle =
    typingNames.length > 0
      ? `${typingNames.join(", ")} ${typingNames.length === 1 ? "is" : "are"} typing...`
      : isGroup
        ? `${members.length} ${members.length === 1 ? "member" : "members"}`
        : peerOnline
          ? "Online"
          : formatLastSeen(summary?.peerLastSeenAt);

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden">
      {/* Primary Chat Column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Conversation Header */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-void)] px-3 sm:px-5">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              href="/app/chats"
              aria-label="Back to conversations"
              className="flex md:hidden h-8 w-8 items-center justify-center rounded-lg text-zinc-300 hover:bg-white/[0.06] hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>

            {summary ? (
              <button
                type="button"
                onClick={() => setInfoOpen((prev) => !prev)}
                className="flex items-center gap-3 min-w-0 text-left cursor-pointer group"
              >
                <Avatar
                  name={summary.displayTitle}
                  avatarPath={summary.displayAvatarPath}
                  size="sm"
                  isGroup={isGroup}
                  online={peerOnline}
                  showPresence={!isGroup}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)] group-hover:underline underline-offset-4">
                      {summary.displayTitle}
                    </p>
                    {peerInOrbit && (
                      <Orbit
                        className="h-3.5 w-3.5 shrink-0 text-[var(--accent-primary)]"
                        aria-label="In your Close Orbit"
                      />
                    )}
                  </div>
                  <p
                    className={cn(
                      "truncate text-[11px]",
                      typingNames.length > 0
                        ? "text-[var(--accent-primary)] font-medium"
                        : "text-[var(--text-muted)]"
                    )}
                  >
                    {headerSubtitle}
                  </p>
                </div>
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-2.5 w-20" />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setInChatSearchOpen((prev) => !prev)}
              title="Search in conversation"
              aria-label="Search in conversation"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition-colors cursor-pointer",
                inChatSearchOpen
                  ? "bg-white text-zinc-950"
                  : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
              )}
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setInfoOpen((prev) => !prev)}
              title="Toggle conversation info"
              aria-label="Toggle conversation info"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition-colors cursor-pointer",
                infoOpen
                  ? "bg-white text-zinc-950"
                  : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
              )}
            >
              <Info className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Collapsible In-Conversation Search Bar */}
        {inChatSearchOpen && (
          <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2.5 animate-asterial-in">
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
              <input
                type="search"
                value={inChatQuery}
                onChange={(e) => setInChatQuery(e.target.value)}
                placeholder="Search messages in this thread..."
                autoFocus
                className="flex-1 bg-transparent text-xs text-white placeholder:text-zinc-500 focus:outline-none"
              />
              {searchingInChat && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />
              )}
              <button
                type="button"
                onClick={() => {
                  setInChatSearchOpen(false);
                  setInChatQuery("");
                }}
                aria-label="Close thread search"
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {inChatQuery.trim().length >= 2 && (
              <div className="mt-2 max-h-40 overflow-y-auto space-y-1 border-t border-white/[0.06] pt-2">
                {inChatResults.length === 0 && !searchingInChat ? (
                  <p className="text-[11px] text-zinc-500 py-1">
                    No matching messages in this thread.
                  </p>
                ) : (
                  inChatResults.map((res) => (
                    <button
                      key={res.message_id}
                      type="button"
                      onClick={() => {
                        const targetEl = document.getElementById(
                          `msg-${res.message_id}`
                        );
                        if (targetEl) {
                          targetEl.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                          });
                        } else {
                          pushToast({
                            title: "Message is earlier in history",
                            description:
                              "Load older messages at the top of the thread to jump to it.",
                          });
                        }
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-white/[0.06] cursor-pointer"
                    >
                      <span className="truncate text-zinc-200">{res.body}</span>
                      <span className="shrink-0 font-mono text-[10px] text-zinc-500">
                        {formatShortTime(res.created_at)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Pinned Message Banner */}
        {latestPinned && (
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-xs">
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById(`msg-${latestPinned.id}`);
                el?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              className="flex min-w-0 flex-1 items-center gap-2.5 text-left cursor-pointer"
            >
              <Pin className="h-3.5 w-3.5 shrink-0 text-[var(--accent-primary)]" />
              <div className="min-w-0">
                <p className="font-semibold text-[11px] text-[var(--accent-primary)]">
                  Pinned message
                  {pinnedMessages.length > 1
                    ? ` (${pinnedMessages.length})`
                    : ""}
                </p>
                <p className="truncate text-xs text-[var(--text-secondary)]">
                  {latestPinned.body || "Pinned attachment"}
                </p>
              </div>
            </button>
            {canPinMessages && (
              <button
                type="button"
                onClick={() => void handleTogglePinMessage(latestPinned)}
                title="Unpin message"
                aria-label="Unpin message"
                className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-white/[0.06] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <PinOff className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Paginated Message Timeline */}
        <div
          ref={timelineRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
            setShowScrollBottom(distance > 260);
          }}
          onClick={() => {
            if (reactionPickerMsgId) setReactionPickerMsgId(null);
          }}
          className="asterial-chat-canvas relative flex-1 overflow-y-auto px-3 py-5 sm:px-6"
        >
          {loading ? (
            <div className="space-y-4 py-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-end gap-2.5",
                    i % 2 === 1 ? "justify-end" : "justify-start"
                  )}
                >
                  {i % 2 === 0 && <Skeleton className="h-7 w-7 rounded-full" />}
                  <Skeleton className="h-12 w-56 rounded-2xl" />
                </div>
              ))}
            </div>
          ) : (
            <div
              className="mx-auto flex max-w-3xl flex-col"
              style={{ gap: "var(--msg-gap)" }}
            >
              {/* Load Older Messages Pagination Control */}
              {hasOlderMessages && (
                <div className="mb-3 flex justify-center">
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={loadingOlder}
                    onClick={() => void handleLoadOlderMessages()}
                  >
                    <History className="h-3.5 w-3.5" />
                    Load older messages
                  </Button>
                </div>
              )}

              {messages.length === 0 ? (
                <div className="my-16 flex flex-col items-center text-center">
                  <p className="text-sm font-medium text-white">
                    Start the conversation
                  </p>
                  <p className="mt-1 max-w-xs text-xs text-zinc-500">
                    Messages in this thread sync in real time across connected
                    sessions.
                  </p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const prevMsg = idx > 0 ? messages[idx - 1] : null;
                  const currentDay = formatDateDivider(msg.created_at);
                  const prevDay = prevMsg
                    ? formatDateDivider(prevMsg.created_at)
                    : null;
                  const showDateDivider = currentDay !== prevDay;

                  if (msg.kind === "system") {
                    return (
                      <React.Fragment key={msg.id}>
                        {showDateDivider && (
                          <div className="my-3 flex items-center justify-center">
                            <span className="rounded-full border border-white/10 bg-[var(--bg-surface)] px-3 py-0.5 font-mono text-[10px] text-zinc-400">
                              {currentDay}
                            </span>
                          </div>
                        )}
                        <div className="my-1.5 flex justify-center">
                          <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1 text-[11px] text-zinc-400">
                            {msg.body}
                          </span>
                        </div>
                      </React.Fragment>
                    );
                  }

                  const isOwn = msg.sender_id === user?.id;
                  const isDeleted = Boolean(msg.deleted_at);
                  const isEditing = editingMessageId === msg.id;
                  const deliveryState = isOwn
                    ? computeOutgoingState(msg)
                    : null;

                  // Group reactions by emoji
                  const reactionGroups = new Map<
                    string,
                    { count: number; reactedByMe: boolean }
                  >();
                  for (const r of msg.reactions) {
                    const existing = reactionGroups.get(r.emoji) || {
                      count: 0,
                      reactedByMe: false,
                    };
                    reactionGroups.set(r.emoji, {
                      count: existing.count + 1,
                      reactedByMe:
                        existing.reactedByMe || r.user_id === user?.id,
                    });
                  }

                  return (
                    <React.Fragment key={msg.id}>
                      {showDateDivider && (
                        <div className="my-3 flex items-center justify-center">
                          <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-0.5 font-mono text-[10px] text-[var(--text-secondary)]">
                            {currentDay}
                          </span>
                        </div>
                      )}

                      {firstUnreadMessageId === msg.id && (
                        <div className="my-3 flex items-center gap-3">
                          <div className="h-px flex-1 bg-[var(--accent-primary)]/35" />
                          <span className="rounded-full border border-[var(--border-active)] bg-[var(--accent-signal-subtle)] px-3 py-0.5 font-mono text-[10px] font-semibold text-[var(--accent-primary)]">
                            Unread messages
                          </span>
                          <div className="h-px flex-1 bg-[var(--accent-primary)]/35" />
                        </div>
                      )}

                      <div
                        id={`msg-${msg.id}`}
                        className={cn(
                          "group relative flex items-end gap-2.5 animate-asterial-in",
                          isOwn ? "justify-end" : "justify-start",
                          highlightMessageId === msg.id
                            ? "rounded-2xl ring-1 ring-white/40 p-1"
                            : ""
                        )}
                      >
                        {!isOwn && (
                          <Avatar
                            name={msg.senderProfile?.display_name || "Member"}
                            avatarPath={msg.senderProfile?.avatar_url}
                            size="xs"
                            className="mb-1"
                          />
                        )}

                        <div
                          className={cn(
                            "flex max-w-[82%] sm:max-w-[70%] flex-col",
                            isOwn ? "items-end" : "items-start"
                          )}
                        >
                          {/* Sender label inside Group Chats */}
                          {isGroup && !isOwn && msg.senderProfile && (
                            <span className="mb-1 ml-1 text-[11px] font-medium text-zinc-400">
                              {msg.senderProfile.display_name}
                            </span>
                          )}

                          <div className="relative flex items-center gap-1.5">
                            {/* Hover Action Toolbar (Left side for own messages) */}
                            {isOwn && !isDeleted && !isEditing && (
                              <MessageActionsToolbar
                                isOwn
                                isPinned={Boolean(msg.pinned_at)}
                                canPin={canPinMessages}
                                onReply={() =>
                                  setReplyTo({
                                    id: msg.id,
                                    senderDisplayName:
                                      msg.senderProfile?.display_name || "You",
                                    body: msg.body,
                                    hasAttachments: msg.has_attachments,
                                  })
                                }
                                onReact={() =>
                                  setReactionPickerMsgId((prev) =>
                                    prev === msg.id ? null : msg.id
                                  )
                                }
                                onForward={() => setForwardingMessage(msg)}
                                onPin={() => void handleTogglePinMessage(msg)}
                                onCopy={() => {
                                  if (msg.body) {
                                    void navigator.clipboard.writeText(msg.body);
                                    pushToast({ title: "Copied message text" });
                                  }
                                }}
                                onEdit={() => {
                                  setEditingMessageId(msg.id);
                                  setEditDraft(msg.body);
                                }}
                                onDelete={() => void handleDeleteMessage(msg.id)}
                                onReport={() => {}}
                              />
                            )}

                            {/* Message Bubble */}
                            <div
                              style={{
                                paddingTop: "var(--bubble-py)",
                                paddingBottom: "var(--bubble-py)",
                                paddingLeft: "var(--bubble-px)",
                                paddingRight: "var(--bubble-px)",
                              }}
                              className={cn(
                                "rounded-2xl text-sm leading-relaxed break-words",
                                isDeleted
                                  ? "border border-white/10 bg-transparent italic text-zinc-500"
                                  : isOwn
                                    ? "rounded-br-sm border border-[var(--bubble-out-border)] bg-[var(--bubble-out-bg)] text-[var(--bubble-out-fg)]"
                                    : "rounded-bl-sm border border-[var(--border-subtle)] bg-[var(--bubble-in-bg)] text-[var(--bubble-in-fg)]"
                              )}
                            >
                              {/* Forwarded Label */}
                              {!isDeleted &&
                                (Boolean(msg.forwarded_from_id) ||
                                  Boolean(msg.metadata?.forwarded)) && (
                                  <div className="mb-1 flex items-center gap-1 text-[11px] font-medium opacity-75">
                                    <CornerUpRight className="h-3 w-3 shrink-0" />
                                    <span>
                                      Forwarded
                                      {typeof msg.metadata?.forwarded_author ===
                                      "string"
                                        ? ` from ${msg.metadata.forwarded_author}`
                                        : ""}
                                    </span>
                                  </div>
                                )}

                              {/* Reply Quote */}
                              {!isDeleted && msg.replyToMessage && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const el = document.getElementById(
                                      `msg-${msg.replyToMessage!.id}`
                                    );
                                    el?.scrollIntoView({
                                      behavior: "smooth",
                                      block: "center",
                                    });
                                  }}
                                  className={cn(
                                    "mb-1.5 block w-full rounded-lg border-l-2 px-2.5 py-1 text-left text-xs cursor-pointer",
                                    isOwn
                                      ? "border-[var(--accent-primary)] bg-black/20 text-[var(--bubble-out-fg)]"
                                      : "border-[var(--accent-primary)] bg-white/[0.05] text-[var(--text-secondary)]"
                                  )}
                                >
                                  <span className="block font-semibold text-[11px]">
                                    {msg.replyToMessage.senderDisplayName}
                                  </span>
                                  <span className="block truncate opacity-80">
                                    {msg.replyToMessage.body ||
                                      (msg.replyToMessage.hasAttachments
                                        ? "Attachment"
                                        : "Message")}
                                  </span>
                                </button>
                              )}

                              {isDeleted ? (
                                <span className="text-xs">Message deleted</span>
                              ) : isEditing ? (
                                <div className="min-w-[220px] space-y-2">
                                  <textarea
                                    value={editDraft}
                                    onChange={(e) => setEditDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Escape") {
                                        setEditingMessageId(null);
                                      } else if (
                                        e.key === "Enter" &&
                                        !e.shiftKey
                                      ) {
                                        e.preventDefault();
                                        void handleSaveEdit(msg.id);
                                      }
                                    }}
                                    rows={2}
                                    autoFocus
                                    className="w-full rounded-lg border border-black/20 bg-white p-2 text-xs text-zinc-950 focus:outline-none"
                                  />
                                  <div className="flex justify-end gap-1.5 text-xs">
                                    <button
                                      type="button"
                                      onClick={() => setEditingMessageId(null)}
                                      className="rounded-md px-2 py-1 text-zinc-700 hover:bg-black/10 cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      disabled={savingEdit}
                                      onClick={() => void handleSaveEdit(msg.id)}
                                      className="rounded-md bg-zinc-950 px-2.5 py-1 text-white hover:bg-zinc-800 cursor-pointer"
                                    >
                                      {savingEdit ? "Saving..." : "Save"}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {msg.body && (
                                    <p className="whitespace-pre-wrap">
                                      {msg.body}
                                    </p>
                                  )}
                                  {msg.attachments.map((att) => (
                                    <AttachmentMedia
                                      key={att.id}
                                      attachment={att}
                                      isOwnMessage={isOwn}
                                    />
                                  ))}
                                </>
                              )}
                            </div>

                            {/* Hover Action Toolbar (Right side for incoming messages) */}
                            {!isOwn && !isDeleted && (
                              <MessageActionsToolbar
                                isOwn={false}
                                isPinned={Boolean(msg.pinned_at)}
                                canPin={canPinMessages}
                                onReply={() =>
                                  setReplyTo({
                                    id: msg.id,
                                    senderDisplayName:
                                      msg.senderProfile?.display_name ||
                                      "Member",
                                    body: msg.body,
                                    hasAttachments: msg.has_attachments,
                                  })
                                }
                                onReact={() =>
                                  setReactionPickerMsgId((prev) =>
                                    prev === msg.id ? null : msg.id
                                  )
                                }
                                onForward={() => setForwardingMessage(msg)}
                                onPin={() => void handleTogglePinMessage(msg)}
                                onCopy={() => {
                                  if (msg.body) {
                                    void navigator.clipboard.writeText(msg.body);
                                    pushToast({ title: "Copied message text" });
                                  }
                                }}
                                onEdit={() => {}}
                                onDelete={() => {}}
                                onReport={() =>
                                  openReportModal({
                                    reportedUserId: msg.sender_id,
                                    conversationId,
                                    messageId: msg.id,
                                    label: "message",
                                  })
                                }
                              />
                            )}

                            {/* Quick Reaction Popover */}
                            {reactionPickerMsgId === msg.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className={cn(
                                  "absolute -top-11 z-20 flex items-center gap-1 rounded-full border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-2 py-1 shadow-xl animate-asterial-in",
                                  isOwn ? "right-0" : "left-0"
                                )}
                              >
                                {QUICK_REACTION_EMOJIS.map((emoji) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() =>
                                      void handleToggleReaction(msg, emoji)
                                    }
                                    className="flex h-7 w-7 items-center justify-center rounded-full text-sm hover:bg-white/[0.1] transition-colors cursor-pointer"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Reaction Pills */}
                          {reactionGroups.size > 0 && !isDeleted && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {Array.from(reactionGroups.entries()).map(
                                ([emoji, info]) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() =>
                                      void handleToggleReaction(msg, emoji)
                                    }
                                    className={cn(
                                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors cursor-pointer",
                                      info.reactedByMe
                                        ? "border-white/40 bg-white/15 text-white"
                                        : "border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/25"
                                    )}
                                  >
                                    <span>{emoji}</span>
                                    <span className="font-mono text-[10px]">
                                      {info.count}
                                    </span>
                                  </button>
                                )
                              )}
                            </div>
                          )}

                          {/* Timestamp, Pin, Edited Tag, Delivery/Read Receipt, and Optimistic Failure Controls */}
                          <div className="mt-1 flex items-center gap-1.5 px-1 font-mono text-[10px] text-[var(--text-muted)]">
                            {msg.pinned_at && !isDeleted && (
                              <Pin
                                className="h-2.5 w-2.5 text-[var(--accent-primary)]"
                                aria-label="Pinned"
                              />
                            )}
                            <span>{formatMessageTimestamp(msg.created_at)}</span>
                            {msg.edited_at && !isDeleted && (
                              <span>· edited</span>
                            )}

                            {isOwn && !isDeleted && deliveryState && (
                              <span
                                className="inline-flex items-center gap-1"
                                title={`Status: ${deliveryState}`}
                              >
                                {deliveryState === "sending" && (
                                  <Clock
                                    className="h-3 w-3 text-zinc-500"
                                    aria-label="Sending"
                                  />
                                )}
                                {deliveryState === "sent" && (
                                  <Check
                                    className="h-3 w-3 text-zinc-400"
                                    aria-label="Sent"
                                  />
                                )}
                                {deliveryState === "delivered" && (
                                  <CheckCheck
                                    className="h-3.5 w-3.5 text-zinc-400"
                                    aria-label="Delivered"
                                  />
                                )}
                                {deliveryState === "read" && (
                                  <span className="inline-flex items-center gap-0.5 text-white">
                                    <CheckCheck
                                      className="h-3.5 w-3.5"
                                      aria-label="Read"
                                    />
                                    <span>Read</span>
                                  </span>
                                )}
                                {deliveryState === "failed" && (
                                  <span className="inline-flex items-center gap-1.5 text-red-400">
                                    <AlertCircle className="h-3 w-3" />
                                    <span>Failed</span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void handleRetryFailedMessage(msg)
                                      }
                                      className="inline-flex items-center gap-0.5 text-white underline cursor-pointer"
                                    >
                                      <RotateCcw className="h-2.5 w-2.5" />
                                      Retry
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setMessages((prev) =>
                                          prev.filter((m) => m.id !== msg.id)
                                        )
                                      }
                                      className="text-zinc-400 hover:text-white underline cursor-pointer"
                                    >
                                      Discard
                                    </button>
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              )}

              {/* Live Typing Indicator Bubble */}
              {typingNames.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-zinc-400 pl-2 pt-1 animate-asterial-in">
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-[var(--bg-surface)] px-3 py-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-300 animate-pulse" />
                    <span className="text-[11px]">
                      {typingNames.join(", ")}{" "}
                      {typingNames.length === 1 ? "is" : "are"} typing...
                    </span>
                  </span>
                </div>
              )}

              <div ref={bottomAnchorRef} />
            </div>
          )}

          {/* Floating Scroll-to-Latest Button */}
          {showScrollBottom && (
            <button
              type="button"
              onClick={() =>
                bottomAnchorRef.current?.scrollIntoView({ behavior: "smooth" })
              }
              aria-label="Scroll to latest message"
              className="sticky bottom-3 left-full float-right z-20 inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] shadow-xl hover:border-[var(--border-active)] cursor-pointer"
            >
              <ArrowDown className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
              <span>Latest</span>
            </button>
          )}
        </div>

        {/* Message Composer */}
        {user && (
          <MessageComposer
            key={conversationId}
            conversationId={conversationId}
            userId={user.id}
            initialDraft={drafts[conversationId] || ""}
            onDraftChange={(val) => setDraft(conversationId, val)}
            disabled={blockedBetweenPeer || peerBlockedByMe}
            disabledReason={
              peerBlockedByMe
                ? "You blocked this user. Unblock them in Contact Info to send messages."
                : "Messaging is unavailable in this direct conversation due to privacy/block settings."
            }
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
            onTyping={emitTyping}
            onSendMessage={handleSendMessage}
          />
        )}
      </div>

      {/* Collapsible Contextual Info Panel */}
      {summary && (
        <ConversationInfoDrawer
          open={infoOpen}
          onClose={() => setInfoOpen(false)}
          summary={summary}
          members={members}
          sharedAttachments={sharedAttachments}
          onRefreshConversationDetail={fetchConversationMeta}
        />
      )}
    </div>
  );
}

function MessageActionsToolbar({
  isOwn,
  isPinned,
  canPin,
  onReply,
  onReact,
  onForward,
  onPin,
  onCopy,
  onEdit,
  onDelete,
  onReport,
}: {
  isOwn: boolean;
  isPinned: boolean;
  canPin: boolean;
  onReply: () => void;
  onReact: () => void;
  onForward: () => void;
  onPin: () => void;
  onCopy: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReport: () => void;
}) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="flex items-center gap-0.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-0.5 opacity-0 focus-within:opacity-100 group-hover:opacity-100 transition-opacity shadow-lg"
    >
      <button
        type="button"
        onClick={onReact}
        title="React"
        aria-label="Add reaction"
        className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-white/[0.08] hover:text-[var(--text-primary)] cursor-pointer"
      >
        <SmilePlus className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onReply}
        title="Reply"
        aria-label="Reply to message"
        className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-white/[0.08] hover:text-[var(--text-primary)] cursor-pointer"
      >
        <CornerUpLeft className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onForward}
        title="Forward"
        aria-label="Forward message"
        className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-white/[0.08] hover:text-[var(--text-primary)] cursor-pointer"
      >
        <CornerUpRight className="h-3.5 w-3.5" />
      </button>
      {canPin && (
        <button
          type="button"
          onClick={onPin}
          title={isPinned ? "Unpin message" : "Pin message"}
          aria-label={isPinned ? "Unpin message" : "Pin message"}
          className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-white/[0.08] hover:text-[var(--text-primary)] cursor-pointer"
        >
          {isPinned ? (
            <PinOff className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
          ) : (
            <Pin className="h-3.5 w-3.5" />
          )}
        </button>
      )}
      <button
        type="button"
        onClick={onCopy}
        title="Copy text"
        aria-label="Copy message text"
        className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-white/[0.08] hover:text-[var(--text-primary)] cursor-pointer"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
      {isOwn ? (
        <>
          <button
            type="button"
            onClick={onEdit}
            title="Edit"
            aria-label="Edit message"
            className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-white/[0.08] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Delete"
            aria-label="Delete message"
            className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-red-500/15 hover:text-red-300 cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={onReport}
          title="Report"
          aria-label="Report message"
          className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-red-500/15 hover:text-red-300 cursor-pointer"
        >
          <Flag className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
