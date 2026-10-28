import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  canActorRemoveGroupMember,
  canManageGroupSettings,
  formatLastSeen,
  groupCreateSchema,
  type ConversationMemberRow,
  type ConversationRow,
  type ProfileRow,
  type ThemePalette,
} from "@asterial/core";
import {
  buildAvatarStoragePath,
  pickAndValidateNativeFile,
  primePrivateSignedUrls,
  uploadValidatedNativeFile,
} from "../lib/storage";
import { NativeAvatar } from "./NativeAvatar";

interface DirectorySearchResult {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string;
  status_text: string;
  last_seen_at: string | null;
}

export interface HydratedGroupMember extends ConversationMemberRow {
  profile: ProfileRow | null;
}

export function NewDirectChatModal({
  visible,
  supabase,
  palette,
  onlineUserIds,
  onClose,
  onStartDirect,
  onCreatedConversation,
}: {
  visible: boolean;
  supabase: SupabaseClient | null;
  palette: ThemePalette;
  onlineUserIds: Set<string>;
  onClose: () => void;
  onStartDirect: (targetUserId: string) => Promise<string>;
  onCreatedConversation: (conversationId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DirectorySearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !supabase) return;
    const trimmed = query.trim();
    if (!trimmed) return;

    let active = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      setErrorText(null);
      try {
        const { data, error } = await supabase.rpc("search_users", {
          p_query: trimmed,
          p_limit: 20,
        });
        if (!active) return;
        if (error) {
          setErrorText(error.message);
          setResults([]);
          return;
        }
        const rows = (data || []) as DirectorySearchResult[];
        await primePrivateSignedUrls(
          supabase,
          "avatars",
          rows.map((r) => r.avatar_url)
        );
        if (active) setResults(rows);
      } finally {
        if (active) setSearching(false);
      }
    }, 240);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, supabase, visible]);

  const displayedResults = query.trim() ? results : [];

  const handleSelect = async (targetUserId: string) => {
    setStartingId(targetUserId);
    setErrorText(null);
    try {
      const convId = await onStartDirect(targetUserId);
      setQuery("");
      setResults([]);
      onClose();
      onCreatedConversation(convId);
    } catch (err) {
      setErrorText(
        err instanceof Error ? err.message : "Could not start direct message."
      );
    } finally {
      setStartingId(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: palette.bgSurface,
              borderColor: palette.borderSubtle,
            },
          ]}
        >
          <View style={styles.sheetTopRow}>
            <View>
              <Text style={[styles.eyebrow, { color: palette.accent }]}>
                DIRECT MESSAGE
              </Text>
              <Text style={[styles.sheetTitle, { color: palette.textPrimary }]}>
                Start a 1:1 Conversation
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={{ color: palette.textSecondary, fontWeight: "700" }}>
                Close
              </Text>
            </Pressable>
          </View>

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by @username or display name…"
            placeholderTextColor={palette.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            style={[
              styles.input,
              {
                backgroundColor: palette.bgElevated,
                borderColor: palette.borderSubtle,
                color: palette.textPrimary,
              },
            ]}
          />

          {errorText ? (
            <Text style={[styles.errorText, { color: palette.danger }]}>
              {errorText}
            </Text>
          ) : null}

          <ScrollView style={styles.resultScroll} keyboardShouldPersistTaps="handled">
            {searching ? (
              <View style={styles.centerBox}>
                <ActivityIndicator color={palette.accent} />
              </View>
            ) : !query.trim() ? (
              <Text style={[styles.emptyHint, { color: palette.textMuted }]}>
                Type a handle or name to find people on ASTERIAL.
              </Text>
            ) : displayedResults.length === 0 ? (
              <Text style={[styles.emptyHint, { color: palette.textMuted }]}>
                No matching accounts found.
              </Text>
            ) : (
              displayedResults.map((item) => (
                <Pressable
                  key={item.id}
                  disabled={startingId !== null}
                  onPress={() => void handleSelect(item.id)}
                  style={[
                    styles.userRow,
                    { borderBottomColor: palette.borderSubtle },
                  ]}
                >
                  <NativeAvatar
                    supabase={supabase}
                    storagePath={item.avatar_url}
                    label={item.display_name || item.username}
                    palette={palette}
                    size={42}
                    isOnline={onlineUserIds.has(item.id)}
                  />
                  <View style={styles.userMeta}>
                    <Text
                      numberOfLines={1}
                      style={[styles.userName, { color: palette.textPrimary }]}
                    >
                      {item.display_name || item.username}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[styles.userHandle, { color: palette.textSecondary }]}
                    >
                      @{item.username}
                    </Text>
                  </View>
                  {startingId === item.id ? (
                    <ActivityIndicator color={palette.accent} size="small" />
                  ) : (
                    <Text
                      style={{
                        color: palette.accent,
                        fontWeight: "700",
                        fontSize: 12.5,
                      }}
                    >
                      Message
                    </Text>
                  )}
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function CreateGroupModal({
  visible,
  supabase,
  palette,
  onClose,
  onCreateGroup,
  onCreatedConversation,
}: {
  visible: boolean;
  supabase: SupabaseClient | null;
  palette: ThemePalette;
  onClose: () => void;
  onCreateGroup: (
    name: string,
    description: string,
    memberIds: string[]
  ) => Promise<string>;
  onCreatedConversation: (conversationId: string) => void;
}) {
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<DirectorySearchResult[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<DirectorySearchResult[]>(
    []
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !supabase) return;
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    let active = true;
    const timer = setTimeout(async () => {
      const { data } = await supabase.rpc("search_users", {
        p_query: trimmed,
        p_limit: 15,
      });
      if (!active) return;
      const rows = (data || []) as DirectorySearchResult[];
      await primePrivateSignedUrls(
        supabase,
        "avatars",
        rows.map((r) => r.avatar_url)
      );
      if (active) setResults(rows);
    }, 240);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery, supabase, visible]);

  const toggleSelectUser = (u: DirectorySearchResult) => {
    setSelectedUsers((prev) =>
      prev.some((x) => x.id === u.id)
        ? prev.filter((x) => x.id !== u.id)
        : [...prev, u]
    );
  };

  const handleCreate = async () => {
    setErrorText(null);
    const parsed = groupCreateSchema.safeParse({
      name: groupName,
      description: groupDesc,
      memberIds: selectedUsers.map((u) => u.id),
    });

    if (!parsed.success) {
      setErrorText(parsed.error.issues[0]?.message || "Check group details.");
      return;
    }

    setSubmitting(true);
    try {
      const convId = await onCreateGroup(
        parsed.data.name,
        parsed.data.description,
        parsed.data.memberIds
      );
      setGroupName("");
      setGroupDesc("");
      setSearchQuery("");
      setSelectedUsers([]);
      onClose();
      onCreatedConversation(convId);
    } catch (err) {
      setErrorText(
        err instanceof Error ? err.message : "Could not create group."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const visibleResults = searchQuery.trim() ? results : [];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: palette.bgSurface,
              borderColor: palette.borderSubtle,
            },
          ]}
        >
          <View style={styles.sheetTopRow}>
            <View>
              <Text style={[styles.eyebrow, { color: palette.accent }]}>
                NEW GROUP
              </Text>
              <Text style={[styles.sheetTitle, { color: palette.textPrimary }]}>
                Create Group Conversation
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={{ color: palette.textSecondary, fontWeight: "700" }}>
                Close
              </Text>
            </Pressable>
          </View>

          <TextInput
            value={groupName}
            onChangeText={setGroupName}
            placeholder="Group name (required)"
            placeholderTextColor={palette.textMuted}
            maxLength={80}
            style={[
              styles.input,
              {
                backgroundColor: palette.bgElevated,
                borderColor: palette.borderSubtle,
                color: palette.textPrimary,
              },
            ]}
          />

          <TextInput
            value={groupDesc}
            onChangeText={setGroupDesc}
            placeholder="Optional description"
            placeholderTextColor={palette.textMuted}
            maxLength={300}
            style={[
              styles.input,
              {
                backgroundColor: palette.bgElevated,
                borderColor: palette.borderSubtle,
                color: palette.textPrimary,
              },
            ]}
          />

          {selectedUsers.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipsScroll}
            >
              {selectedUsers.map((u) => (
                <Pressable
                  key={u.id}
                  onPress={() => toggleSelectUser(u)}
                  style={[
                    styles.memberChip,
                    {
                      backgroundColor: palette.accentSoft,
                      borderColor: `${palette.accent}55`,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: palette.accent }]}>
                    @{u.username} ✕
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search members to invite (@username)…"
            placeholderTextColor={palette.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            style={[
              styles.input,
              {
                backgroundColor: palette.bgElevated,
                borderColor: palette.borderSubtle,
                color: palette.textPrimary,
              },
            ]}
          />

          <ScrollView
            style={styles.compactResultScroll}
            keyboardShouldPersistTaps="handled"
          >
            {visibleResults.map((item) => {
              const chosen = selectedUsers.some((u) => u.id === item.id);
              return (
                <Pressable
                  key={item.id}
                  onPress={() => toggleSelectUser(item)}
                  style={[
                    styles.userRow,
                    { borderBottomColor: palette.borderSubtle },
                  ]}
                >
                  <NativeAvatar
                    supabase={supabase}
                    storagePath={item.avatar_url}
                    label={item.display_name || item.username}
                    palette={palette}
                    size={36}
                  />
                  <View style={styles.userMeta}>
                    <Text style={[styles.userName, { color: palette.textPrimary }]}>
                      {item.display_name || item.username}
                    </Text>
                    <Text
                      style={[
                        styles.userHandle,
                        { color: palette.textSecondary },
                      ]}
                    >
                      @{item.username}
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: chosen ? palette.success : palette.accent,
                      fontWeight: "700",
                      fontSize: 12.5,
                    }}
                  >
                    {chosen ? "Selected ✓" : "Add"}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {errorText ? (
            <Text style={[styles.errorText, { color: palette.danger }]}>
              {errorText}
            </Text>
          ) : null}

          <Pressable
            onPress={() => void handleCreate()}
            disabled={submitting || !groupName.trim()}
            style={[
              styles.primaryBtn,
              {
                backgroundColor: palette.accent,
                opacity: submitting || !groupName.trim() ? 0.5 : 1,
              },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color={palette.accentFg} size="small" />
            ) : (
              <Text style={[styles.primaryBtnText, { color: palette.accentFg }]}>
                Create Group ({selectedUsers.length + 1} members)
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export function ConversationInfoModal({
  visible,
  conversation,
  members,
  currentUserId,
  peerProfile,
  peerLastSeenAt,
  isBlockedPeer,
  supabase,
  palette,
  onlineUserIds,
  onClose,
  onUpdatedConversation,
  onLeftGroup,
  onToggleBlockPeer,
  onOpenReport,
}: {
  visible: boolean;
  conversation: ConversationRow | null;
  members: HydratedGroupMember[];
  currentUserId: string | null;
  peerProfile: ProfileRow | null;
  peerLastSeenAt: string | null;
  isBlockedPeer: boolean;
  supabase: SupabaseClient | null;
  palette: ThemePalette;
  onlineUserIds: Set<string>;
  onClose: () => void;
  onUpdatedConversation: () => Promise<void>;
  onLeftGroup: () => void;
  onToggleBlockPeer: (peerId: string) => Promise<void>;
  onOpenReport: (params: { userId?: string; label: string }) => void;
}) {
  const [editingDetails, setEditingDetails] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteResults, setInviteResults] = useState<DirectorySearchResult[]>(
    []
  );
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !supabase || conversation?.type !== "group") return;
    const trimmed = inviteQuery.trim();
    if (!trimmed) return;

    let active = true;
    const timer = setTimeout(async () => {
      const { data } = await supabase.rpc("search_users", {
        p_query: trimmed,
        p_limit: 10,
      });
      if (!active) return;
      const existingIds = new Set(members.map((m) => m.user_id));
      const filtered = ((data || []) as DirectorySearchResult[]).filter(
        (u) => !existingIds.has(u.id)
      );
      if (active) setInviteResults(filtered);
    }, 240);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [conversation?.type, inviteQuery, members, supabase, visible]);

  if (!conversation) return null;

  const myMembership =
    members.find((m) => m.user_id === currentUserId) || null;
  const canEditGroup =
    conversation.type === "group" && canManageGroupSettings(myMembership?.role);
  const isOwner = myMembership?.role === "owner";

  const beginEditDetails = () => {
    setDraftName(conversation.name || "");
    setDraftDesc(conversation.description || "");
    setEditingDetails(true);
  };

  const handleSaveDetails = async () => {
    if (!supabase) return;
    const cleanName = draftName.trim();
    if (!cleanName) {
      setErrorText("Group name cannot be empty.");
      return;
    }
    setBusyMessage("Saving group details…");
    setErrorText(null);
    try {
      const { error } = await supabase.rpc("update_group_details", {
        p_conversation_id: conversation.id,
        p_name: cleanName,
        p_description: draftDesc.trim(),
        p_avatar_url: conversation.avatar_url,
      });
      if (error) throw new Error(error.message);
      setEditingDetails(false);
      await onUpdatedConversation();
    } catch (err) {
      setErrorText(
        err instanceof Error ? err.message : "Could not update group."
      );
    } finally {
      setBusyMessage(null);
    }
  };

  const handleUploadGroupAvatar = async () => {
    if (!supabase) return;
    setErrorText(null);
    try {
      const picked = await pickAndValidateNativeFile("avatar");
      if (!picked) return;
      setBusyMessage("Uploading group avatar…");
      const storagePath = buildAvatarStoragePath(
        conversation.id,
        picked.fileName
      );
      await uploadValidatedNativeFile({
        supabase,
        bucket: "avatars",
        storagePath,
        file: picked,
        upsert: true,
      });
      const { error } = await supabase.rpc("update_group_details", {
        p_conversation_id: conversation.id,
        p_name: conversation.name || "Group",
        p_description: conversation.description || "",
        p_avatar_url: storagePath,
      });
      if (error) throw new Error(error.message);
      await primePrivateSignedUrls(supabase, "avatars", [storagePath]);
      await onUpdatedConversation();
    } catch (err) {
      setErrorText(
        err instanceof Error ? err.message : "Could not upload group avatar."
      );
    } finally {
      setBusyMessage(null);
    }
  };

  const handleAddMember = async (targetUserId: string) => {
    if (!supabase) return;
    setBusyMessage("Adding member…");
    setErrorText(null);
    try {
      const { error } = await supabase.rpc("add_group_members", {
        p_conversation_id: conversation.id,
        p_member_ids: [targetUserId],
      });
      if (error) throw new Error(error.message);
      setInviteQuery("");
      setInviteResults([]);
      await onUpdatedConversation();
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : "Could not add member.");
    } finally {
      setBusyMessage(null);
    }
  };

  const handleRoleToggle = async (
    targetUserId: string,
    currentRole: string
  ) => {
    if (!supabase) return;
    const nextRole = currentRole === "admin" ? "member" : "admin";
    setBusyMessage("Updating member role…");
    setErrorText(null);
    try {
      const { error } = await supabase.rpc("update_group_member_role", {
        p_conversation_id: conversation.id,
        p_target_user_id: targetUserId,
        p_new_role: nextRole,
      });
      if (error) throw new Error(error.message);
      await onUpdatedConversation();
    } catch (err) {
      setErrorText(
        err instanceof Error ? err.message : "Could not update role."
      );
    } finally {
      setBusyMessage(null);
    }
  };

  const handleRemoveMember = async (targetUserId: string) => {
    if (!supabase) return;
    setBusyMessage("Removing member…");
    setErrorText(null);
    try {
      const { error } = await supabase.rpc("remove_group_member", {
        p_conversation_id: conversation.id,
        p_target_user_id: targetUserId,
      });
      if (error) throw new Error(error.message);
      await onUpdatedConversation();
    } catch (err) {
      setErrorText(
        err instanceof Error ? err.message : "Could not remove member."
      );
    } finally {
      setBusyMessage(null);
    }
  };

  const handleLeaveGroup = async () => {
    if (!supabase) return;
    setBusyMessage("Leaving group…");
    setErrorText(null);
    try {
      const { error } = await supabase.rpc("leave_group_conversation", {
        p_conversation_id: conversation.id,
      });
      if (error) throw new Error(error.message);
      onClose();
      onLeftGroup();
    } catch (err) {
      setErrorText(
        err instanceof Error ? err.message : "Could not leave group."
      );
    } finally {
      setBusyMessage(null);
    }
  };

  const title =
    conversation.type === "group"
      ? conversation.name || "Untitled Group"
      : peerProfile?.display_name || peerProfile?.username || "Direct Chat";

  const avatarPath =
    conversation.type === "group"
      ? conversation.avatar_url
      : peerProfile?.avatar_url || null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheetLarge,
            {
              backgroundColor: palette.bgSurface,
              borderColor: palette.borderSubtle,
            },
          ]}
        >
          <View style={styles.sheetTopRow}>
            <Text style={[styles.eyebrow, { color: palette.accent }]}>
              {conversation.type === "group"
                ? "GROUP ADMINISTRATION"
                : "DIRECT CONVERSATION"}
            </Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={{ color: palette.textSecondary, fontWeight: "700" }}>
                Done
              </Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.infoHeaderCenter}>
              <NativeAvatar
                supabase={supabase}
                storagePath={avatarPath}
                label={title}
                palette={palette}
                size={68}
                isGroup={conversation.type === "group"}
                isOnline={
                  peerProfile ? onlineUserIds.has(peerProfile.id) : undefined
                }
              />
              {canEditGroup ? (
                <Pressable
                  onPress={() => void handleUploadGroupAvatar()}
                  style={[
                    styles.smallGhostBtn,
                    { borderColor: palette.borderSubtle },
                  ]}
                >
                  <Text
                    style={{
                      color: palette.accent,
                      fontSize: 12,
                      fontWeight: "700",
                    }}
                  >
                    Change Group Photo
                  </Text>
                </Pressable>
              ) : null}

              <Text style={[styles.infoMainTitle, { color: palette.textPrimary }]}>
                {title}
              </Text>

              {conversation.type === "direct" && peerProfile ? (
                <>
                  <Text style={{ color: palette.accent, fontWeight: "700" }}>
                    @{peerProfile.username}
                  </Text>
                  <Text
                    style={{
                      marginTop: 3,
                      fontSize: 12,
                      color: palette.textMuted,
                    }}
                  >
                    {onlineUserIds.has(peerProfile.id)
                      ? "Online now"
                      : formatLastSeen(peerLastSeenAt)}
                  </Text>
                  {peerProfile.bio ? (
                    <Text
                      style={{
                        marginTop: 8,
                        fontSize: 13,
                        color: palette.textSecondary,
                        textAlign: "center",
                      }}
                    >
                      {peerProfile.bio}
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text
                  style={{
                    marginTop: 4,
                    fontSize: 12.5,
                    color: palette.textSecondary,
                    textAlign: "center",
                  }}
                >
                  {conversation.description ||
                    `${members.length} active members`}
                </Text>
              )}
            </View>

            {busyMessage ? (
              <View style={styles.busyBanner}>
                <ActivityIndicator color={palette.accent} size="small" />
                <Text
                  style={{
                    color: palette.textSecondary,
                    fontSize: 12.5,
                    fontWeight: "600",
                  }}
                >
                  {busyMessage}
                </Text>
              </View>
            ) : null}

            {errorText ? (
              <Text style={[styles.errorText, { color: palette.danger }]}>
                {errorText}
              </Text>
            ) : null}

            {conversation.type === "group" && canEditGroup ? (
              <View style={styles.sectionBlock}>
                {editingDetails ? (
                  <>
                    <TextInput
                      value={draftName}
                      onChangeText={setDraftName}
                      placeholder="Group name"
                      placeholderTextColor={palette.textMuted}
                      style={[
                        styles.input,
                        {
                          backgroundColor: palette.bgElevated,
                          borderColor: palette.borderSubtle,
                          color: palette.textPrimary,
                        },
                      ]}
                    />
                    <TextInput
                      value={draftDesc}
                      onChangeText={setDraftDesc}
                      placeholder="Group description"
                      placeholderTextColor={palette.textMuted}
                      style={[
                        styles.input,
                        {
                          backgroundColor: palette.bgElevated,
                          borderColor: palette.borderSubtle,
                          color: palette.textPrimary,
                        },
                      ]}
                    />
                    <View style={styles.inlineRow}>
                      <Pressable
                        onPress={() => setEditingDetails(false)}
                        style={[
                          styles.halfBtn,
                          { borderColor: palette.borderSubtle },
                        ]}
                      >
                        <Text style={{ color: palette.textSecondary }}>
                          Cancel
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => void handleSaveDetails()}
                        style={[
                          styles.halfBtn,
                          {
                            backgroundColor: palette.accent,
                            borderColor: palette.accent,
                          },
                        ]}
                      >
                        <Text style={{ color: palette.accentFg, fontWeight: "800" }}>
                          Save
                        </Text>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <Pressable
                    onPress={beginEditDetails}
                    style={[
                      styles.outlineActionBtn,
                      {
                        backgroundColor: palette.bgElevated,
                        borderColor: palette.borderSubtle,
                      },
                    ]}
                  >
                    <Text
                      style={{ color: palette.textPrimary, fontWeight: "700" }}
                    >
                      Edit Group Name & Description
                    </Text>
                  </Pressable>
                )}

                <Text
                  style={[styles.sectionHeading, { color: palette.textMuted }]}
                >
                  ADD MEMBERS
                </Text>
                <TextInput
                  value={inviteQuery}
                  onChangeText={setInviteQuery}
                  placeholder="Search @username to add…"
                  placeholderTextColor={palette.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[
                    styles.input,
                    {
                      backgroundColor: palette.bgElevated,
                      borderColor: palette.borderSubtle,
                      color: palette.textPrimary,
                    },
                  ]}
                />
                {(inviteQuery.trim() ? inviteResults : []).map((u) => (
                  <Pressable
                    key={u.id}
                    onPress={() => void handleAddMember(u.id)}
                    style={[
                      styles.userRow,
                      { borderBottomColor: palette.borderSubtle },
                    ]}
                  >
                    <NativeAvatar
                      supabase={supabase}
                      storagePath={u.avatar_url}
                      label={u.display_name || u.username}
                      palette={palette}
                      size={36}
                    />
                    <View style={styles.userMeta}>
                      <Text
                        style={[styles.userName, { color: palette.textPrimary }]}
                      >
                        {u.display_name || u.username}
                      </Text>
                      <Text
                        style={[
                          styles.userHandle,
                          { color: palette.textSecondary },
                        ]}
                      >
                        @{u.username}
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: palette.accent,
                        fontWeight: "700",
                        fontSize: 12.5,
                      }}
                    >
                      Add
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {conversation.type === "group" ? (
              <View style={styles.sectionBlock}>
                <Text
                  style={[styles.sectionHeading, { color: palette.textMuted }]}
                >
                  MEMBERS ({members.length})
                </Text>
                {members.map((mem) => {
                  const prof = mem.profile;
                  const label =
                    prof?.display_name || prof?.username || "Member";
                  const isSelf = mem.user_id === currentUserId;
                  const removable = canActorRemoveGroupMember(
                    myMembership?.role,
                    mem.role,
                    isSelf
                  );

                  return (
                    <View
                      key={mem.user_id}
                      style={[
                        styles.memberListRow,
                        { borderBottomColor: palette.borderSubtle },
                      ]}
                    >
                      <NativeAvatar
                        supabase={supabase}
                        storagePath={prof?.avatar_url}
                        label={label}
                        palette={palette}
                        size={38}
                        isOnline={onlineUserIds.has(mem.user_id)}
                      />
                      <View style={styles.userMeta}>
                        <Text
                          style={[
                            styles.userName,
                            { color: palette.textPrimary },
                          ]}
                        >
                          {label}
                          {isSelf ? " (You)" : ""}
                        </Text>
                        <Text
                          style={[
                            styles.userHandle,
                            { color: palette.textSecondary },
                          ]}
                        >
                          {prof?.username ? `@${prof.username}` : ""} ·{" "}
                          {mem.role.toUpperCase()}
                        </Text>
                      </View>

                      <View style={styles.memberActions}>
                        {isOwner && !isSelf && mem.role !== "owner" ? (
                          <Pressable
                            onPress={() =>
                              void handleRoleToggle(mem.user_id, mem.role)
                            }
                            style={[
                              styles.miniTagBtn,
                              { borderColor: palette.borderSubtle },
                            ]}
                          >
                            <Text
                              style={{
                                color: palette.accent,
                                fontSize: 11,
                                fontWeight: "700",
                              }}
                            >
                              {mem.role === "admin" ? "Demote" : "Make Admin"}
                            </Text>
                          </Pressable>
                        ) : null}

                        {removable ? (
                          <Pressable
                            onPress={() => void handleRemoveMember(mem.user_id)}
                            style={[
                              styles.miniTagBtn,
                              { borderColor: `${palette.danger}55` },
                            ]}
                          >
                            <Text
                              style={{
                                color: palette.danger,
                                fontSize: 11,
                                fontWeight: "700",
                              }}
                            >
                              Remove
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  );
                })}

                <Pressable
                  onPress={() => void handleLeaveGroup()}
                  style={[
                    styles.dangerBtn,
                    {
                      backgroundColor: `${palette.danger}18`,
                      borderColor: `${palette.danger}55`,
                    },
                  ]}
                >
                  <Text style={{ color: palette.danger, fontWeight: "800" }}>
                    Leave Group
                  </Text>
                </Pressable>
              </View>
            ) : peerProfile ? (
              <View style={styles.sectionBlock}>
                <Pressable
                  onPress={() => void onToggleBlockPeer(peerProfile.id)}
                  style={[
                    styles.outlineActionBtn,
                    {
                      backgroundColor: palette.bgElevated,
                      borderColor: palette.borderSubtle,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: isBlockedPeer ? palette.accent : palette.danger,
                      fontWeight: "700",
                    }}
                  >
                    {isBlockedPeer
                      ? `Unblock @${peerProfile.username}`
                      : `Block @${peerProfile.username}`}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    onClose();
                    onOpenReport({
                      userId: peerProfile.id,
                      label: `@${peerProfile.username}`,
                    });
                  }}
                  style={[
                    styles.outlineActionBtn,
                    {
                      marginTop: 8,
                      backgroundColor: palette.bgElevated,
                      borderColor: palette.borderSubtle,
                    },
                  ]}
                >
                  <Text
                    style={{ color: palette.textSecondary, fontWeight: "600" }}
                  >
                    Report @{peerProfile.username}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    padding: 20,
    maxHeight: "86%",
  },
  sheetLarge: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    padding: 20,
    maxHeight: "90%",
  },
  sheetTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  sheetTitle: {
    marginTop: 3,
    fontSize: 18,
    fontWeight: "800",
  },
  closeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 10,
    fontSize: 13.5,
  },
  resultScroll: {
    marginTop: 10,
    maxHeight: 300,
  },
  compactResultScroll: {
    marginTop: 8,
    maxHeight: 190,
  },
  centerBox: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyHint: {
    paddingVertical: 20,
    fontSize: 13,
    textAlign: "center",
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  userMeta: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: "700",
  },
  userHandle: {
    marginTop: 1,
    fontSize: 12,
  },
  chipsScroll: {
    marginTop: 8,
    maxHeight: 36,
  },
  memberChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
    marginRight: 7,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  errorText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "600",
  },
  primaryBtn: {
    marginTop: 14,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#0B0C10",
    fontSize: 13.5,
    fontWeight: "800",
  },
  infoHeaderCenter: {
    alignItems: "center",
    paddingVertical: 10,
  },
  infoMainTitle: {
    marginTop: 10,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  smallGhostBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  busyBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginVertical: 8,
  },
  sectionBlock: {
    marginTop: 16,
  },
  sectionHeading: {
    marginTop: 14,
    marginBottom: 6,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  inlineRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 10,
  },
  halfBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  outlineActionBtn: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  memberListRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
  },
  memberActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  miniTagBtn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  dangerBtn: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
});
