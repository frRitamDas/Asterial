import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  canModerateOrbit,
  formatByteSize,
  formatMessageTime,
  orbitChannelCreateSchema,
  type OrbitChannelRow,
  type OrbitMemberRow,
  type OrbitMessageRow,
  type OrbitRole,
  type OrbitRow,
  type ProfileRow,
} from "@asterial/core";
import { NativeAvatar } from "../components/NativeAvatar";
import { NativePrivateImage } from "../components/NativePrivateImage";
import { ReportModal } from "../components/ReportModal";
import { useMobileWorkspace } from "../context/MobileWorkspaceContext";
import {
  buildSocialMediaStoragePath,
  pickAndValidateNativeFile,
  primePrivateSignedUrls,
  resolvePrivateSignedUrl,
  uploadValidatedNativeFile,
  type ValidatedNativeFile,
} from "../lib/storage";
import { createClientUuid } from "../lib/uuid";

export function OrbitRoomScreen({
  orbitId,
  onBack,
}: {
  orbitId: string;
  onBack: () => void;
}) {
  const { supabase, user, palette, blockedIds, submitReport, showToast } =
    useMobileWorkspace();

  const [orbit, setOrbit] = useState<OrbitRow | null>(null);
  const [channels, setChannels] = useState<OrbitChannelRow[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [members, setMembers] = useState<OrbitMemberRow[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, ProfileRow>>(
    {}
  );
  const [messages, setMessages] = useState<OrbitMessageRow[]>([]);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const [composerBody, setComposerBody] = useState("");
  const [stagedFile, setStagedFile] = useState<ValidatedNativeFile | null>(
    null
  );
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const sendLockRef = useRef(false);

  const [membersModal, setMembersModal] = useState(false);
  const [newChannelModal, setNewChannelModal] = useState(false);
  const [chanName, setChanName] = useState("");
  const [chanTopic, setChanTopic] = useState("");
  const [chanAnn, setChanAnn] = useState(false);
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteCandidates, setInviteCandidates] = useState<ProfileRow[]>([]);
  const [reportVisible, setReportVisible] = useState(false);

  const myMember = useMemo(
    () =>
      members.find((m) => m.user_id === user?.id && m.status === "active") ||
      null,
    [members, user?.id]
  );
  const myRole: OrbitRole | null = myMember?.role ?? null;
  const isMod = canModerateOrbit(myRole);

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === activeChannelId) || channels[0] || null,
    [activeChannelId, channels]
  );

  const canPost = Boolean(
    myMember && (!activeChannel?.is_announcement || isMod)
  );

  const loadOrbit = useCallback(async () => {
    if (!supabase || !user) return;
    const { data: oData, error: oErr } = await supabase
      .from("orbits")
      .select("*")
      .eq("id", orbitId)
      .is("deleted_at", null)
      .maybeSingle();

    if (oErr || !oData) {
      setUnavailable(true);
      setLoadingRoom(false);
      return;
    }

    const typedOrbit = oData as OrbitRow;
    setOrbit(typedOrbit);
    setUnavailable(false);

    const [mRes, cRes] = await Promise.all([
      supabase
        .from("orbit_members")
        .select("*")
        .eq("orbit_id", orbitId)
        .eq("status", "active"),
      supabase
        .from("orbit_channels")
        .select("*")
        .eq("orbit_id", orbitId)
        .order("sort_order", { ascending: true }),
    ]);

    const memRows = (mRes.data || []) as OrbitMemberRow[];
    setMembers(memRows);

    const uids = Array.from(new Set(memRows.map((m) => m.user_id)));
    if (uids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("*")
        .in("id", uids);
      const map: Record<string, ProfileRow> = {};
      for (const p of (profs || []) as ProfileRow[]) {
        map[p.id] = p;
      }
      await primePrivateSignedUrls(supabase, "avatars", [
        typedOrbit.icon_url,
        ...Object.values(map).map((p) => p.avatar_url),
      ]);
      setProfilesById((prev) => ({ ...prev, ...map }));
    }

    const chanRows = (cRes.data || []) as OrbitChannelRow[];
    setChannels(chanRows);
    setActiveChannelId((prev) =>
      prev && chanRows.some((c) => c.id === prev)
        ? prev
        : chanRows.find((c) => !c.is_announcement)?.id || chanRows[0]?.id || null
    );
    setLoadingRoom(false);
  }, [orbitId, supabase, user]);

  const loadMessages = useCallback(
    async (channelId: string) => {
      if (!supabase) return;
      const { data, error } = await supabase.rpc("get_orbit_messages_page", {
        p_channel_id: channelId,
        p_before_created_at: null,
        p_before_id: null,
        p_limit: 40,
      });
      if (error) return;
      const desc = (data || []) as OrbitMessageRow[];
      setHasOlder(desc.length === 40);
      const asc = [...desc].reverse();
      await primePrivateSignedUrls(
        supabase,
        "social-media",
        asc.map((m) => m.attachment_path)
      );
      setMessages(asc);
    },
    [supabase]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadOrbit();
  }, [loadOrbit]);

  useEffect(() => {
    if (activeChannel?.id && myMember) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadMessages(activeChannel.id);
    }
  }, [activeChannel?.id, loadMessages, myMember]);

  useEffect(() => {
    if (!supabase || !activeChannel?.id || !myMember) return;
    const ch = supabase
      .channel(`rn-orbit-${orbitId}-${activeChannel.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orbit_messages",
          filter: `channel_id=eq.${activeChannel.id}`,
        },
        () => {
          void loadMessages(activeChannel.id);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orbit_members",
          filter: `orbit_id=eq.${orbitId}`,
        },
        () => {
          void loadOrbit();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [activeChannel?.id, loadMessages, loadOrbit, myMember, orbitId, supabase]);

  useEffect(() => {
    if (!membersModal || !isMod || !supabase || !user) return;
    const timer = setTimeout(async () => {
      const q = inviteQuery.trim();
      let req = supabase
        .from("profiles")
        .select("*")
        .neq("id", user.id)
        .limit(8);
      if (q) {
        req = req.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`);
      }
      const { data } = await req;
      const existing = new Set(members.map((m) => m.user_id));
      setInviteCandidates(
        ((data || []) as ProfileRow[]).filter((p) => !existing.has(p.id))
      );
    }, 200);
    return () => clearTimeout(timer);
  }, [inviteQuery, isMod, members, membersModal, supabase, user]);

  const handleLoadOlder = async () => {
    if (!supabase || !activeChannel || messages.length === 0) return;
    const oldest = messages[0];
    const { data } = await supabase.rpc("get_orbit_messages_page", {
      p_channel_id: activeChannel.id,
      p_before_created_at: oldest.created_at,
      p_before_id: oldest.id,
      p_limit: 40,
    });
    const desc = (data || []) as OrbitMessageRow[];
    setHasOlder(desc.length === 40);
    const asc = [...desc].reverse();
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      return [...asc.filter((m) => !seen.has(m.id)), ...prev];
    });
  };

  const handleSend = async () => {
    if (
      !supabase ||
      !user ||
      !orbit ||
      !activeChannel ||
      !canPost ||
      sendLockRef.current
    ) {
      return;
    }
    const clean = composerBody.trim();
    if (!clean && !stagedFile) return;

    sendLockRef.current = true;
    setSending(true);
    try {
      let attPath: string | null = null;
      if (stagedFile) {
        setUploadPercent(0);
        attPath = buildSocialMediaStoragePath(
          "orbits",
          user.id,
          stagedFile.fileName,
          orbit.id
        );
        await uploadValidatedNativeFile({
          supabase,
          bucket: "social-media",
          storagePath: attPath,
          file: stagedFile,
          onProgress: (pct) => setUploadPercent(pct),
        });
      }

      const { error } = await supabase.from("orbit_messages").insert({
        orbit_id: orbit.id,
        channel_id: activeChannel.id,
        sender_id: user.id,
        client_id: createClientUuid(),
        kind: "user",
        body: clean,
        attachment_path: attPath,
        attachment_name: stagedFile?.fileName || null,
        attachment_mime: stagedFile?.normalizedMime || null,
        attachment_size: stagedFile?.byteSize || null,
      });
      if (error) throw new Error(error.message);

      setComposerBody("");
      setStagedFile(null);
      setUploadPercent(null);
      await loadMessages(activeChannel.id);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not send message.",
        "error"
      );
    } finally {
      setSending(false);
      setUploadPercent(null);
      sendLockRef.current = false;
    }
  };

  const handleDeleteMsg = async (msgId: string) => {
    if (!supabase || !activeChannel) return;
    const { error } = await supabase.rpc("delete_orbit_message", {
      p_message_id: msgId,
    });
    if (error) {
      showToast(error.message, "error");
      return;
    }
    await loadMessages(activeChannel.id);
  };

  const handleCreateChannel = async () => {
    if (!supabase || !orbit) return;
    const parsed = orbitChannelCreateSchema.safeParse({
      name: chanName,
      topic: chanTopic,
      isAnnouncement: chanAnn,
    });
    if (!parsed.success) {
      showToast(
        parsed.error.issues[0]?.message || "Invalid channel name.",
        "error"
      );
      return;
    }
    const { data: newId, error } = await supabase.rpc("create_orbit_channel", {
      p_orbit_id: orbit.id,
      p_name: parsed.data.name,
      p_topic: parsed.data.topic,
      p_is_announcement: parsed.data.isAnnouncement,
    });
    if (error) {
      showToast(error.message, "error");
      return;
    }
    setNewChannelModal(false);
    setChanName("");
    setChanTopic("");
    setChanAnn(false);
    await loadOrbit();
    if (newId) setActiveChannelId(newId as string);
  };

  const handleLeave = async () => {
    if (!supabase || !orbit) return;
    const { error } = await supabase.rpc("leave_orbit", {
      p_orbit_id: orbit.id,
    });
    if (error) {
      showToast(error.message, "error");
      return;
    }
    setMembersModal(false);
    showToast(`Left ${orbit.name}`, "info");
    onBack();
  };

  if (loadingRoom) {
    return (
      <View style={[styles.center, { backgroundColor: palette.bgCanvas }]}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  if (unavailable || !orbit) {
    return (
      <View style={[styles.center, { backgroundColor: palette.bgCanvas }]}>
        <Text
          style={{
            color: palette.textPrimary,
            fontSize: 16,
            fontWeight: "800",
          }}
        >
          Orbit unavailable
        </Text>
        <Text
          style={{
            color: palette.textSecondary,
            fontSize: 12.5,
            marginTop: 6,
            textAlign: "center",
          }}
        >
          This community is private, deleted, or you no longer have access.
        </Text>
        <Pressable
          onPress={onBack}
          style={[
            styles.pillBtn,
            { backgroundColor: palette.accentBg, marginTop: 16 },
          ]}
        >
          <Text style={{ color: palette.accentFg, fontWeight: "800" }}>
            ← Back to Orbits
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: palette.bgCanvas }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Top Bar */}
      <View
        style={[
          styles.topBar,
          {
            backgroundColor: palette.bgSurface,
            borderBottomColor: palette.borderSubtle,
          },
        ]}
      >
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={{ color: palette.textPrimary, fontSize: 17 }}>←</Text>
        </Pressable>
        <NativeAvatar
          supabase={supabase}
          palette={palette}
          label={orbit.name}
          storagePath={orbit.icon_url}
          size={34}
          isGroup
        />
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={{
              color: palette.textPrimary,
              fontSize: 14.5,
              fontWeight: "800",
            }}
          >
            {orbit.name}
          </Text>
          <Text style={{ color: palette.textMuted, fontSize: 11 }}>
            #{activeChannel?.name || "general"} · {orbit.member_count} members
          </Text>
        </View>
        <Pressable
          onPress={() => setMembersModal(true)}
          style={[
            styles.headerChip,
            {
              backgroundColor: palette.bgElevated,
              borderColor: palette.borderSubtle,
            },
          ]}
        >
          <Text
            style={{
              color: palette.textPrimary,
              fontSize: 11.5,
              fontWeight: "700",
            }}
          >
            Members
          </Text>
        </Pressable>
      </View>

      {/* Channel Pills */}
      <View
        style={[
          styles.channelStrip,
          {
            backgroundColor: palette.bgVoid,
            borderBottomColor: palette.borderSubtle,
          },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 14 }}
        >
          {channels.map((ch) => {
            const active = activeChannel?.id === ch.id;
            return (
              <Pressable
                key={ch.id}
                onPress={() => setActiveChannelId(ch.id)}
                style={[
                  styles.channelPill,
                  {
                    backgroundColor: active
                      ? palette.accentBg
                      : palette.bgSurface,
                    borderColor: palette.borderSubtle,
                  },
                ]}
              >
                <Text
                  style={{
                    color: active ? palette.accentFg : palette.textSecondary,
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  {ch.is_announcement ? "📣 " : "#"}
                  {ch.name}
                </Text>
              </Pressable>
            );
          })}
          {isMod ? (
            <Pressable
              onPress={() => setNewChannelModal(true)}
              style={[
                styles.channelPill,
                {
                  backgroundColor: palette.bgSurface,
                  borderColor: palette.borderStrong,
                },
              ]}
            >
              <Text
                style={{
                  color: palette.textPrimary,
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                + Channel
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>

      {/* Messages */}
      <FlatList
        data={messages.filter(
          (m) => !(m.sender_id && blockedIds.has(m.sender_id))
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 14, gap: 10 }}
        ListHeaderComponent={
          hasOlder ? (
            <Pressable
              onPress={() => void handleLoadOlder()}
              style={[
                styles.olderBtn,
                {
                  backgroundColor: palette.bgSurface,
                  borderColor: palette.borderSubtle,
                },
              ]}
            >
              <Text
                style={{
                  color: palette.textSecondary,
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                Load earlier messages
              </Text>
            </Pressable>
          ) : null
        }
        renderItem={({ item }) => {
          if (item.kind === "system") {
            return (
              <View style={styles.systemRow}>
                <Text style={{ color: palette.textMuted, fontSize: 11 }}>
                  {item.body}
                </Text>
              </View>
            );
          }

          const sender = item.sender_id ? profilesById[item.sender_id] : null;
          const isMine = item.sender_id === user?.id;
          const isDeleted = Boolean(item.deleted_at);

          return (
            <View
              style={[
                styles.msgCard,
                {
                  backgroundColor: palette.bgSurface,
                  borderColor: palette.borderSubtle,
                },
              ]}
            >
              <View style={styles.msgHeader}>
                <Text
                  style={{
                    color: palette.textPrimary,
                    fontSize: 12.5,
                    fontWeight: "800",
                  }}
                >
                  {sender?.display_name || "Member"}
                </Text>
                <Text style={{ color: palette.textMuted, fontSize: 11 }}>
                  {formatMessageTime(item.created_at)}
                </Text>
                {!isDeleted && (isMine || isMod) ? (
                  <Pressable
                    onPress={() => void handleDeleteMsg(item.id)}
                    style={{ marginLeft: "auto" }}
                  >
                    <Text style={{ color: palette.danger, fontSize: 11 }}>
                      Delete
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              {isDeleted ? (
                <Text
                  style={{
                    color: palette.textMuted,
                    fontSize: 12.5,
                    fontStyle: "italic",
                  }}
                >
                  Message removed
                </Text>
              ) : (
                <>
                  {item.body ? (
                    <Text
                      style={{
                        color: palette.textPrimary,
                        fontSize: 13.5,
                        lineHeight: 19,
                      }}
                    >
                      {item.body}
                    </Text>
                  ) : null}
                  {item.attachment_path ? (
                    item.attachment_mime?.startsWith("image/") ? (
                      <NativePrivateImage
                        supabase={supabase}
                        bucket="social-media"
                        path={item.attachment_path}
                        alt={item.attachment_name || "Orbit attachment"}
                        palette={palette}
                        style={{ marginTop: 8 }}
                      />
                    ) : (
                      <Pressable
                        onPress={async () => {
                          if (!supabase || !item.attachment_path) return;
                          const url = await resolvePrivateSignedUrl(
                            supabase,
                            "social-media",
                            item.attachment_path
                          );
                          if (url) await Linking.openURL(url);
                        }}
                        style={[
                          styles.docBtn,
                          {
                            backgroundColor: palette.bgElevated,
                            borderColor: palette.borderSubtle,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: palette.textPrimary,
                            fontSize: 12,
                            fontWeight: "700",
                          }}
                        >
                          📎 {item.attachment_name || "Attachment"}
                          {item.attachment_size
                            ? ` (${formatByteSize(item.attachment_size)})`
                            : ""}
                        </Text>
                      </Pressable>
                    )
                  ) : null}
                </>
              )}
            </View>
          );
        }}
      />

      {/* Composer */}
      <View
        style={[
          styles.composerWrap,
          {
            backgroundColor: palette.bgSurface,
            borderTopColor: palette.borderSubtle,
          },
        ]}
      >
        {!canPost ? (
          <Text
            style={{
              color: palette.textMuted,
              fontSize: 12,
              textAlign: "center",
              paddingVertical: 6,
            }}
          >
            Only Orbit owners and admins can post in #{activeChannel?.name}.
          </Text>
        ) : (
          <>
            {stagedFile ? (
              <View style={styles.stagedRow}>
                <Text
                  numberOfLines={1}
                  style={{ color: palette.textSecondary, fontSize: 11.5, flex: 1 }}
                >
                  {stagedFile.fileName}
                  {uploadPercent !== null ? ` · ${uploadPercent}%` : ""}
                </Text>
                <Pressable onPress={() => setStagedFile(null)}>
                  <Text style={{ color: palette.danger, fontSize: 12 }}>✕</Text>
                </Pressable>
              </View>
            ) : null}
            <View style={styles.composerRow}>
              <Pressable
                onPress={async () => {
                  try {
                    const f = await pickAndValidateNativeFile("attachment");
                    if (f) setStagedFile(f);
                  } catch (err) {
                    showToast(
                      err instanceof Error ? err.message : "File rejected.",
                      "error"
                    );
                  }
                }}
                style={[
                  styles.attachBtn,
                  {
                    backgroundColor: palette.bgCanvas,
                    borderColor: palette.borderSubtle,
                  },
                ]}
              >
                <Text style={{ color: palette.textPrimary, fontSize: 15 }}>
                  +
                </Text>
              </Pressable>
              <TextInput
                value={composerBody}
                onChangeText={setComposerBody}
                placeholder={`Message #${activeChannel?.name || "general"}`}
                placeholderTextColor={palette.textMuted}
                maxLength={4000}
                style={[
                  styles.composerInput,
                  {
                    backgroundColor: palette.bgCanvas,
                    borderColor: palette.borderSubtle,
                    color: palette.textPrimary,
                  },
                ]}
              />
              <Pressable
                disabled={sending || (!composerBody.trim() && !stagedFile)}
                onPress={() => void handleSend()}
                style={[
                  styles.sendBtn,
                  {
                    backgroundColor: palette.accentBg,
                    opacity:
                      sending || (!composerBody.trim() && !stagedFile) ? 0.5 : 1,
                  },
                ]}
              >
                <Text
                  style={{
                    color: palette.accentFg,
                    fontWeight: "800",
                    fontSize: 12.5,
                  }}
                >
                  {sending ? "…" : "Send"}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </View>

      {/* Members & Governance Modal */}
      <Modal
        visible={membersModal}
        transparent
        animationType="slide"
        onRequestClose={() => setMembersModal(false)}
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
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text
                style={{
                  color: palette.textPrimary,
                  fontSize: 17,
                  fontWeight: "800",
                }}
              >
                @{orbit.slug} · Governance
              </Text>

              {isMod ? (
                <View style={{ marginTop: 12, gap: 8 }}>
                  <TextInput
                    value={inviteQuery}
                    onChangeText={setInviteQuery}
                    placeholder="Invite member by @username…"
                    placeholderTextColor={palette.textMuted}
                    style={[
                      styles.composerInput,
                      {
                        backgroundColor: palette.bgCanvas,
                        borderColor: palette.borderSubtle,
                        color: palette.textPrimary,
                      },
                    ]}
                  />
                  {inviteCandidates.slice(0, 4).map((cand) => (
                    <View key={cand.id} style={styles.memberRow}>
                      <Text
                        style={{
                          color: palette.textPrimary,
                          fontSize: 13,
                          flex: 1,
                        }}
                      >
                        {cand.display_name} (@{cand.username})
                      </Text>
                      <Pressable
                        onPress={async () => {
                          if (!supabase) return;
                          const { error } = await supabase.rpc(
                            "invite_orbit_member",
                            {
                              p_orbit_id: orbit.id,
                              p_target_user_id: cand.id,
                            }
                          );
                          if (error) showToast(error.message, "error");
                          else {
                            showToast(`Added @${cand.username}`, "success");
                            await loadOrbit();
                          }
                        }}
                        style={[
                          styles.smallBtn,
                          { backgroundColor: palette.accentBg },
                        ]}
                      >
                        <Text
                          style={{
                            color: palette.accentFg,
                            fontSize: 11,
                            fontWeight: "800",
                          }}
                        >
                          Add
                        </Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={{ marginTop: 14, gap: 8 }}>
                {members.map((m) => {
                  const p = profilesById[m.user_id];
                  const canModRow =
                    isMod &&
                    m.user_id !== user?.id &&
                    m.role !== "owner" &&
                    (myRole === "owner" || m.role !== "admin");

                  return (
                    <View
                      key={m.user_id}
                      style={[
                        styles.memberRow,
                        {
                          backgroundColor: palette.bgCanvas,
                          borderColor: palette.borderSubtle,
                          borderWidth: 1,
                          borderRadius: 12,
                          padding: 10,
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: palette.textPrimary,
                            fontSize: 13,
                            fontWeight: "700",
                          }}
                        >
                          {p?.display_name || "Member"}
                        </Text>
                        <Text
                          style={{ color: palette.textMuted, fontSize: 11 }}
                        >
                          @{p?.username || "member"} · {m.role.toUpperCase()}
                        </Text>
                      </View>
                      {canModRow ? (
                        <Pressable
                          onPress={async () => {
                            if (!supabase) return;
                            const { error } = await supabase.rpc(
                              "moderate_orbit_member",
                              {
                                p_orbit_id: orbit.id,
                                p_target_user_id: m.user_id,
                                p_action: "kick",
                                p_new_role: "member",
                              }
                            );
                            if (error) showToast(error.message, "error");
                            else await loadOrbit();
                          }}
                        >
                          <Text
                            style={{
                              color: palette.danger,
                              fontSize: 11.5,
                              fontWeight: "700",
                            }}
                          >
                            Remove
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })}
              </View>

              <View style={{ marginTop: 16, flexDirection: "row", gap: 10 }}>
                <Pressable
                  onPress={() => {
                    setMembersModal(false);
                    setReportVisible(true);
                  }}
                  style={[
                    styles.smallBtn,
                    {
                      borderWidth: 1,
                      borderColor: palette.borderSubtle,
                      flex: 1,
                    },
                  ]}
                >
                  <Text
                    style={{ color: palette.textSecondary, fontWeight: "700" }}
                  >
                    Report Orbit
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => void handleLeave()}
                  style={[
                    styles.smallBtn,
                    {
                      borderWidth: 1,
                      borderColor: palette.danger,
                      flex: 1,
                    },
                  ]}
                >
                  <Text style={{ color: palette.danger, fontWeight: "700" }}>
                    Leave Orbit
                  </Text>
                </Pressable>
              </View>

              <Pressable
                onPress={() => setMembersModal(false)}
                style={{ marginTop: 14, alignItems: "center" }}
              >
                <Text style={{ color: palette.textSecondary, fontWeight: "700" }}>
                  Close
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* New Channel Modal */}
      <Modal
        visible={newChannelModal}
        transparent
        animationType="slide"
        onRequestClose={() => setNewChannelModal(false)}
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
            <Text
              style={{
                color: palette.textPrimary,
                fontSize: 17,
                fontWeight: "800",
              }}
            >
              Create Channel
            </Text>
            <TextInput
              value={chanName}
              onChangeText={setChanName}
              placeholder="engineering-notes"
              placeholderTextColor={palette.textMuted}
              style={[
                styles.composerInput,
                {
                  marginTop: 12,
                  backgroundColor: palette.bgCanvas,
                  borderColor: palette.borderSubtle,
                  color: palette.textPrimary,
                },
              ]}
            />
            <TextInput
              value={chanTopic}
              onChangeText={setChanTopic}
              placeholder="Topic description (optional)"
              placeholderTextColor={palette.textMuted}
              style={[
                styles.composerInput,
                {
                  marginTop: 10,
                  backgroundColor: palette.bgCanvas,
                  borderColor: palette.borderSubtle,
                  color: palette.textPrimary,
                },
              ]}
            />
            <Pressable
              onPress={() => setChanAnn((v) => !v)}
              style={{ marginTop: 12 }}
            >
              <Text style={{ color: palette.textSecondary, fontSize: 12.5 }}>
                {chanAnn ? "☑ " : "☐ "}Announcement channel (owners & admins
                only)
              </Text>
            </Pressable>
            <View style={{ marginTop: 16, flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => setNewChannelModal(false)}
                style={[
                  styles.smallBtn,
                  {
                    borderWidth: 1,
                    borderColor: palette.borderSubtle,
                    flex: 1,
                  },
                ]}
              >
                <Text style={{ color: palette.textSecondary }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleCreateChannel()}
                style={[
                  styles.smallBtn,
                  { backgroundColor: palette.accentBg, flex: 1 },
                ]}
              >
                <Text
                  style={{ color: palette.accentFg, fontWeight: "800" }}
                >
                  Create
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ReportModal
        visible={reportVisible}
        palette={palette}
        subjectLabel={`Orbit @${orbit.slug}`}
        onClose={() => setReportVisible(false)}
        onSubmit={async (reason, details) => {
          await submitReport({
            orbitId: orbit.id,
            reason,
            details,
          });
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  headerChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  channelStrip: {
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  channelPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  olderBtn: {
    alignSelf: "center",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginBottom: 8,
  },
  systemRow: {
    alignItems: "center",
    paddingVertical: 4,
  },
  msgCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  msgHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  docBtn: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  composerWrap: {
    borderTopWidth: 1,
    padding: 10,
    gap: 8,
  },
  stagedRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  attachBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  composerInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
  },
  sendBtn: {
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  pillBtn: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: 20,
    maxHeight: "82%",
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  smallBtn: {
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
  },
});
