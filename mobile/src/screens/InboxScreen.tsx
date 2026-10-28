import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  filterConversationSummaries,
  formatShortTime,
  type ConversationSummary,
  type InboxFilterKind,
} from "@asterial/core";
import {
  CreateGroupModal,
  NewDirectChatModal,
} from "../components/ConversationModals";
import { NativeAvatar } from "../components/NativeAvatar";
import { useMobileWorkspace } from "../context/MobileWorkspaceContext";

interface MessageSearchHit {
  message_id: string;
  conversation_id: string;
  sender_id: string | null;
  body: string;
  created_at: string;
}

const FILTER_CHIPS: { key: InboxFilterKind; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "direct", label: "Direct" },
  { key: "groups", label: "Groups" },
  { key: "archived", label: "Archived" },
];

export function InboxScreen({
  mode = "all",
  onOpenConversation,
}: {
  mode?: "all" | "groups";
  onOpenConversation: (conversationId: string) => void;
}) {
  const {
    supabase,
    palette,
    density,
    conversations,
    inboxLoading,
    hasMoreConversations,
    onlineUserIds,
    refreshWorkspace,
    loadMoreConversations,
    markConversationRead,
    toggleConversationPin,
    toggleConversationMute,
    toggleConversationArchive,
    startDirectChat,
    createGroupChat,
  } = useMobileWorkspace();

  const [selectedFilter, setSelectedFilter] = useState<InboxFilterKind>(
    mode === "groups" ? "groups" : "all"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [messageHits, setMessageHits] = useState<MessageSearchHit[]>([]);
  const [searchingMessages, setSearchingMessages] = useState(false);

  const [showNewDirect, setShowNewDirect] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [actionTarget, setActionTarget] =
    useState<ConversationSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const activeFilter: InboxFilterKind =
    mode === "groups" && selectedFilter === "all" ? "groups" : selectedFilter;

  const filteredConversations = useMemo(
    () => filterConversationSummaries(conversations, activeFilter, searchQuery),
    [activeFilter, conversations, searchQuery]
  );

  const convTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of conversations) {
      map.set(c.conversation.id, c.displayTitle);
    }
    return map;
  }, [conversations]);

  // Cross-conversation message search via search_messages RPC
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!supabase || trimmed.length < 2) return;

    let active = true;
    const timer = setTimeout(async () => {
      setSearchingMessages(true);
      try {
        const { data } = await supabase.rpc("search_messages", {
          p_query: trimmed,
          p_conversation_id: null,
          p_limit: 12,
        });
        if (active) {
          setMessageHits((data || []) as MessageSearchHit[]);
        }
      } finally {
        if (active) setSearchingMessages(false);
      }
    }, 280);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery, supabase]);

  const visibleHits = searchQuery.trim().length >= 2 ? messageHits : [];

  const handlePullRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshWorkspace();
    } finally {
      setRefreshing(false);
    }
  };

  const compactRow = density === "compact";

  return (
    <View style={[styles.container, { backgroundColor: palette.bgVoid }]}>
      <View
        style={[
          styles.topBar,
          { borderBottomColor: palette.borderSubtle },
        ]}
      >
        <View style={styles.screenHeading}>
          <Text style={[styles.screenTitle, { color: palette.textPrimary }]}>
            {mode === "groups" ? "Groups" : "Messages"}
          </Text>
          <Text style={[styles.screenSubtitle, { color: palette.textMuted }]}>
            {mode === "groups" ? "Your group conversations" : "Your conversations"}
          </Text>
        </View>

        <View style={styles.headerActions}>
          {mode !== "groups" ? (
            <Pressable
              onPress={() => setShowNewDirect(true)}
              accessibilityRole="button"
              accessibilityLabel="New direct message"
              style={[
                styles.headerActionBtn,
                {
                  backgroundColor: palette.bgElevated,
                  borderColor: palette.borderSubtle,
                },
              ]}
            >
              <Text style={{ color: palette.textPrimary, fontWeight: "700", fontSize: 12 }}>
                + Chat
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => setShowNewGroup(true)}
            accessibilityRole="button"
            accessibilityLabel="Create group"
            style={[
              styles.headerActionBtn,
              {
                backgroundColor: palette.accent,
                borderColor: palette.accent,
              },
            ]}
          >
            <Text style={{ color: palette.accentFg, fontWeight: "800", fontSize: 12 }}>
              + Group
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.controlsArea}>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search conversations or messages…"
          placeholderTextColor={palette.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Search conversations and messages"
          style={[
            styles.searchInput,
            {
              backgroundColor: palette.bgSurface,
              borderColor: palette.borderSubtle,
              color: palette.textPrimary,
            },
          ]}
        />

        {mode !== "groups" ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {FILTER_CHIPS.map((chip) => {
              const selected = activeFilter === chip.key;
              return (
                <Pressable
                  key={chip.key}
                  onPress={() => setSelectedFilter(chip.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: selected
                        ? palette.accent
                        : palette.bgSurface,
                      borderColor: selected
                        ? palette.accent
                        : palette.borderSubtle,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: selected ? palette.accentFg : palette.textSecondary,
                    }}
                  >
                    {chip.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
      </View>

      {visibleHits.length > 0 || searchingMessages ? (
        <View
          style={[
            styles.messageHitsBox,
            {
              backgroundColor: palette.bgSurface,
              borderColor: palette.borderSubtle,
            },
          ]}
        >
          <View style={styles.hitsHeader}>
            <Text style={[styles.hitsTitle, { color: palette.accent }]}>
              MATCHING MESSAGES ({visibleHits.length})
            </Text>
            {searchingMessages ? (
              <ActivityIndicator color={palette.accent} size="small" />
            ) : null}
          </View>
          {visibleHits.slice(0, 4).map((hit) => (
            <Pressable
              key={hit.message_id}
              onPress={() => onOpenConversation(hit.conversation_id)}
              style={[
                styles.hitRow,
                { borderTopColor: palette.borderSubtle },
              ]}
            >
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: palette.textPrimary,
                }}
              >
                {convTitleMap.get(hit.conversation_id) || "Conversation"} ·{" "}
                {formatShortTime(hit.created_at)}
              </Text>
              <Text
                numberOfLines={1}
                style={{ fontSize: 12, color: palette.textSecondary }}
              >
                {hit.body}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item.conversation.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void handlePullRefresh()}
            tintColor={palette.accent}
          />
        }
        onEndReachedThreshold={0.35}
        onEndReached={() => {
          if (hasMoreConversations && !inboxLoading) {
            void loadMoreConversations();
          }
        }}
        contentContainerStyle={
          filteredConversations.length === 0 ? styles.emptyContainer : undefined
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>
              {searchQuery.trim()
                ? "No matching conversations"
                : activeFilter === "archived"
                ? "No archived threads"
                : mode === "groups"
                ? "No groups yet"
                : "Your inbox is ready"}
            </Text>
            <Text style={[styles.emptySub, { color: palette.textSecondary }]}>
              {searchQuery.trim()
                ? "Try searching a different @username or keyword."
                : mode === "groups"
                ? "Create a group to collaborate with roles, replies, attachments, and reactions."
                : "Start a private 1:1 message or create a group conversation."}
            </Text>
            {!searchQuery.trim() && activeFilter !== "archived" ? (
              <View style={styles.emptyActionsRow}>
                {mode !== "groups" ? (
                  <Pressable
                    onPress={() => setShowNewDirect(true)}
                    style={[
                      styles.emptyBtn,
                      { backgroundColor: palette.accent },
                    ]}
                  >
                    <Text style={[styles.emptyBtnPrimaryText, { color: palette.accentFg }]}>
                      Start Direct Message
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => setShowNewGroup(true)}
                  style={[
                    styles.emptyBtnOutline,
                    {
                      backgroundColor: palette.bgSurface,
                      borderColor: palette.borderSubtle,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: palette.textPrimary,
                      fontWeight: "700",
                      fontSize: 13,
                    }}
                  >
                    Create Group
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const unread = item.membership.unread_count;
          const peerOnline = item.peerProfile
            ? onlineUserIds.has(item.peerProfile.id)
            : undefined;
          const timeStamp = formatShortTime(
            item.conversation.last_message_at || item.conversation.created_at
          );

          return (
            <Pressable
              onPress={() => onOpenConversation(item.conversation.id)}
              onLongPress={() => setActionTarget(item)}
              delayLongPress={260}
              accessibilityRole="button"
              accessibilityLabel={`Open conversation with ${item.displayTitle}`}
              style={[
                styles.convRow,
                {
                  paddingVertical: compactRow ? 10 : 13,
                  borderBottomColor: palette.borderSubtle,
                  backgroundColor:
                    unread > 0 ? `${palette.bgSurface}DD` : "transparent",
                },
              ]}
            >
              <NativeAvatar
                supabase={supabase}
                storagePath={item.displayAvatarPath}
                label={item.displayTitle}
                palette={palette}
                size={compactRow ? 42 : 48}
                isGroup={item.conversation.type === "group"}
                isOnline={peerOnline}
              />

              <View style={styles.convBody}>
                <View style={styles.convTopLine}>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.convTitle,
                      {
                        color: palette.textPrimary,
                        fontWeight: unread > 0 ? "800" : "700",
                      },
                    ]}
                  >
                    {item.membership.pinned ? "📌 " : ""}
                    {item.displayTitle}
                    {item.membership.is_muted ? " 🔕" : ""}
                  </Text>
                  <Text
                    style={[
                      styles.convTime,
                      {
                        color:
                          unread > 0 ? palette.accent : palette.textMuted,
                      },
                    ]}
                  >
                    {timeStamp}
                  </Text>
                </View>

                <View style={styles.convBottomLine}>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.convPreview,
                      {
                        color:
                          unread > 0
                            ? palette.textPrimary
                            : palette.textSecondary,
                        fontWeight: unread > 0 ? "600" : "400",
                      },
                    ]}
                  >
                    {item.conversation.last_message_preview ||
                      item.displaySubtitle}
                  </Text>

                  {unread > 0 ? (
                    <View
                      style={[
                        styles.unreadBadge,
                        { backgroundColor: palette.accent },
                      ]}
                    >
                      <Text style={[styles.unreadText, { color: palette.accentFg }]}>
                        {unread > 99 ? "99+" : unread}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        }}
        ListFooterComponent={
          inboxLoading && conversations.length > 0 ? (
            <View style={{ paddingVertical: 14 }}>
              <ActivityIndicator color={palette.accent} size="small" />
            </View>
          ) : null
        }
      />

      <NewDirectChatModal
        visible={showNewDirect}
        supabase={supabase}
        palette={palette}
        onlineUserIds={onlineUserIds}
        onClose={() => setShowNewDirect(false)}
        onStartDirect={startDirectChat}
        onCreatedConversation={onOpenConversation}
      />

      <CreateGroupModal
        visible={showNewGroup}
        supabase={supabase}
        palette={palette}
        onClose={() => setShowNewGroup(false)}
        onCreateGroup={createGroupChat}
        onCreatedConversation={onOpenConversation}
      />

      {/* Long-press Conversation Action Sheet */}
      <Modal
        visible={Boolean(actionTarget)}
        transparent
        animationType="fade"
        onRequestClose={() => setActionTarget(null)}
      >
        <Pressable
          style={styles.actionBackdrop}
          onPress={() => setActionTarget(null)}
        >
          {actionTarget ? (
            <View
              style={[
                styles.actionSheet,
                {
                  backgroundColor: palette.bgSurface,
                  borderColor: palette.borderSubtle,
                },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[styles.actionTitle, { color: palette.textPrimary }]}
              >
                {actionTarget.displayTitle}
              </Text>

              <Pressable
                onPress={() => {
                  const target = actionTarget;
                  setActionTarget(null);
                  void toggleConversationPin(
                    target.conversation.id,
                    !target.membership.pinned
                  );
                }}
                style={[
                  styles.actionItem,
                  { borderTopColor: palette.borderSubtle },
                ]}
              >
                <Text style={{ color: palette.textPrimary, fontWeight: "600" }}>
                  {actionTarget.membership.pinned
                    ? "Unpin Conversation"
                    : "Pin to Top"}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  const target = actionTarget;
                  setActionTarget(null);
                  void toggleConversationMute(
                    target.conversation.id,
                    !target.membership.is_muted
                  );
                }}
                style={[
                  styles.actionItem,
                  { borderTopColor: palette.borderSubtle },
                ]}
              >
                <Text style={{ color: palette.textPrimary, fontWeight: "600" }}>
                  {actionTarget.membership.is_muted
                    ? "Unmute Notifications"
                    : "Mute Notifications"}
                </Text>
              </Pressable>

              {actionTarget.membership.unread_count > 0 ? (
                <Pressable
                  onPress={() => {
                    const target = actionTarget;
                    setActionTarget(null);
                    void markConversationRead(target.conversation.id);
                  }}
                  style={[
                    styles.actionItem,
                    { borderTopColor: palette.borderSubtle },
                  ]}
                >
                  <Text
                    style={{ color: palette.textPrimary, fontWeight: "600" }}
                  >
                    Mark as Read
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                onPress={() => {
                  const target = actionTarget;
                  setActionTarget(null);
                  void toggleConversationArchive(
                    target.conversation.id,
                    !target.membership.archived
                  );
                }}
                style={[
                  styles.actionItem,
                  { borderTopColor: palette.borderSubtle },
                ]}
              >
                <Text style={{ color: palette.accent, fontWeight: "700" }}>
                  {actionTarget.membership.archived
                    ? "Restore to Inbox"
                    : "Archive Conversation"}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  screenHeading: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  screenTitle: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "800",
    letterSpacing: -0.35,
  },
  screenSubtitle: {
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: "500",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerActionBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  controlsArea: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 9.5,
    fontSize: 13.5,
  },
  filterRow: {
    paddingTop: 9,
    paddingBottom: 3,
    gap: 7,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 6,
  },
  messageHitsBox: {
    marginHorizontal: 16,
    marginBottom: 6,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  hitsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  hitsTitle: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  hitRow: {
    borderTopWidth: 1,
    paddingVertical: 6,
    gap: 1,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  emptyCard: {
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  emptySub: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    maxWidth: 300,
  },
  emptyActionsRow: {
    marginTop: 16,
    flexDirection: "row",
    gap: 10,
  },
  emptyBtn: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  emptyBtnPrimaryText: {
    color: "#0B0C10",
    fontWeight: "800",
    fontSize: 13,
  },
  emptyBtnOutline: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  convRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  convBody: {
    flex: 1,
  },
  convTopLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  convTitle: {
    flex: 1,
    fontSize: 15,
  },
  convTime: {
    fontSize: 11.5,
    fontWeight: "600",
  },
  convBottomLine: {
    marginTop: 3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  convPreview: {
    flex: 1,
    fontSize: 13,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadText: {
    color: "#0B0C10",
    fontSize: 11,
    fontWeight: "800",
  },
  actionBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
    padding: 16,
  },
  actionSheet: {
    borderWidth: 1,
    borderRadius: 22,
    overflow: "hidden",
  },
  actionTitle: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: "800",
  },
  actionItem: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 13.5,
  },
});
