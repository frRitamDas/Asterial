import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import {
  computeOutgoingDeliveryState,
  formatBytes,
  formatDateDivider,
  formatLastSeen,
  formatMessageTimestamp,
  groupReactionsByEmoji,
  type AttachmentRow,
  type ConversationMemberRow,
  type ConversationRow,
  type EnrichedMessage,
  type MessageReactionRow,
  type MessageReceiptRow,
  type MessageRow,
  type ProfileRow,
  type ThemePalette,
} from "@asterial/core";
import { AttachmentViewerModal } from "../components/AttachmentViewerModal";
import {
  ConversationInfoModal,
  type HydratedGroupMember,
} from "../components/ConversationModals";
import { NativeAvatar } from "../components/NativeAvatar";
import { ReportModal } from "../components/ReportModal";
import { useMobileWorkspace } from "../context/MobileWorkspaceContext";
import {
  buildChatAttachmentStoragePath,
  getCachedSignedUrl,
  pickAndValidateNativeFile,
  primePrivateSignedUrls,
  resolvePrivateSignedUrl,
  uploadValidatedNativeFile,
  type ValidatedNativeFile,
} from "../lib/storage";
import { createClientUuid } from "../lib/uuid";
import { AsterialNative } from "../native/AsterialNative";

const MESSAGES_PAGE_SIZE = 35;
const QUICK_EMOJIS = ["✦", "👍", "❤️", "🔥", "😂", "👀"] as const;

function PrivateImageThumb({
  supabase,
  attachment,
  palette,
  onPress,
}: {
  supabase: SupabaseClient | null;
  attachment: AttachmentRow;
  palette: ThemePalette;
  onPress: () => void;
}) {
  const [resolved, setResolved] = useState<{
    path: string;
    url: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    if (!supabase || getCachedSignedUrl("chat-attachments", attachment.storage_path)) {
      return () => {
        active = false;
      };
    }
    void resolvePrivateSignedUrl(
      supabase,
      "chat-attachments",
      attachment.storage_path
    ).then((url) => {
      if (active && url) {
        setResolved({ path: attachment.storage_path, url });
      }
    });
    return () => {
      active = false;
    };
  }, [attachment.storage_path, supabase]);

  const signedUrl =
    getCachedSignedUrl("chat-attachments", attachment.storage_path) ||
    (resolved?.path === attachment.storage_path ? resolved.url : null);

  return (
    <Pressable onPress={onPress} style={styles.imageThumbWrap}>
      {signedUrl ? (
        <Image
          alt={attachment.file_name}
          source={{ uri: signedUrl }}
          style={styles.imageThumb}
          resizeMode="cover"
        />
      ) : (
        <View
          style={[
            styles.imageThumbPlaceholder,
            { backgroundColor: palette.bgElevated },
          ]}
        >
          <ActivityIndicator color={palette.accent} size="small" />
        </View>
      )}
    </Pressable>
  );
}

export function ConversationScreen({
  conversationId,
  onBack,
}: {
  conversationId: string;
  onBack: () => void;
}) {
  const {
    supabase,
    user,
    profile,
    palette,
    density,
    onlineUserIds,
    blockedIds,
    isOnline,
    markConversationRead,
    toggleBlockUser,
    submitReport,
    refreshWorkspace,
    showToast,
  } = useMobileWorkspace();

  const [conversation, setConversation] = useState<ConversationRow | null>(null);
  const [members, setMembers] = useState<HydratedGroupMember[]>([]);
  const [messages, setMessages] = useState<EnrichedMessage[]>([]);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [loadingOlder, setLoadingOlder] = useState<boolean>(false);
  const [hasOlderMessages, setHasOlderMessages] = useState<boolean>(false);
  const [accessDenied, setAccessDenied] = useState<boolean>(false);

  const [composerText, setComposerText] = useState("");
  const [replyTarget, setReplyTarget] = useState<EnrichedMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<EnrichedMessage | null>(
    null
  );
  const [stagedFile, setStagedFile] = useState<ValidatedNativeFile | null>(null);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const [typingUsers, setTypingUsers] = useState<
    Map<string, { name: string; expiresAt: number }>
  >(new Map());

  const [selectedMessage, setSelectedMessage] =
    useState<EnrichedMessage | null>(null);
  const [viewerAttachment, setViewerAttachment] =
    useState<AttachmentRow | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showThreadSearch, setShowThreadSearch] = useState(false);
  const [threadSearchQuery, setThreadSearchQuery] = useState("");
  const [reportTarget, setReportTarget] = useState<{
    userId?: string | null;
    messageId?: string | null;
    label: string;
  } | null>(null);

  const flatListRef = useRef<FlatList<EnrichedMessage> | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastTypingBroadcastRef = useRef<number>(0);
  const profileCacheRef = useRef<Map<string, ProfileRow>>(new Map());
  const wasOnlineRef = useRef<boolean>(isOnline);

  const getCachedOrFetchProfiles = useCallback(
    async (ids: string[]) => {
      if (!supabase) return;
      const missing = Array.from(
        new Set(ids.filter((id) => id && !profileCacheRef.current.has(id)))
      );
      if (missing.length === 0) return;

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .in("id", missing);
      const rows = (data || []) as ProfileRow[];
      await primePrivateSignedUrls(
        supabase,
        "avatars",
        rows.map((r) => r.avatar_url)
      );
      for (const p of rows) {
        profileCacheRef.current.set(p.id, p);
      }
    },
    [supabase]
  );

  const enrichMessageBatch = useCallback(
    async (rawRows: MessageRow[]): Promise<EnrichedMessage[]> => {
      if (!supabase || rawRows.length === 0) return [];

      const msgIds = rawRows.map((m) => m.id);
      const replyIds = Array.from(
        new Set(rawRows.map((m) => m.reply_to_id).filter(Boolean) as string[])
      );

      const [attachmentsRes, reactionsRes, receiptsRes, replyMsgsRes] =
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
          replyIds.length > 0
            ? supabase.from("messages").select("*").in("id", replyIds)
            : Promise.resolve({ data: [] as MessageRow[] }),
        ]);

      const senderIds = new Set<string>();
      for (const m of rawRows) {
        if (m.sender_id) senderIds.add(m.sender_id);
      }
      for (const r of (replyMsgsRes.data || []) as MessageRow[]) {
        if (r.sender_id) senderIds.add(r.sender_id);
      }
      await getCachedOrFetchProfiles(Array.from(senderIds));

      const allAttachments = (attachmentsRes.data || []) as AttachmentRow[];
      await primePrivateSignedUrls(
        supabase,
        "chat-attachments",
        allAttachments.map((a) => a.storage_path)
      );

      const attachmentsByMsg = new Map<string, AttachmentRow[]>();
      for (const att of allAttachments) {
        const list = attachmentsByMsg.get(att.message_id) || [];
        list.push(att);
        attachmentsByMsg.set(att.message_id, list);
      }

      const reactionsByMsg = new Map<string, MessageReactionRow[]>();
      for (const react of (reactionsRes.data || []) as MessageReactionRow[]) {
        const list = reactionsByMsg.get(react.message_id) || [];
        list.push(react);
        reactionsByMsg.set(react.message_id, list);
      }

      const receiptsByMsg = new Map<string, MessageReceiptRow[]>();
      for (const rec of (receiptsRes.data || []) as MessageReceiptRow[]) {
        const list = receiptsByMsg.get(rec.message_id) || [];
        list.push(rec);
        receiptsByMsg.set(rec.message_id, list);
      }

      const replyMap = new Map<
        string,
        {
          id: string;
          senderDisplayName: string;
          body: string;
          deleted: boolean;
          hasAttachments: boolean;
        }
      >();
      for (const rm of (replyMsgsRes.data || []) as MessageRow[]) {
        const senderProf = rm.sender_id
          ? profileCacheRef.current.get(rm.sender_id) || null
          : null;
        replyMap.set(rm.id, {
          id: rm.id,
          senderDisplayName:
            senderProf?.display_name || senderProf?.username || "Reply",
          body: rm.body,
          deleted: Boolean(rm.deleted_at),
          hasAttachments: rm.has_attachments,
        });
      }

      return rawRows.map((msg) => ({
        ...msg,
        senderProfile: msg.sender_id
          ? profileCacheRef.current.get(msg.sender_id) || null
          : null,
        replyToMessage: msg.reply_to_id
          ? replyMap.get(msg.reply_to_id) || null
          : null,
        attachments: attachmentsByMsg.get(msg.id) || [],
        reactions: reactionsByMsg.get(msg.id) || [],
        receipts: receiptsByMsg.get(msg.id) || [],
      }));
    },
    [getCachedOrFetchProfiles, supabase]
  );

  const loadConversationAndMessages = useCallback(
    async (silent = false) => {
      if (!supabase || !user?.id) return;
      if (!silent) setLoadingInitial(true);
      setAccessDenied(false);

      try {
        const [convRes, membersRes] = await Promise.all([
          supabase
            .from("conversations")
            .select("*")
            .eq("id", conversationId)
            .maybeSingle(),
          supabase
            .from("conversation_members")
            .select("*")
            .eq("conversation_id", conversationId)
            .is("left_at", null),
        ]);

        const convRow = (convRes.data as ConversationRow | null) ?? null;
        const memberRows = (membersRes.data || []) as ConversationMemberRow[];
        const isActiveMember = memberRows.some((m) => m.user_id === user.id);

        if (!convRow || !isActiveMember) {
          setAccessDenied(true);
          return;
        }

        await getCachedOrFetchProfiles(memberRows.map((m) => m.user_id));
        if (convRow.avatar_url) {
          await primePrivateSignedUrls(supabase, "avatars", [
            convRow.avatar_url,
          ]);
        }

        setConversation(convRow);
        setMembers(
          memberRows.map((m) => ({
            ...m,
            profile: profileCacheRef.current.get(m.user_id) || null,
          }))
        );

        const { data: rpcMsgs, error: rpcErr } = await supabase.rpc(
          "get_conversation_messages_page",
          {
            p_conversation_id: conversationId,
            p_before_created_at: null,
            p_before_id: null,
            p_limit: MESSAGES_PAGE_SIZE + 1,
          }
        );

        let rawList: MessageRow[];
        if (!rpcErr && Array.isArray(rpcMsgs)) {
          rawList = rpcMsgs as MessageRow[];
        } else {
          const { data: fallbackMsgs } = await supabase
            .from("messages")
            .select("*")
            .eq("conversation_id", conversationId)
            .order("created_at", { ascending: false })
            .limit(MESSAGES_PAGE_SIZE + 1);
          rawList = (fallbackMsgs || []) as MessageRow[];
        }

        setHasOlderMessages(rawList.length > MESSAGES_PAGE_SIZE);
        const latestChrono = rawList.slice(0, MESSAGES_PAGE_SIZE).reverse();
        const hydrated = await enrichMessageBatch(latestChrono);
        setMessages(hydrated);

        await markConversationRead(conversationId);
      } finally {
        if (!silent) setLoadingInitial(false);
      }
    },
    [
      conversationId,
      enrichMessageBatch,
      getCachedOrFetchProfiles,
      markConversationRead,
      supabase,
      user?.id,
    ]
  );

  useEffect(() => {
    const id = setTimeout(() => {
      void loadConversationAndMessages(false);
    }, 0);
    return () => clearTimeout(id);
  }, [loadConversationAndMessages]);

  // Reconnect recovery: catch up missed messages when device returns online
  useEffect(() => {
    if (!wasOnlineRef.current && isOnline) {
      void loadConversationAndMessages(true);
    }
    wasOnlineRef.current = isOnline;
  }, [isOnline, loadConversationAndMessages]);

  // Typing indicator TTL cleanup
  useEffect(() => {
    if (typingUsers.size === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [uid, entry] of next.entries()) {
          if (entry.expiresAt <= now) {
            next.delete(uid);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 800);
    return () => clearInterval(timer);
  }, [typingUsers.size]);

  // Realtime conversation channel (100% shared protocol with Web)
  useEffect(() => {
    if (!supabase || !user?.id || accessDenied) return;

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
            name: data.displayName || "Member",
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
            AppState.currentState === "active"
          ) {
            void markConversationRead(conversationId);
          }

          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 80);
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
        (payload) => {
          const updated = payload.new as MessageRow;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === updated.id
                ? {
                    ...m,
                    ...updated,
                    attachments: updated.deleted_at ? [] : m.attachments,
                  }
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
          table: "attachments",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const att = payload.new as AttachmentRow;
          await primePrivateSignedUrls(supabase, "chat-attachments", [
            att.storage_path,
          ]);
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== att.message_id) return m;
              if (m.attachments.some((a) => a.id === att.id)) return m;
              return { ...m, attachments: [...m.attachments, att] };
            })
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_reactions",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const react = payload.new as MessageReactionRow;
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== react.message_id) return m;
                if (
                  m.reactions.some(
                    (r) => r.user_id === react.user_id && r.emoji === react.emoji
                  )
                ) {
                  return m;
                }
                return { ...m, reactions: [...m.reactions, react] };
              })
            );
          } else if (payload.eventType === "DELETE") {
            const oldReact = payload.old as Partial<MessageReactionRow>;
            setMessages((prev) =>
              prev.map((m) => {
                if (oldReact.message_id && m.id !== oldReact.message_id) {
                  return m;
                }
                return {
                  ...m,
                  reactions: m.reactions.filter(
                    (r) =>
                      !(
                        r.user_id === oldReact.user_id &&
                        r.emoji === oldReact.emoji
                      )
                  ),
                };
              })
            );
          }
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
          const rec = payload.new as MessageReceiptRow | undefined;
          if (!rec?.message_id) return;
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== rec.message_id) return m;
              const idx = m.receipts.findIndex(
                (r) => r.user_id === rec.user_id
              );
              if (idx === -1) {
                return { ...m, receipts: [...m.receipts, rec] };
              }
              const clone = [...m.receipts];
              clone[idx] = rec;
              return { ...m, receipts: clone };
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
          void loadConversationAndMessages(true);
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
    loadConversationAndMessages,
    markConversationRead,
    supabase,
    user?.id,
  ]);

  const handleLoadOlder = async () => {
    if (!supabase || loadingOlder || !hasOlderMessages || messages.length === 0) {
      return;
    }
    const oldest = messages.find((m) => !m.optimisticState);
    if (!oldest) return;

    setLoadingOlder(true);
    try {
      const { data: rpcRows, error: rpcErr } = await supabase.rpc(
        "get_conversation_messages_page",
        {
          p_conversation_id: conversationId,
          p_before_created_at: oldest.created_at,
          p_before_id: oldest.id,
          p_limit: MESSAGES_PAGE_SIZE + 1,
        }
      );

      const rawRows = (!rpcErr && Array.isArray(rpcRows)
        ? rpcRows
        : []) as MessageRow[];
      setHasOlderMessages(rawRows.length > MESSAGES_PAGE_SIZE);
      const batch = rawRows.slice(0, MESSAGES_PAGE_SIZE).reverse();
      const hydrated = await enrichMessageBatch(batch);

      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const uniqueOlder = hydrated.filter((m) => !existingIds.has(m.id));
        return [...uniqueOlder, ...prev];
      });
    } finally {
      setLoadingOlder(false);
    }
  };

  const broadcastTyping = () => {
    const now = Date.now();
    if (now - lastTypingBroadcastRef.current < 1500) return;
    lastTypingBroadcastRef.current = now;
    if (channelRef.current && user?.id) {
      void channelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: {
          userId: user.id,
          displayName:
            profile?.display_name || profile?.username || "Member",
        },
      });
    }
  };

  const handlePickAttachment = async () => {
    try {
      const picked = await pickAndValidateNativeFile("attachment");
      if (!picked) return;
      setStagedFile(picked);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Attachment validation failed.",
        "error"
      );
    }
  };

  const handleCancelActiveUpload = async () => {
    if (!activeUploadId) return;
    await AsterialNative.cancelUpload(activeUploadId);
  };

  const executeMessageSend = async (params: {
    bodyText: string;
    fileToUpload: ValidatedNativeFile | null;
    replyMsg: EnrichedMessage | null;
    reuseClientId?: string;
  }) => {
    if (!supabase || !user?.id) return;

    const cleanBody = params.bodyText.trim();
    if (!cleanBody && !params.fileToUpload) return;

    const clientId = params.reuseClientId || createClientUuid();
    const nowIso = new Date().toISOString();
    const tempId = `opt-${clientId}`;

    const optimisticEntry: EnrichedMessage = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: user.id,
      kind: "user",
      body: cleanBody,
      reply_to_id: params.replyMsg?.id || null,
      client_id: clientId,
      has_attachments: Boolean(params.fileToUpload),
      edited_at: null,
      deleted_at: null,
      metadata: {},
      created_at: nowIso,
      updated_at: nowIso,
      senderProfile: profile,
      replyToMessage: params.replyMsg
        ? {
            id: params.replyMsg.id,
            senderDisplayName:
              params.replyMsg.senderProfile?.display_name ||
              params.replyMsg.senderProfile?.username ||
              "Reply",
            body: params.replyMsg.body,
            deleted: Boolean(params.replyMsg.deleted_at),
            hasAttachments: params.replyMsg.has_attachments,
          }
        : null,
      attachments: [],
      reactions: [],
      receipts: [],
      optimisticState: "sending",
    };

    setMessages((prev) => {
      const existingIdx = prev.findIndex((m) => m.client_id === clientId);
      if (existingIdx !== -1) {
        const clone = [...prev];
        clone[existingIdx] = optimisticEntry;
        return clone;
      }
      return [...prev, optimisticEntry];
    });

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 60);

    setSending(true);
    let uploadedStoragePath: string | null = null;

    try {
      if (params.fileToUpload) {
        const uploadId = createClientUuid();
        setActiveUploadId(uploadId);
        setUploadPercent(0);
        const storagePath = buildChatAttachmentStoragePath(
          conversationId,
          user.id,
          params.fileToUpload.fileName
        );
        await uploadValidatedNativeFile({
          supabase,
          bucket: "chat-attachments",
          storagePath,
          file: params.fileToUpload,
          uploadId,
          onProgress: (pct) => setUploadPercent(pct),
        });
        uploadedStoragePath = storagePath;
      }

      const { data: insertedMsg, error: msgErr } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          kind: "user",
          body: cleanBody,
          reply_to_id: params.replyMsg?.id || null,
          client_id: clientId,
          has_attachments: Boolean(uploadedStoragePath),
        })
        .select("*")
        .single();

      if (msgErr || !insertedMsg) {
        if (uploadedStoragePath) {
          await supabase.storage
            .from("chat-attachments")
            .remove([uploadedStoragePath])
            .catch(() => undefined);
        }
        throw new Error(msgErr?.message || "Message could not be sent.");
      }

      const persistedMsg = insertedMsg as MessageRow;
      let persistedAttachments: AttachmentRow[] = [];

      if (uploadedStoragePath && params.fileToUpload) {
        const { data: attRow, error: attErr } = await supabase
          .from("attachments")
          .insert({
            message_id: persistedMsg.id,
            conversation_id: conversationId,
            uploader_id: user.id,
            storage_bucket: "chat-attachments",
            storage_path: uploadedStoragePath,
            file_name: params.fileToUpload.fileName,
            mime_type: params.fileToUpload.normalizedMime,
            byte_size: params.fileToUpload.byteSize,
            width: params.fileToUpload.width,
            height: params.fileToUpload.height,
          })
          .select("*")
          .single();

        if (!attErr && attRow) {
          persistedAttachments = [attRow as AttachmentRow];
          await primePrivateSignedUrls(supabase, "chat-attachments", [
            uploadedStoragePath,
          ]);
        }
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.client_id === clientId
            ? {
                ...persistedMsg,
                senderProfile: profile,
                replyToMessage: optimisticEntry.replyToMessage,
                attachments:
                  m.attachments.length > 0
                    ? m.attachments
                    : persistedAttachments,
                reactions: m.reactions,
                receipts: m.receipts,
              }
            : m
        )
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send.";
      const isCancelled = msg.toLowerCase().includes("cancelled");
      if (isCancelled) {
        setMessages((prev) => prev.filter((m) => m.client_id !== clientId));
        showToast("Upload cancelled.", "info");
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.client_id === clientId
              ? { ...m, optimisticState: "failed", optimisticError: msg }
              : m
          )
        );
        showToast(msg, "error");
      }
    } finally {
      setSending(false);
      setActiveUploadId(null);
      setUploadPercent(null);
    }
  };

  const handleComposerSubmit = async () => {
    if (!supabase || !user?.id) return;

    if (editingMessage) {
      const nextBody = composerText.trim();
      if (!nextBody) {
        showToast("Edited message cannot be empty.", "error");
        return;
      }
      const target = editingMessage;
      setEditingMessage(null);
      setComposerText("");

      const editedAt = new Date().toISOString();
      setMessages((prev) =>
        prev.map((m) =>
          m.id === target.id ? { ...m, body: nextBody, edited_at: editedAt } : m
        )
      );

      const { error } = await supabase
        .from("messages")
        .update({ body: nextBody, edited_at: editedAt })
        .eq("id", target.id);
      if (error) {
        showToast(error.message, "error");
        await loadConversationAndMessages(true);
      }
      return;
    }

    const bodySnapshot = composerText;
    const fileSnapshot = stagedFile;
    const replySnapshot = replyTarget;

    if (!bodySnapshot.trim() && !fileSnapshot) return;

    setComposerText("");
    setStagedFile(null);
    setReplyTarget(null);

    await executeMessageSend({
      bodyText: bodySnapshot,
      fileToUpload: fileSnapshot,
      replyMsg: replySnapshot,
    });
  };

  const handleToggleReaction = async (
    msg: EnrichedMessage,
    emoji: string
  ) => {
    if (!supabase || !user?.id || msg.deleted_at || msg.optimisticState) return;
    const existing = msg.reactions.find(
      (r) => r.user_id === user.id && r.emoji === emoji
    );

    if (existing) {
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
      const optimisticReact: MessageReactionRow = {
        message_id: msg.id,
        conversation_id: conversationId,
        user_id: user.id,
        emoji,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id
            ? { ...m, reactions: [...m.reactions, optimisticReact] }
            : m
        )
      );
      await supabase.from("message_reactions").insert({
        message_id: msg.id,
        conversation_id: conversationId,
        user_id: user.id,
        emoji,
      });
    }
  };

  const handleUnsendMessage = async (target: EnrichedMessage) => {
    if (!supabase || !user?.id) return;
    setSelectedMessage(null);

    // Delete private attachment objects first via Storage API (mirrors Web ConversationView)
    const storagePaths = target.attachments
      .map((a) => a.storage_path)
      .filter(Boolean);
    if (storagePaths.length > 0) {
      await supabase.storage
        .from("chat-attachments")
        .remove(storagePaths)
        .catch(() => undefined);
    }

    const deletedAt = new Date().toISOString();
    setMessages((prev) =>
      prev.map((m) =>
        m.id === target.id
          ? {
              ...m,
              body: "",
              has_attachments: false,
              attachments: [],
              deleted_at: deletedAt,
            }
          : m
      )
    );

    const { error } = await supabase
      .from("messages")
      .update({ deleted_at: deletedAt })
      .eq("id", target.id);
    if (error) {
      showToast(error.message, "error");
      await loadConversationAndMessages(true);
    } else {
      showToast("Message deleted.", "info");
    }
  };

  const peerMember = useMemo(
    () =>
      conversation?.type === "direct"
        ? members.find((m) => m.user_id !== user?.id) || null
        : null,
    [conversation?.type, members, user?.id]
  );

  const peerProfile = peerMember?.profile || null;
  const isPeerBlocked = Boolean(peerProfile && blockedIds.has(peerProfile.id));

  const headerTitle =
    conversation?.type === "group"
      ? conversation.name || "Untitled Group"
      : peerProfile?.display_name || peerProfile?.username || "Conversation";

  const activeTypingNames = Array.from(typingUsers.values()).map((t) => t.name);
  const headerSubtitle =
    activeTypingNames.length > 0
      ? `${activeTypingNames.join(", ")} typing…`
      : conversation?.type === "group"
      ? `${members.length} members`
      : peerProfile
      ? onlineUserIds.has(peerProfile.id)
        ? "Online"
        : formatLastSeen(null)
      : "Direct message";

  const displayedMessages = useMemo(() => {
    const q = threadSearchQuery.trim().toLowerCase();
    if (!showThreadSearch || !q) return messages;
    return messages.filter((m) => m.body.toLowerCase().includes(q));
  }, [messages, showThreadSearch, threadSearchQuery]);

  const compactBubble = density === "compact";

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: palette.bgVoid }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Top Thread Bar */}
      <View
        style={[
          styles.headerBar,
          {
            backgroundColor: palette.bgSurface,
            borderBottomColor: palette.borderSubtle,
          },
        ]}
      >
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back to conversations"
          style={styles.backBtn}
        >
          <Text style={[styles.backGlyph, { color: palette.textPrimary }]}>
            ←
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setShowInfoModal(true)}
          style={styles.headerCenterRow}
        >
          <NativeAvatar
            supabase={supabase}
            storagePath={
              conversation?.type === "group"
                ? conversation.avatar_url
                : peerProfile?.avatar_url
            }
            label={headerTitle}
            palette={palette}
            size={38}
            isGroup={conversation?.type === "group"}
            isOnline={
              peerProfile ? onlineUserIds.has(peerProfile.id) : undefined
            }
          />
          <View style={styles.headerTextCol}>
            <Text
              numberOfLines={1}
              style={[styles.headerTitle, { color: palette.textPrimary }]}
            >
              {headerTitle}
            </Text>
            <Text
              numberOfLines={1}
              style={[
                styles.headerSub,
                {
                  color:
                    activeTypingNames.length > 0
                      ? palette.accent
                      : palette.textSecondary,
                },
              ]}
            >
              {headerSubtitle}
            </Text>
          </View>
        </Pressable>

        <View style={styles.headerRightBtns}>
          <Pressable
            onPress={() => {
              setShowThreadSearch((v) => !v);
              setThreadSearchQuery("");
            }}
            accessibilityLabel="Search in conversation"
            style={[
              styles.iconPill,
              {
                backgroundColor: palette.bgElevated,
                borderColor: palette.borderSubtle,
              },
            ]}
          >
            <Text style={{ color: palette.textPrimary, fontSize: 12, fontWeight: "700" }}>
              Find
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setShowInfoModal(true)}
            accessibilityLabel="Conversation details"
            style={[
              styles.iconPill,
              {
                backgroundColor: palette.bgElevated,
                borderColor: palette.borderSubtle,
              },
            ]}
          >
            <Text style={{ color: palette.accent, fontSize: 12, fontWeight: "800" }}>
              Info
            </Text>
          </Pressable>
        </View>
      </View>

      {showThreadSearch ? (
        <View
          style={[
            styles.threadSearchWrap,
            {
              backgroundColor: palette.bgSurface,
              borderBottomColor: palette.borderSubtle,
            },
          ]}
        >
          <TextInput
            value={threadSearchQuery}
            onChangeText={setThreadSearchQuery}
            placeholder="Filter messages in this thread…"
            placeholderTextColor={palette.textMuted}
            autoFocus
            style={[
              styles.threadSearchInput,
              {
                backgroundColor: palette.bgElevated,
                borderColor: palette.borderSubtle,
                color: palette.textPrimary,
              },
            ]}
          />
        </View>
      ) : null}

      {/* Messages Timeline */}
      {loadingInitial ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={palette.accent} size="large" />
        </View>
      ) : accessDenied ? (
        <View style={styles.centerState}>
          <Text style={[styles.deniedTitle, { color: palette.textPrimary }]}>
            Conversation unavailable
          </Text>
          <Text style={[styles.deniedSub, { color: palette.textSecondary }]}>
            You are no longer an active member of this conversation.
          </Text>
          <Pressable
            onPress={onBack}
            style={[styles.returnBtn, { backgroundColor: palette.accent }]}
          >
            <Text style={{ color: "#0B0C10", fontWeight: "800" }}>
              Return to Inbox
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={displayedMessages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.timelineContent}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            hasOlderMessages && !showThreadSearch ? (
              <Pressable
                onPress={() => void handleLoadOlder()}
                disabled={loadingOlder}
                style={[
                  styles.loadOlderBtn,
                  {
                    backgroundColor: palette.bgSurface,
                    borderColor: palette.borderSubtle,
                  },
                ]}
              >
                {loadingOlder ? (
                  <ActivityIndicator color={palette.accent} size="small" />
                ) : (
                  <Text
                    style={{
                      color: palette.accent,
                      fontSize: 12,
                      fontWeight: "700",
                    }}
                  >
                    Load older messages
                  </Text>
                )}
              </Pressable>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyThreadBox}>
              <Text style={{ color: palette.textMuted, fontSize: 13 }}>
                No messages yet — send the first message below.
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const prevMsg = index > 0 ? displayedMessages[index - 1] : null;
            const curDivider = formatDateDivider(item.created_at);
            const prevDivider = prevMsg
              ? formatDateDivider(prevMsg.created_at)
              : null;
            const showDateHeader = curDivider !== prevDivider;

            if (item.kind === "system") {
              return (
                <View>
                  {showDateHeader ? (
                    <View style={styles.dateDividerWrap}>
                      <Text
                        style={[
                          styles.dateDividerLabel,
                          {
                            backgroundColor: palette.bgSurface,
                            color: palette.textMuted,
                          },
                        ]}
                      >
                        {curDivider}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.systemRow}>
                    <Text
                      style={[
                        styles.systemPill,
                        {
                          backgroundColor: palette.bgSurface,
                          borderColor: palette.borderSubtle,
                          color: palette.textSecondary,
                        },
                      ]}
                    >
                      {item.body}
                    </Text>
                  </View>
                </View>
              );
            }

            const isOwn = item.sender_id === user?.id;
            const isDeleted = Boolean(item.deleted_at);
            const reactionGroups = groupReactionsByEmoji(
              item.reactions,
              user?.id
            );
            const deliveryState = isOwn
              ? computeOutgoingDeliveryState({
                  optimisticState: item.optimisticState,
                  receipts: item.receipts,
                  senderId: user?.id,
                  viewerReadReceiptsEnabled:
                    profile?.read_receipts_enabled ?? true,
                })
              : null;

            return (
              <View>
                {showDateHeader ? (
                  <View style={styles.dateDividerWrap}>
                    <Text
                      style={[
                        styles.dateDividerLabel,
                        {
                          backgroundColor: palette.bgSurface,
                          color: palette.textMuted,
                        },
                      ]}
                    >
                      {curDivider}
                    </Text>
                  </View>
                ) : null}

                <View
                  style={[
                    styles.messageRowWrap,
                    isOwn ? styles.alignEnd : styles.alignStart,
                    { marginVertical: compactBubble ? 3 : 5 },
                  ]}
                >
                  {!isOwn && conversation?.type === "group" ? (
                    <Text
                      style={[
                        styles.senderMiniName,
                        { color: palette.accent },
                      ]}
                    >
                      {item.senderProfile?.display_name ||
                        item.senderProfile?.username ||
                        "Member"}
                    </Text>
                  ) : null}

                  <Pressable
                    onLongPress={() => {
                      if (!isDeleted && !item.optimisticState) {
                        setSelectedMessage(item);
                      }
                    }}
                    delayLongPress={230}
                    style={[
                      styles.bubble,
                      {
                        paddingVertical: compactBubble ? 8 : 10,
                        backgroundColor: isOwn
                          ? palette.bubbleOut
                          : palette.bubbleIn,
                        borderColor: isOwn
                          ? palette.bubbleOutBorder
                          : palette.borderSubtle,
                      },
                    ]}
                  >
                    {item.replyToMessage && !isDeleted ? (
                      <View
                        style={[
                          styles.replyQuoteBox,
                          {
                            borderLeftColor: palette.accent,
                            backgroundColor: `${palette.bgVoid}55`,
                          },
                        ]}
                      >
                        <Text
                          numberOfLines={1}
                          style={{
                            fontSize: 11,
                            fontWeight: "700",
                            color: palette.accent,
                          }}
                        >
                          {item.replyToMessage.senderDisplayName}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={{
                            fontSize: 11.5,
                            color: palette.textSecondary,
                          }}
                        >
                          {item.replyToMessage.deleted
                            ? "Message deleted"
                            : item.replyToMessage.body || "Attachment"}
                        </Text>
                      </View>
                    ) : null}

                    {!isDeleted && item.attachments.length > 0 ? (
                      <View style={styles.attachmentsStack}>
                        {item.attachments.map((att) =>
                          att.mime_type.startsWith("image/") ? (
                            <PrivateImageThumb
                              key={att.id}
                              supabase={supabase}
                              attachment={att}
                              palette={palette}
                              onPress={() => setViewerAttachment(att)}
                            />
                          ) : (
                            <Pressable
                              key={att.id}
                              onPress={() => setViewerAttachment(att)}
                              style={[
                                styles.docAttachmentCard,
                                {
                                  backgroundColor: palette.bgElevated,
                                  borderColor: palette.borderSubtle,
                                },
                              ]}
                            >
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontWeight: "800",
                                  color: palette.accent,
                                }}
                              >
                                FILE
                              </Text>
                              <View style={{ flex: 1 }}>
                                <Text
                                  numberOfLines={1}
                                  style={{
                                    fontSize: 12.5,
                                    fontWeight: "700",
                                    color: palette.textPrimary,
                                  }}
                                >
                                  {att.file_name}
                                </Text>
                                <Text
                                  style={{
                                    fontSize: 11,
                                    color: palette.textMuted,
                                  }}
                                >
                                  {formatBytes(att.byte_size)}
                                </Text>
                              </View>
                            </Pressable>
                          )
                        )}
                      </View>
                    ) : null}

                    {isDeleted ? (
                      <Text
                        style={[
                          styles.deletedText,
                          { color: palette.textMuted },
                        ]}
                      >
                        Message deleted
                      </Text>
                    ) : item.body ? (
                      <Text
                        style={[
                          styles.messageBodyText,
                          { color: palette.textPrimary },
                        ]}
                      >
                        {item.body}
                      </Text>
                    ) : null}

                    <View style={styles.metaFooterRow}>
                      <Text
                        style={[styles.metaTime, { color: palette.textMuted }]}
                      >
                        {formatMessageTimestamp(item.created_at)}
                        {item.edited_at && !isDeleted ? " · edited" : ""}
                      </Text>

                      {isOwn && !isDeleted && deliveryState ? (
                        <Text
                          style={[
                            styles.receiptLabel,
                            {
                              color:
                                deliveryState === "failed"
                                  ? palette.danger
                                  : deliveryState === "read"
                                  ? palette.accent
                                  : palette.textMuted,
                            },
                          ]}
                        >
                          {deliveryState === "sending"
                            ? "Sending…"
                            : deliveryState === "failed"
                            ? "Failed"
                            : deliveryState === "read"
                            ? "✓✓ Read"
                            : deliveryState === "delivered"
                            ? "✓✓ Delivered"
                            : "✓ Sent"}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>

                  {/* Retry Failed Message Bar */}
                  {item.optimisticState === "failed" ? (
                    <View style={styles.retryRow}>
                      <Pressable
                        onPress={() =>
                          void executeMessageSend({
                            bodyText: item.body,
                            fileToUpload: null,
                            replyMsg: null,
                            reuseClientId: item.client_id || undefined,
                          })
                        }
                      >
                        <Text
                          style={{
                            color: palette.accent,
                            fontSize: 11.5,
                            fontWeight: "700",
                          }}
                        >
                          Retry Send
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          setMessages((prev) =>
                            prev.filter((m) => m.id !== item.id)
                          )
                        }
                      >
                        <Text
                          style={{
                            color: palette.danger,
                            fontSize: 11.5,
                            fontWeight: "700",
                          }}
                        >
                          Dismiss
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}

                  {/* Reaction Pills */}
                  {!isDeleted && reactionGroups.length > 0 ? (
                    <View style={styles.reactionsRow}>
                      {reactionGroups.map((rg) => (
                        <Pressable
                          key={rg.emoji}
                          onPress={() => void handleToggleReaction(item, rg.emoji)}
                          style={[
                            styles.reactionChip,
                            {
                              backgroundColor: rg.reactedByMe
                                ? palette.accentSoft
                                : palette.bgSurface,
                              borderColor: rg.reactedByMe
                                ? palette.accent
                                : palette.borderSubtle,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              fontSize: 11.5,
                              color: rg.reactedByMe
                                ? palette.accent
                                : palette.textPrimary,
                              fontWeight: "700",
                            }}
                          >
                            {rg.emoji} {rg.count}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Composer / Restriction Banner */}
      {!accessDenied ? (
        isPeerBlocked && peerProfile ? (
          <View
            style={[
              styles.blockedBanner,
              {
                backgroundColor: palette.bgSurface,
                borderTopColor: palette.borderSubtle,
              },
            ]}
          >
            <Text style={{ color: palette.textSecondary, fontSize: 12.5 }}>
              You blocked @{peerProfile.username}. Unblock to send messages.
            </Text>
            <Pressable
              onPress={() => void toggleBlockUser(peerProfile.id)}
              style={[
                styles.unblockInlineBtn,
                { borderColor: palette.accent },
              ]}
            >
              <Text
                style={{
                  color: palette.accent,
                  fontSize: 12,
                  fontWeight: "800",
                }}
              >
                Unblock
              </Text>
            </Pressable>
          </View>
        ) : (
          <View
            style={[
              styles.composerContainer,
              {
                backgroundColor: palette.bgSurface,
                borderTopColor: palette.borderSubtle,
              },
            ]}
          >
            {replyTarget ? (
              <View
                style={[
                  styles.contextBanner,
                  {
                    backgroundColor: palette.bgElevated,
                    borderColor: palette.borderSubtle,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "800",
                      color: palette.accent,
                    }}
                  >
                    Replying to{" "}
                    {replyTarget.senderProfile?.display_name ||
                      replyTarget.senderProfile?.username ||
                      "message"}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{ fontSize: 12, color: palette.textSecondary }}
                  >
                    {replyTarget.body || "Attachment"}
                  </Text>
                </View>
                <Pressable onPress={() => setReplyTarget(null)}>
                  <Text style={{ color: palette.textMuted, fontWeight: "800" }}>
                    ✕
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {editingMessage ? (
              <View
                style={[
                  styles.contextBanner,
                  {
                    backgroundColor: palette.bgElevated,
                    borderColor: palette.accent,
                  },
                ]}
              >
                <Text
                  style={{
                    flex: 1,
                    fontSize: 12,
                    fontWeight: "700",
                    color: palette.accent,
                  }}
                >
                  Editing message
                </Text>
                <Pressable
                  onPress={() => {
                    setEditingMessage(null);
                    setComposerText("");
                  }}
                >
                  <Text style={{ color: palette.textMuted, fontWeight: "800" }}>
                    Cancel
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {stagedFile ? (
              <View
                style={[
                  styles.contextBanner,
                  {
                    backgroundColor: palette.bgElevated,
                    borderColor: palette.borderSubtle,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 12.5,
                      fontWeight: "700",
                      color: palette.textPrimary,
                    }}
                  >
                    {stagedFile.fileName}
                  </Text>
                  <Text style={{ fontSize: 11, color: palette.textMuted }}>
                    {stagedFile.normalizedMime} ·{" "}
                    {formatBytes(stagedFile.byteSize)}
                  </Text>
                </View>
                <Pressable onPress={() => setStagedFile(null)}>
                  <Text style={{ color: palette.danger, fontWeight: "800" }}>
                    Remove
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {uploadPercent !== null ? (
              <View
                style={[
                  styles.progressBarCard,
                  {
                    backgroundColor: palette.bgElevated,
                    borderColor: palette.borderSubtle,
                  },
                ]}
              >
                <View style={styles.progressHeader}>
                  <Text
                    style={{
                      fontSize: 11.5,
                      fontWeight: "700",
                      color: palette.accent,
                    }}
                  >
                    Uploading private attachment ({uploadPercent}%)
                  </Text>
                  <Pressable onPress={() => void handleCancelActiveUpload()}>
                    <Text
                      style={{
                        fontSize: 11.5,
                        fontWeight: "800",
                        color: palette.danger,
                      }}
                    >
                      Cancel
                    </Text>
                  </Pressable>
                </View>
                <View
                  style={[
                    styles.progressTrack,
                    { backgroundColor: palette.bgVoid },
                  ]}
                >
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.max(4, uploadPercent)}%`,
                        backgroundColor: palette.accent,
                      },
                    ]}
                  />
                </View>
              </View>
            ) : null}

            <View style={styles.composerRow}>
              {!editingMessage ? (
                <Pressable
                  onPress={() => void handlePickAttachment()}
                  disabled={sending}
                  accessibilityRole="button"
                  accessibilityLabel="Attach photo or document"
                  style={[
                    styles.attachBtn,
                    {
                      backgroundColor: palette.bgElevated,
                      borderColor: palette.borderSubtle,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: palette.accent,
                      fontSize: 17,
                      fontWeight: "800",
                    }}
                  >
                    ＋
                  </Text>
                </Pressable>
              ) : null}

              <TextInput
                value={composerText}
                onChangeText={(txt) => {
                  setComposerText(txt);
                  if (txt.trim()) broadcastTyping();
                }}
                placeholder="Write a message…"
                placeholderTextColor={palette.textMuted}
                multiline
                maxLength={4000}
                accessibilityLabel="Message composer"
                style={[
                  styles.composerInput,
                  {
                    backgroundColor: palette.bgElevated,
                    borderColor: palette.borderSubtle,
                    color: palette.textPrimary,
                  },
                ]}
              />

              <Pressable
                onPress={() => void handleComposerSubmit()}
                disabled={
                  sending || (!composerText.trim() && !stagedFile)
                }
                accessibilityRole="button"
                accessibilityLabel={
                  editingMessage ? "Save edited message" : "Send message"
                }
                style={[
                  styles.sendBtn,
                  {
                    backgroundColor: palette.accent,
                    opacity:
                      sending || (!composerText.trim() && !stagedFile)
                        ? 0.45
                        : 1,
                  },
                ]}
              >
                <Text style={[styles.sendBtnText, { color: palette.accentFg }]}>
                  {editingMessage ? "Save" : "Send"}
                </Text>
              </Pressable>
            </View>
          </View>
        )
      ) : null}

      {/* Long-Press Message Action Sheet */}
      <Modal
        visible={Boolean(selectedMessage)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMessage(null)}
      >
        <Pressable
          style={styles.actionBackdrop}
          onPress={() => setSelectedMessage(null)}
        >
          {selectedMessage ? (
            <View
              style={[
                styles.actionSheet,
                {
                  backgroundColor: palette.bgSurface,
                  borderColor: palette.borderSubtle,
                },
              ]}
            >
              <View style={styles.quickEmojiBar}>
                {QUICK_EMOJIS.map((em) => (
                  <Pressable
                    key={em}
                    onPress={() => {
                      const target = selectedMessage;
                      setSelectedMessage(null);
                      void handleToggleReaction(target, em);
                    }}
                    style={[
                      styles.emojiCircle,
                      { backgroundColor: palette.bgElevated },
                    ]}
                  >
                    <Text style={{ fontSize: 18 }}>{em}</Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                onPress={() => {
                  setReplyTarget(selectedMessage);
                  setEditingMessage(null);
                  setSelectedMessage(null);
                }}
                style={[
                  styles.sheetActionRow,
                  { borderTopColor: palette.borderSubtle },
                ]}
              >
                <Text style={{ color: palette.textPrimary, fontWeight: "600" }}>
                  Reply in Thread
                </Text>
              </Pressable>

              {selectedMessage.body ? (
                <Pressable
                  onPress={() => {
                    const text = selectedMessage.body;
                    setSelectedMessage(null);
                    void AsterialNative.copyText(text).then(() =>
                      showToast("Copied to clipboard.", "info")
                    );
                  }}
                  style={[
                    styles.sheetActionRow,
                    { borderTopColor: palette.borderSubtle },
                  ]}
                >
                  <Text
                    style={{ color: palette.textPrimary, fontWeight: "600" }}
                  >
                    Copy Message Text
                  </Text>
                </Pressable>
              ) : null}

              {selectedMessage.sender_id === user?.id ? (
                <>
                  {selectedMessage.body ? (
                    <Pressable
                      onPress={() => {
                        setEditingMessage(selectedMessage);
                        setComposerText(selectedMessage.body);
                        setReplyTarget(null);
                        setStagedFile(null);
                        setSelectedMessage(null);
                      }}
                      style={[
                        styles.sheetActionRow,
                        { borderTopColor: palette.borderSubtle },
                      ]}
                    >
                      <Text
                        style={{
                          color: palette.textPrimary,
                          fontWeight: "600",
                        }}
                      >
                        Edit Message
                      </Text>
                    </Pressable>
                  ) : null}

                  <Pressable
                    onPress={() => void handleUnsendMessage(selectedMessage)}
                    style={[
                      styles.sheetActionRow,
                      { borderTopColor: palette.borderSubtle },
                    ]}
                  >
                    <Text style={{ color: palette.danger, fontWeight: "800" }}>
                      Unsend / Delete Message
                    </Text>
                  </Pressable>
                </>
              ) : (
                <Pressable
                  onPress={() => {
                    const target = selectedMessage;
                    setSelectedMessage(null);
                    setReportTarget({
                      userId: target.sender_id,
                      messageId: target.id,
                      label: "this message",
                    });
                  }}
                  style={[
                    styles.sheetActionRow,
                    { borderTopColor: palette.borderSubtle },
                  ]}
                >
                  <Text style={{ color: palette.danger, fontWeight: "700" }}>
                    Report Message
                  </Text>
                </Pressable>
              )}
            </View>
          ) : null}
        </Pressable>
      </Modal>

      <AttachmentViewerModal
        visible={Boolean(viewerAttachment)}
        attachment={viewerAttachment}
        supabase={supabase}
        palette={palette}
        onClose={() => setViewerAttachment(null)}
      />

      <ConversationInfoModal
        visible={showInfoModal}
        conversation={conversation}
        members={members}
        currentUserId={user?.id || null}
        peerProfile={peerProfile}
        peerLastSeenAt={null}
        isBlockedPeer={isPeerBlocked}
        supabase={supabase}
        palette={palette}
        onlineUserIds={onlineUserIds}
        onClose={() => setShowInfoModal(false)}
        onUpdatedConversation={async () => {
          await loadConversationAndMessages(true);
          await refreshWorkspace();
        }}
        onLeftGroup={() => {
          void refreshWorkspace();
          onBack();
        }}
        onToggleBlockPeer={async (peerId) => {
          await toggleBlockUser(peerId);
        }}
        onOpenReport={({ userId, label }) =>
          setReportTarget({ userId: userId || null, label })
        }
      />

      <ReportModal
        visible={Boolean(reportTarget)}
        palette={palette}
        subjectLabel={reportTarget?.label || "content"}
        onClose={() => setReportTarget(null)}
        onSubmit={async (reason, details) => {
          await submitReport({
            reportedUserId: reportTarget?.userId ?? null,
            reportedMessageId: reportTarget?.messageId ?? null,
            conversationId,
            reason,
            details,
          });
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  backGlyph: {
    fontSize: 20,
    fontWeight: "800",
  },
  headerCenterRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTextCol: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  headerSub: {
    marginTop: 1,
    fontSize: 11.5,
    fontWeight: "600",
  },
  headerRightBtns: {
    flexDirection: "row",
    gap: 6,
  },
  iconPill: {
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  threadSearchWrap: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  threadSearchInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  deniedTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  deniedSub: {
    marginTop: 6,
    fontSize: 13,
    textAlign: "center",
  },
  returnBtn: {
    marginTop: 16,
    borderRadius: 13,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  timelineContent: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  loadOlderBtn: {
    alignSelf: "center",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 7,
    marginBottom: 12,
  },
  emptyThreadBox: {
    paddingVertical: 48,
    alignItems: "center",
  },
  dateDividerWrap: {
    alignItems: "center",
    marginVertical: 10,
  },
  dateDividerLabel: {
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  systemRow: {
    alignItems: "center",
    marginVertical: 6,
  },
  systemPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 5,
    fontSize: 11.5,
  },
  messageRowWrap: {
    maxWidth: "84%",
  },
  alignEnd: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  alignStart: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
  },
  senderMiniName: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 2,
    marginLeft: 4,
  },
  bubble: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 13,
    minWidth: 96,
  },
  replyQuoteBox: {
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginBottom: 7,
  },
  attachmentsStack: {
    gap: 6,
    marginBottom: 6,
  },
  imageThumbWrap: {
    borderRadius: 12,
    overflow: "hidden",
  },
  imageThumb: {
    width: 210,
    height: 150,
    borderRadius: 12,
  },
  imageThumbPlaceholder: {
    width: 210,
    height: 150,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  docAttachmentCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 9,
    minWidth: 185,
  },
  messageBodyText: {
    fontSize: 14.5,
    lineHeight: 20,
  },
  deletedText: {
    fontSize: 13,
    fontStyle: "italic",
  },
  metaFooterRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 7,
  },
  metaTime: {
    fontSize: 10.5,
  },
  receiptLabel: {
    fontSize: 10.5,
    fontWeight: "700",
  },
  retryRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  reactionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 4,
  },
  reactionChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  blockedBanner: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  unblockInlineBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  composerContainer: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 7,
  },
  contextBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  progressBarCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 8,
    gap: 6,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  attachBtn: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  composerInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 13,
    paddingVertical: 9,
    maxHeight: 110,
    fontSize: 14.5,
  },
  sendBtn: {
    height: 40,
    borderRadius: 13,
    paddingHorizontal: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnText: {
    color: "#0B0C10",
    fontSize: 13.5,
    fontWeight: "800",
  },
  actionBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.68)",
    justifyContent: "flex-end",
    padding: 16,
  },
  actionSheet: {
    borderWidth: 1,
    borderRadius: 22,
    overflow: "hidden",
  },
  quickEmojiBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  emojiCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetActionRow: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 13.5,
  },
});
