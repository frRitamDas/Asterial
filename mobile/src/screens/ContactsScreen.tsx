import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ASTERIAL_BRAND, formatLastSeen } from "@asterial/core";
import { BrandLockup } from "../components/AsterialEmblem";
import { NativeAvatar } from "../components/NativeAvatar";
import { ReportModal } from "../components/ReportModal";
import {
  UserProfileSheet,
  type InspectableUserProfile,
} from "../components/UserProfileSheet";
import { useMobileWorkspace } from "../context/MobileWorkspaceContext";
import { primePrivateSignedUrls } from "../lib/storage";

export function ContactsScreen({
  onOpenConversation,
}: {
  onOpenConversation: (conversationId: string) => void;
}) {
  const {
    supabase,
    user,
    profile,
    palette,
    conversations,
    onlineUserIds,
    blockedIds,
    startDirectChat,
    toggleBlockUser,
    submitReport,
    showToast,
  } = useMobileWorkspace();

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<InspectableUserProfile[]>(
    []
  );
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] =
    useState<InspectableUserProfile | null>(null);
  const [reportTarget, setReportTarget] = useState<{
    id: string;
    label: string;
  } | null>(null);

  const recentDirectPeers = useMemo<InspectableUserProfile[]>(() => {
    const map = new Map<string, InspectableUserProfile>();
    for (const c of conversations) {
      if (c.conversation.type === "direct" && c.peerProfile) {
        map.set(c.peerProfile.id, {
          id: c.peerProfile.id,
          username: c.peerProfile.username,
          display_name: c.peerProfile.display_name,
          avatar_url: c.peerProfile.avatar_url,
          bio: c.peerProfile.bio,
          status_text: c.peerProfile.status_text,
          last_seen_at: c.peerLastSeenAt,
        });
      }
    }
    return Array.from(map.values());
  }, [conversations]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!supabase || !trimmed) return;

    let active = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await supabase.rpc("search_users", {
          p_query: trimmed,
          p_limit: 25,
        });
        if (!active) return;
        const rows = (data || []) as InspectableUserProfile[];
        await primePrivateSignedUrls(
          supabase,
          "avatars",
          rows.map((r) => r.avatar_url)
        );
        if (active) setSearchResults(rows);
      } finally {
        if (active) setSearching(false);
      }
    }, 240);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, supabase]);

  const listItems = query.trim() ? searchResults : recentDirectPeers;

  const handleShareInvite = async () => {
    const handlePart = profile?.username ? ` (@${profile.username})` : "";
    await Share.share({
      message: `Message me on ${ASTERIAL_BRAND.name}${handlePart}: ${ASTERIAL_BRAND.productionUrl}`,
    }).catch(() => undefined);
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.bgVoid }]}>
      <View
        style={[
          styles.topBar,
          { borderBottomColor: palette.borderSubtle },
        ]}
      >
        <BrandLockup palette={palette} compact subtitle="People & Directory" />
        <Pressable
          onPress={() => void handleShareInvite()}
          style={[
            styles.inviteBtn,
            {
              backgroundColor: palette.bgElevated,
              borderColor: palette.borderSubtle,
            },
          ]}
        >
          <Text style={{ color: palette.accent, fontWeight: "800", fontSize: 12 }}>
            Share Invite
          </Text>
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search people by @username or display name…"
          placeholderTextColor={palette.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          style={[
            styles.searchInput,
            {
              backgroundColor: palette.bgSurface,
              borderColor: palette.borderSubtle,
              color: palette.textPrimary,
            },
          ]}
        />
      </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionLabel, { color: palette.textMuted }]}>
          {query.trim() ? "SEARCH RESULTS" : "RECENT CONTACTS"}
        </Text>
        {searching ? (
          <ActivityIndicator color={palette.accent} size="small" />
        ) : null}
      </View>

      <FlatList
        data={listItems}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={
          listItems.length === 0 ? styles.emptyContainer : undefined
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>
              {query.trim()
                ? "No matching people found"
                : "Find contacts by @username"}
            </Text>
            <Text style={[styles.emptySub, { color: palette.textSecondary }]}>
              {query.trim()
                ? "Check the spelling of their @username or share your ASTERIAL invite link."
                : "Type any @username above to view their profile or start a private direct message."}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const online = onlineUserIds.has(item.id);
          const blocked = blockedIds.has(item.id);
          return (
            <Pressable
              onPress={() => setSelectedUser(item)}
              style={[
                styles.contactRow,
                { borderBottomColor: palette.borderSubtle },
              ]}
            >
              <NativeAvatar
                supabase={supabase}
                storagePath={item.avatar_url}
                label={item.display_name || item.username}
                palette={palette}
                size={46}
                isOnline={online}
              />

              <View style={styles.metaCol}>
                <Text
                  numberOfLines={1}
                  style={[styles.nameText, { color: palette.textPrimary }]}
                >
                  {item.display_name || item.username}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[styles.subText, { color: palette.textSecondary }]}
                >
                  @{item.username} ·{" "}
                  {blocked
                    ? "Blocked"
                    : online
                    ? "Online"
                    : formatLastSeen(item.last_seen_at)}
                </Text>
              </View>

              {!blocked ? (
                <Pressable
                  onPress={() => {
                    void startDirectChat(item.id)
                      .then((convId) => onOpenConversation(convId))
                      .catch((err) =>
                        showToast(
                          err instanceof Error
                            ? err.message
                            : "Could not open chat.",
                          "error"
                        )
                      );
                  }}
                  style={[
                    styles.msgBtn,
                    {
                      backgroundColor: palette.accentSoft,
                      borderColor: `${palette.accent}55`,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: palette.accent,
                      fontSize: 12,
                      fontWeight: "800",
                    }}
                  >
                    Message
                  </Text>
                </Pressable>
              ) : null}
            </Pressable>
          );
        }}
      />

      <UserProfileSheet
        visible={Boolean(selectedUser)}
        userProfile={selectedUser}
        currentUserId={user?.id || null}
        supabase={supabase}
        palette={palette}
        isOnline={Boolean(selectedUser && onlineUserIds.has(selectedUser.id))}
        isBlocked={Boolean(selectedUser && blockedIds.has(selectedUser.id))}
        onClose={() => setSelectedUser(null)}
        onMessageUser={async (targetId) => {
          const convId = await startDirectChat(targetId);
          onOpenConversation(convId);
        }}
        onToggleBlock={async (targetId) => {
          await toggleBlockUser(targetId);
        }}
        onOpenReport={(targetId, label) =>
          setReportTarget({ id: targetId, label })
        }
      />

      <ReportModal
        visible={Boolean(reportTarget)}
        palette={palette}
        subjectLabel={reportTarget?.label || "user"}
        onClose={() => setReportTarget(null)}
        onSubmit={async (reason, details) => {
          await submitReport({
            reportedUserId: reportTarget?.id ?? null,
            reason,
            details,
          });
        }}
      />
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
  inviteBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 10,
    fontSize: 13.5,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  emptyBox: {
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  emptySub: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    maxWidth: 290,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  metaCol: {
    flex: 1,
  },
  nameText: {
    fontSize: 15,
    fontWeight: "700",
  },
  subText: {
    marginTop: 2,
    fontSize: 12.5,
  },
  msgBtn: {
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
});
