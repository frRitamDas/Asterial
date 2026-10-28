import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  orbitCreateSchema,
  type OrbitMemberRow,
  type OrbitRow,
  type OrbitVisibility,
} from "@asterial/core";
import { NativeAvatar } from "../components/NativeAvatar";
import { useMobileWorkspace } from "../context/MobileWorkspaceContext";
import {
  buildAvatarStoragePath,
  pickAndValidateNativeFile,
  primePrivateSignedUrls,
  uploadValidatedNativeFile,
  type ValidatedNativeFile,
} from "../lib/storage";

function slugifyOrbit(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/(^-+|-+$)/g, "")
    .slice(0, 36);
}

export function OrbitsScreen({
  onOpenOrbit,
}: {
  onOpenOrbit: (orbitId: string) => void;
}) {
  const { supabase, user, palette, showToast } = useMobileWorkspace();

  const [orbits, setOrbits] = useState<OrbitRow[]>([]);
  const [memberships, setMemberships] = useState<Record<string, OrbitMemberRow>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<"joined" | "discover">("joined");
  const [query, setQuery] = useState("");
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [createVisible, setCreateVisible] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftSlug, setDraftSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [draftDesc, setDraftDesc] = useState("");
  const [draftVis, setDraftVis] = useState<OrbitVisibility>("public");
  const [pickedIcon, setPickedIcon] = useState<ValidatedNativeFile | null>(
    null
  );
  const [creating, setCreating] = useState(false);

  const loadOrbits = useCallback(async () => {
    if (!supabase || !user) return;
    setErrorText(null);
    const [orbitsRes, memRes] = await Promise.all([
      supabase
        .from("orbits")
        .select("*")
        .is("deleted_at", null)
        .order("member_count", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("orbit_members")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["active", "invited"]),
    ]);

    if (orbitsRes.error) {
      setErrorText(orbitsRes.error.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const rows = (orbitsRes.data || []) as OrbitRow[];
    const map: Record<string, OrbitMemberRow> = {};
    for (const m of (memRes.data || []) as OrbitMemberRow[]) {
      map[m.orbit_id] = m;
    }

    await primePrivateSignedUrls(
      supabase,
      "avatars",
      rows.map((r) => r.icon_url)
    );
    setOrbits(rows);
    setMemberships(map);
    setLoading(false);
    setRefreshing(false);
  }, [supabase, user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadOrbits();
  }, [loadOrbits]);

  const joinedOrbits = useMemo(
    () =>
      orbits.filter(
        (o) =>
          memberships[o.id]?.status === "active" ||
          memberships[o.id]?.status === "invited"
      ),
    [memberships, orbits]
  );

  const visibleOrbits = useMemo(() => {
    const base = tab === "joined" ? joinedOrbits : orbits;
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.slug.toLowerCase().includes(q) ||
        o.description.toLowerCase().includes(q)
    );
  }, [joinedOrbits, orbits, query, tab]);

  const handleJoin = async (orbit: OrbitRow) => {
    if (!supabase || joiningId) return;
    setJoiningId(orbit.id);
    const { error } = await supabase.rpc("join_orbit", {
      p_orbit_id: orbit.id,
    });
    setJoiningId(null);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    showToast(`Joined ${orbit.name}`, "success");
    await loadOrbits();
    onOpenOrbit(orbit.id);
  };

  const handlePickIcon = async () => {
    try {
      const file = await pickAndValidateNativeFile("avatar");
      if (file) setPickedIcon(file);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not read image.",
        "error"
      );
    }
  };

  const handleCreateOrbit = async () => {
    if (!supabase || !user || creating) return;
    const parsed = orbitCreateSchema.safeParse({
      name: draftName,
      slug: draftSlug || slugifyOrbit(draftName),
      description: draftDesc,
      visibility: draftVis,
    });
    if (!parsed.success) {
      showToast(
        parsed.error.issues[0]?.message || "Check Orbit details.",
        "error"
      );
      return;
    }

    setCreating(true);
    try {
      let iconPath: string | null = null;
      if (pickedIcon) {
        iconPath = buildAvatarStoragePath(user.id, pickedIcon.fileName, "orbit");
        await uploadValidatedNativeFile({
          supabase,
          bucket: "avatars",
          storagePath: iconPath,
          file: pickedIcon,
          upsert: true,
        });
      }

      const { data: newId, error } = await supabase.rpc("create_orbit", {
        p_name: parsed.data.name,
        p_slug: parsed.data.slug,
        p_description: parsed.data.description,
        p_visibility: parsed.data.visibility,
        p_icon_url: iconPath,
      });
      if (error || !newId) {
        throw new Error(error?.message || "Could not create Orbit.");
      }

      setCreateVisible(false);
      setDraftName("");
      setDraftSlug("");
      setSlugEdited(false);
      setDraftDesc("");
      setPickedIcon(null);
      showToast(`Launched @${parsed.data.slug}`, "success");
      await loadOrbits();
      onOpenOrbit(newId as string);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not create Orbit.",
        "error"
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: palette.bgCanvas }]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: palette.bgSurface,
            borderBottomColor: palette.borderSubtle,
          },
        ]}
      >
        <View style={styles.headerTopRow}>
          <View>
            <Text style={[styles.eyebrow, { color: palette.textMuted }]}>
              COMMUNITIES
            </Text>
            <Text style={[styles.title, { color: palette.textPrimary }]}>
              Orbits
            </Text>
          </View>
          <Pressable
            onPress={() => setCreateVisible(true)}
            style={[styles.primaryBtn, { backgroundColor: palette.accentBg }]}
          >
            <Text style={[styles.primaryBtnText, { color: palette.accentFg }]}>
              + Launch
            </Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.tabSwitch,
            {
              backgroundColor: palette.bgCanvas,
              borderColor: palette.borderSubtle,
            },
          ]}
        >
          <Pressable
            onPress={() => setTab("joined")}
            style={[
              styles.tabItem,
              tab === "joined" && { backgroundColor: palette.accentBg },
            ]}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color:
                  tab === "joined" ? palette.accentFg : palette.textSecondary,
              }}
            >
              My Orbits ({joinedOrbits.length})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setTab("discover")}
            style={[
              styles.tabItem,
              tab === "discover" && { backgroundColor: palette.accentBg },
            ]}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color:
                  tab === "discover"
                    ? palette.accentFg
                    : palette.textSecondary,
              }}
            >
              Discover ({orbits.length})
            </Text>
          </Pressable>
        </View>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search Orbits by name or @handle…"
          placeholderTextColor={palette.textMuted}
          style={[
            styles.searchInput,
            {
              backgroundColor: palette.bgCanvas,
              borderColor: palette.borderSubtle,
              color: palette.textPrimary,
            },
          ]}
        />
      </View>

      {errorText ? (
        <View
          style={[
            styles.errorRow,
            {
              backgroundColor: palette.bgSurface,
              borderColor: palette.danger,
            },
          ]}
        >
          <Text style={{ color: palette.danger, fontSize: 12, flex: 1 }}>
            {errorText}
          </Text>
          <Pressable onPress={() => void loadOrbits()}>
            <Text style={{ color: palette.textPrimary, fontWeight: "700" }}>
              Retry
            </Text>
          </Pressable>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={palette.accent} />
        </View>
      ) : (
        <FlatList
          data={visibleOrbits}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void loadOrbits();
              }}
              tintColor={palette.accent}
            />
          }
          ListEmptyComponent={
            <View
              style={[
                styles.emptyCard,
                {
                  backgroundColor: palette.bgSurface,
                  borderColor: palette.borderSubtle,
                },
              ]}
            >
              <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>
                {tab === "joined"
                  ? "No joined Orbits yet"
                  : "No matching Orbits"}
              </Text>
              <Text style={[styles.emptySub, { color: palette.textSecondary }]}>
                {tab === "joined"
                  ? "Explore public communities in Discover or launch your own Orbit."
                  : "Create a public or private Orbit to bring people together."}
              </Text>
              {tab === "joined" && orbits.length > 0 ? (
                <Pressable
                  onPress={() => setTab("discover")}
                  style={[
                    styles.secondaryBtn,
                    { borderColor: palette.borderStrong, marginTop: 12 },
                  ]}
                >
                  <Text
                    style={{
                      color: palette.textPrimary,
                      fontWeight: "700",
                      fontSize: 12.5,
                    }}
                  >
                    Browse Public Orbits
                  </Text>
                </Pressable>
              ) : null}
            </View>
          }
          renderItem={({ item }) => {
            const myMem = memberships[item.id];
            const isMember = myMem?.status === "active";
            const isInvited = myMem?.status === "invited";

            return (
              <Pressable
                onPress={() => {
                  if (isMember) onOpenOrbit(item.id);
                }}
                style={[
                  styles.orbitCard,
                  {
                    backgroundColor: palette.bgSurface,
                    borderColor: palette.borderSubtle,
                  },
                ]}
              >
                <View style={styles.cardTopRow}>
                  <NativeAvatar
                    supabase={supabase}
                    palette={palette}
                    label={item.name}
                    storagePath={item.icon_url}
                    size={44}
                    isGroup
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      numberOfLines={1}
                      style={[styles.orbitName, { color: palette.textPrimary }]}
                    >
                      {item.name}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{ color: palette.textMuted, fontSize: 11.5 }}
                    >
                      @{item.slug} ·{" "}
                      {item.visibility === "private" ? "Private" : "Public"}
                    </Text>
                  </View>
                </View>

                <Text
                  numberOfLines={2}
                  style={[styles.orbitDesc, { color: palette.textSecondary }]}
                >
                  {item.description ||
                    "Community space with #announcements and #general channels."}
                </Text>

                <View
                  style={[
                    styles.cardFooter,
                    { borderTopColor: palette.borderSubtle },
                  ]}
                >
                  <Text style={{ color: palette.textMuted, fontSize: 11.5 }}>
                    {item.member_count}{" "}
                    {item.member_count === 1 ? "member" : "members"}
                    {isMember ? ` · ${myMem.role.toUpperCase()}` : ""}
                  </Text>

                  {isMember ? (
                    <Pressable
                      onPress={() => onOpenOrbit(item.id)}
                      style={[
                        styles.actionPill,
                        { backgroundColor: palette.accentBg },
                      ]}
                    >
                      <Text
                        style={{
                          color: palette.accentFg,
                          fontWeight: "800",
                          fontSize: 12,
                        }}
                      >
                        Open →
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      disabled={joiningId === item.id}
                      onPress={() => void handleJoin(item)}
                      style={[
                        styles.actionPill,
                        {
                          backgroundColor: palette.bgElevated,
                          borderWidth: 1,
                          borderColor: palette.borderStrong,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: palette.textPrimary,
                          fontWeight: "700",
                          fontSize: 12,
                        }}
                      >
                        {joiningId === item.id
                          ? "Joining…"
                          : isInvited
                            ? "Accept Invite"
                            : "Join Orbit"}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {/* Create Orbit Modal */}
      <Modal
        visible={createVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !creating && setCreateVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: palette.bgSurface,
                borderColor: palette.borderSubtle,
              },
            ]}
          >
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={[styles.modalTitle, { color: palette.textPrimary }]}>
                Launch a new Orbit
              </Text>
              <Text
                style={[styles.modalSub, { color: palette.textSecondary }]}
              >
                Includes #announcements and #general channels with owner/admin
                governance.
              </Text>

              <Pressable
                onPress={() => void handlePickIcon()}
                style={[
                  styles.iconPickBtn,
                  {
                    backgroundColor: palette.bgElevated,
                    borderColor: palette.borderSubtle,
                  },
                ]}
              >
                <Text
                  style={{
                    color: palette.textPrimary,
                    fontSize: 12.5,
                    fontWeight: "600",
                  }}
                >
                  {pickedIcon
                    ? `Icon: ${pickedIcon.fileName}`
                    : "Choose Orbit Icon (optional)"}
                </Text>
              </Pressable>

              <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
                Orbit Name
              </Text>
              <TextInput
                value={draftName}
                onChangeText={(v) => {
                  setDraftName(v);
                  if (!slugEdited) setDraftSlug(slugifyOrbit(v));
                }}
                placeholder="Architecture & Systems"
                placeholderTextColor={palette.textMuted}
                maxLength={80}
                style={[
                  styles.fieldInput,
                  {
                    backgroundColor: palette.bgCanvas,
                    borderColor: palette.borderSubtle,
                    color: palette.textPrimary,
                  },
                ]}
              />

              <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
                Community Handle
              </Text>
              <TextInput
                value={draftSlug}
                onChangeText={(v) => {
                  setSlugEdited(true);
                  setDraftSlug(slugifyOrbit(v));
                }}
                placeholder="architecture-systems"
                placeholderTextColor={palette.textMuted}
                autoCapitalize="none"
                maxLength={36}
                style={[
                  styles.fieldInput,
                  {
                    backgroundColor: palette.bgCanvas,
                    borderColor: palette.borderSubtle,
                    color: palette.textPrimary,
                  },
                ]}
              />

              <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
                Description
              </Text>
              <TextInput
                value={draftDesc}
                onChangeText={setDraftDesc}
                placeholder="Purpose and community norms…"
                placeholderTextColor={palette.textMuted}
                multiline
                maxLength={500}
                style={[
                  styles.fieldInput,
                  {
                    minHeight: 72,
                    textAlignVertical: "top",
                    backgroundColor: palette.bgCanvas,
                    borderColor: palette.borderSubtle,
                    color: palette.textPrimary,
                  },
                ]}
              />

              <View style={styles.visRow}>
                {(["public", "private"] as const).map((v) => (
                  <Pressable
                    key={v}
                    onPress={() => setDraftVis(v)}
                    style={[
                      styles.visBtn,
                      {
                        backgroundColor:
                          draftVis === v ? palette.accentBg : palette.bgCanvas,
                        borderColor: palette.borderSubtle,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color:
                          draftVis === v
                            ? palette.accentFg
                            : palette.textSecondary,
                        fontWeight: "700",
                        fontSize: 12.5,
                        textTransform: "capitalize",
                      }}
                    >
                      {v}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.modalActions}>
                <Pressable
                  disabled={creating}
                  onPress={() => setCreateVisible(false)}
                  style={[
                    styles.secondaryBtn,
                    { borderColor: palette.borderSubtle, flex: 1 },
                  ]}
                >
                  <Text
                    style={{ color: palette.textSecondary, fontWeight: "700" }}
                  >
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  disabled={creating}
                  onPress={() => void handleCreateOrbit()}
                  style={[
                    styles.primaryBtn,
                    { backgroundColor: palette.accentBg, flex: 1 },
                  ]}
                >
                  {creating ? (
                    <ActivityIndicator color={palette.accentFg} size="small" />
                  ) : (
                    <Text
                      style={[
                        styles.primaryBtnText,
                        { color: palette.accentFg },
                      ]}
                    >
                      Launch Orbit
                    </Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.6,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
  },
  primaryBtn: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    fontSize: 12.5,
    fontWeight: "800",
  },
  secondaryBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tabSwitch: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
  },
  tabItem: {
    flex: 1,
    borderRadius: 9,
    paddingVertical: 7,
    alignItems: "center",
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 9,
    fontSize: 13.5,
  },
  errorRow: {
    margin: 14,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    padding: 14,
    gap: 12,
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  emptySub: {
    marginTop: 6,
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: "center",
  },
  orbitCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 15,
    gap: 10,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  orbitName: {
    fontSize: 15,
    fontWeight: "800",
  },
  orbitDesc: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  cardFooter: {
    borderTopWidth: 1,
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  actionPill: {
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: 20,
    maxHeight: "88%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  modalSub: {
    marginTop: 4,
    fontSize: 12.5,
    lineHeight: 18,
  },
  iconPickBtn: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 12,
    padding: 11,
    alignItems: "center",
  },
  fieldLabel: {
    marginTop: 12,
    marginBottom: 5,
    fontSize: 12,
    fontWeight: "700",
  },
  fieldInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
    fontSize: 14,
  },
  visRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 10,
  },
  visBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  modalActions: {
    marginTop: 18,
    flexDirection: "row",
    gap: 10,
  },
});
