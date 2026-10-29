import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  formatByteSize,
  formatMomentTimeRemaining,
  momentCreateSchema,
  type ActiveMomentItem,
  type MomentAudience,
  type MomentDurationHours,
  type MomentTone,
} from "@asterial/core";
import { NativeAvatar } from "../components/NativeAvatar";
import { NativePrivateImage } from "../components/NativePrivateImage";
import { ReportModal } from "../components/ReportModal";
import { useMobileWorkspace } from "../context/MobileWorkspaceContext";
import {
  buildSocialMediaStoragePath,
  pickAndValidateNativeFile,
  primePrivateSignedUrls,
  uploadValidatedNativeFile,
  type ValidatedNativeFile,
} from "../lib/storage";
import { createClientUuid } from "../lib/uuid";
import { AsterialNative } from "../native/AsterialNative";

const TONE_HEX: Record<
  MomentTone,
  { bg: string; fg: string; border: string; label: string }
> = {
  obsidian: {
    bg: "#0A0A0D",
    fg: "#F5F5F7",
    border: "rgba(255,255,255,0.14)",
    label: "Obsidian",
  },
  graphite: {
    bg: "#17171C",
    fg: "#F4F4F5",
    border: "rgba(255,255,255,0.15)",
    label: "Graphite",
  },
  slate: {
    bg: "#23232B",
    fg: "#FFFFFF",
    border: "rgba(255,255,255,0.18)",
    label: "Charcoal",
  },
  ivory: {
    bg: "#F4F4F6",
    fg: "#0F0F12",
    border: "rgba(15,15,18,0.18)",
    label: "Alabaster",
  },
};

export function MomentsScreen() {
  const { supabase, user, palette, submitReport, showToast } =
    useMobileWorkspace();

  const [moments, setMoments] = useState<ActiveMomentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [reportTarget, setReportTarget] = useState<ActiveMomentItem | null>(
    null
  );

  const [composeVisible, setComposeVisible] = useState(false);
  const [caption, setCaption] = useState("");
  const [tone, setTone] = useState<MomentTone>("obsidian");
  const [audience, setAudience] = useState<MomentAudience>("everyone");
  const [durationHours, setDurationHours] = useState<MomentDurationHours>(24);
  const [pickedImage, setPickedImage] = useState<ValidatedNativeFile | null>(
    null
  );
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const activeUploadIdRef = useRef<string | null>(null);

  const loadMoments = useCallback(async () => {
    if (!supabase || !user) return;
    const { data, error } = await supabase.rpc("get_active_moments", {
      p_limit: 60,
    });
    if (error) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const nowMs = Date.now();
    const active = ((data || []) as ActiveMomentItem[]).filter(
      (m) => new Date(m.expires_at).getTime() > nowMs
    );

    await Promise.all([
      primePrivateSignedUrls(
        supabase,
        "avatars",
        active.map((m) => m.author_avatar_url)
      ),
      primePrivateSignedUrls(
        supabase,
        "social-media",
        active.map((m) => m.media_path)
      ),
    ]);

    setMoments(active);
    setLoading(false);
    setRefreshing(false);
  }, [supabase, user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMoments();
    const timer = setInterval(() => {
      setMoments((prev) =>
        prev.filter((m) => new Date(m.expires_at).getTime() > Date.now())
      );
    }, 30_000);
    return () => clearInterval(timer);
  }, [loadMoments]);

  const activeMoment = useMemo(
    () =>
      activeIndex !== null && moments[activeIndex]
        ? moments[activeIndex]
        : null,
    [activeIndex, moments]
  );

  useEffect(() => {
    if (!activeMoment || !supabase || !user) return;
    if (activeMoment.author_id !== user.id && !activeMoment.viewer_has_viewed) {
      void supabase
        .rpc("record_moment_view", { p_moment_id: activeMoment.id })
        .then(() => {
          setMoments((prev) =>
            prev.map((m) =>
              m.id === activeMoment.id
                ? {
                    ...m,
                    viewer_has_viewed: true,
                    view_count: m.view_count + 1,
                  }
                : m
            )
          );
        });
    }
  }, [activeMoment, supabase, user]);

  const handlePublish = async () => {
    if (!supabase || !user || publishing) return;
    const parsed = momentCreateSchema.safeParse({
      caption,
      backgroundTone: tone,
      audience,
      durationHours,
    });
    if (!parsed.success) {
      showToast(
        parsed.error.issues[0]?.message || "Check Moment caption.",
        "error"
      );
      return;
    }
    if (!parsed.data.caption && !pickedImage) {
      showToast("Add a caption or select an image.", "error");
      return;
    }

    setPublishing(true);
    try {
      let mediaPath: string | null = null;
      if (pickedImage) {
        setUploadPercent(0);
        const upId = createClientUuid();
        activeUploadIdRef.current = upId;
        mediaPath = buildSocialMediaStoragePath(
          "moments",
          user.id,
          pickedImage.fileName
        );
        await uploadValidatedNativeFile({
          supabase,
          bucket: "social-media",
          storagePath: mediaPath,
          file: pickedImage,
          uploadId: upId,
          onProgress: (pct) => setUploadPercent(pct),
        });
      }

      const { error } = await supabase.from("moments").insert({
        author_id: user.id,
        caption: parsed.data.caption,
        background_tone: parsed.data.backgroundTone,
        audience: parsed.data.audience,
        duration_hours: parsed.data.durationHours,
        media_path: mediaPath,
        media_mime: pickedImage?.normalizedMime || null,
        media_width: pickedImage?.width || null,
        media_height: pickedImage?.height || null,
      });
      if (error) throw new Error(error.message);

      setComposeVisible(false);
      setCaption("");
      setPickedImage(null);
      setUploadPercent(null);
      showToast(`Moment published (${durationHours}h)`, "success");
      await loadMoments();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not publish Moment.",
        "error"
      );
    } finally {
      setPublishing(false);
      setUploadPercent(null);
      activeUploadIdRef.current = null;
    }
  };

  const handleDeleteMoment = async (momentId: string) => {
    if (!supabase) return;
    const { error } = await supabase
      .from("moments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", momentId);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    setActiveIndex(null);
    showToast("Moment deleted.", "info");
    await loadMoments();
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
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.eyebrow, { color: palette.textMuted }]}>
              EPHEMERAL UPDATES
            </Text>
            <Text style={[styles.title, { color: palette.textPrimary }]}>
              Moments
            </Text>
          </View>
          <Pressable
            onPress={() => setComposeVisible(true)}
            style={[styles.primaryBtn, { backgroundColor: palette.accentBg }]}
          >
            <Text style={[styles.primaryBtnText, { color: palette.accentFg }]}>
              + Share Moment
            </Text>
          </Pressable>
        </View>
        <Text style={{ color: palette.textSecondary, fontSize: 12 }}>
          6h–48h temporary updates enforced at the database RLS &amp; signed
          media layer.
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.accent} />
        </View>
      ) : (
        <FlatList
          data={moments}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 10 }}
          contentContainerStyle={{ padding: 14, gap: 10 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void loadMoments();
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
              <Text
                style={{
                  color: palette.textPrimary,
                  fontSize: 15,
                  fontWeight: "800",
                }}
              >
                No active Moments right now
              </Text>
              <Text
                style={{
                  color: palette.textSecondary,
                  fontSize: 12.5,
                  textAlign: "center",
                  marginTop: 6,
                }}
              >
                Share a brief visual or text update that automatically expires
                after 6, 12, 24, or 48 hours.
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const toneCfg = TONE_HEX[item.background_tone] || TONE_HEX.obsidian;
            const unread =
              item.author_id !== user?.id && !item.viewer_has_viewed;

            return (
              <Pressable
                onPress={() => setActiveIndex(index)}
                style={[
                  styles.momentTile,
                  {
                    backgroundColor: toneCfg.bg,
                    borderColor: unread ? palette.accent : toneCfg.border,
                    borderWidth: unread ? 2 : 1,
                  },
                ]}
              >
                <View style={styles.tileHeader}>
                  <NativeAvatar
                    supabase={supabase}
                    palette={palette}
                    label={item.author_display_name}
                    storagePath={item.author_avatar_url}
                    size={28}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        color: toneCfg.fg,
                        fontSize: 12,
                        fontWeight: "800",
                      }}
                    >
                      {item.author_display_name}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{ color: palette.textMuted, fontSize: 10 }}
                    >
                      {formatMomentTimeRemaining(item.expires_at)}
                    </Text>
                  </View>
                </View>

                {item.media_path ? (
                  <NativePrivateImage
                    supabase={supabase}
                    bucket="social-media"
                    path={item.media_path}
                    alt={item.caption || "Moment"}
                    palette={palette}
                    style={{ height: 105, borderRadius: 10 }}
                  />
                ) : (
                  <Text
                    numberOfLines={4}
                    style={{
                      color: toneCfg.fg,
                      fontSize: 13,
                      lineHeight: 18,
                      fontWeight: "600",
                    }}
                  >
                    {item.caption}
                  </Text>
                )}

                <Text style={{ color: palette.textMuted, fontSize: 10.5 }}>
                  {item.view_count} views ·{" "}
                  {item.audience === "orbit"
                    ? "Close Orbit"
                    : item.audience === "contacts"
                      ? "Contacts"
                      : "Everyone"}
                </Text>
              </Pressable>
            );
          }}
        />
      )}

      {/* Full-Screen Viewer Modal */}
      <Modal
        visible={Boolean(activeMoment)}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveIndex(null)}
      >
        {activeMoment ? (
          <View style={styles.viewerBackdrop}>
            <View
              style={[
                styles.viewerCard,
                {
                  backgroundColor:
                    TONE_HEX[activeMoment.background_tone]?.bg || "#0A0A0D",
                  borderColor: palette.borderStrong,
                },
              ]}
            >
              <View style={styles.viewerHeader}>
                <NativeAvatar
                  supabase={supabase}
                  palette={palette}
                  label={activeMoment.author_display_name}
                  storagePath={activeMoment.author_avatar_url}
                  size={34}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color:
                        TONE_HEX[activeMoment.background_tone]?.fg || "#FFFFFF",
                      fontWeight: "800",
                      fontSize: 13.5,
                    }}
                  >
                    {activeMoment.author_display_name}
                  </Text>
                  <Text style={{ color: palette.textMuted, fontSize: 11 }}>
                    @{activeMoment.author_username} ·{" "}
                    {formatMomentTimeRemaining(activeMoment.expires_at)}
                  </Text>
                </View>
                <Pressable onPress={() => setActiveIndex(null)}>
                  <Text
                    style={{
                      color:
                        TONE_HEX[activeMoment.background_tone]?.fg || "#FFFFFF",
                      fontSize: 18,
                      fontWeight: "800",
                    }}
                  >
                    ✕
                  </Text>
                </Pressable>
              </View>

              <View style={styles.viewerBody}>
                {activeMoment.media_path ? (
                  <NativePrivateImage
                    supabase={supabase}
                    bucket="social-media"
                    path={activeMoment.media_path}
                    alt={activeMoment.caption || "Moment image"}
                    palette={palette}
                    style={{ height: 260, resizeMode: "contain" }}
                  />
                ) : null}
                {activeMoment.caption ? (
                  <Text
                    style={{
                      color:
                        TONE_HEX[activeMoment.background_tone]?.fg || "#FFFFFF",
                      fontSize: 16,
                      fontWeight: "600",
                      textAlign: "center",
                      lineHeight: 23,
                      marginTop: 12,
                    }}
                  >
                    {activeMoment.caption}
                  </Text>
                ) : null}
              </View>

              <View style={styles.viewerFooter}>
                <Text style={{ color: palette.textMuted, fontSize: 11.5 }}>
                  {activeMoment.view_count} views
                </Text>

                <View style={{ flexDirection: "row", gap: 10 }}>
                  {activeMoment.author_id === user?.id ? (
                    <Pressable
                      onPress={() => void handleDeleteMoment(activeMoment.id)}
                    >
                      <Text
                        style={{
                          color: palette.danger,
                          fontSize: 12,
                          fontWeight: "700",
                        }}
                      >
                        Delete
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => {
                        const target = activeMoment;
                        setActiveIndex(null);
                        setReportTarget(target);
                      }}
                    >
                      <Text
                        style={{
                          color: palette.textSecondary,
                          fontSize: 12,
                          fontWeight: "700",
                        }}
                      >
                        Report
                      </Text>
                    </Pressable>
                  )}

                  {activeIndex !== null && activeIndex > 0 ? (
                    <Pressable
                      onPress={() =>
                        setActiveIndex((i) => (i !== null ? i - 1 : null))
                      }
                    >
                      <Text
                        style={{
                          color: palette.textPrimary,
                          fontWeight: "800",
                        }}
                      >
                        ← Prev
                      </Text>
                    </Pressable>
                  ) : null}
                  {activeIndex !== null && activeIndex < moments.length - 1 ? (
                    <Pressable
                      onPress={() =>
                        setActiveIndex((i) => (i !== null ? i + 1 : null))
                      }
                    >
                      <Text
                        style={{
                          color: palette.textPrimary,
                          fontWeight: "800",
                        }}
                      >
                        Next →
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </View>
          </View>
        ) : null}
      </Modal>

      {/* Compose Moment Modal */}
      <Modal
        visible={composeVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (activeUploadIdRef.current) {
            void AsterialNative.cancelUpload(activeUploadIdRef.current);
          }
          setComposeVisible(false);
        }}
      >
        <View style={styles.viewerBackdrop}>
          <View
            style={[
              styles.composeSheet,
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
                  fontSize: 18,
                  fontWeight: "800",
                }}
              >
                Share a Moment
              </Text>
              <Text
                style={{
                  color: palette.textSecondary,
                  fontSize: 12,
                  marginTop: 4,
                  lineHeight: 17,
                }}
              >
                Moments disappear automatically from viewers and signed media
                once expired. Underlying database backups rotate on standard
                infrastructure schedules.
              </Text>

              <TextInput
                value={caption}
                onChangeText={setCaption}
                placeholder="Write a brief Moment caption…"
                placeholderTextColor={palette.textMuted}
                multiline
                maxLength={500}
                style={[
                  styles.captionInput,
                  {
                    backgroundColor: palette.bgCanvas,
                    borderColor: palette.borderSubtle,
                    color: palette.textPrimary,
                  },
                ]}
              />

              <View style={styles.rowWrap}>
                {(["obsidian", "graphite", "slate", "ivory"] as const).map(
                  (t) => (
                    <Pressable
                      key={t}
                      onPress={() => setTone(t)}
                      style={[
                        styles.chipBtn,
                        {
                          backgroundColor:
                            tone === t ? palette.accentBg : palette.bgCanvas,
                          borderColor: palette.borderSubtle,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color:
                            tone === t
                              ? palette.accentFg
                              : palette.textSecondary,
                          fontSize: 11.5,
                          fontWeight: "700",
                        }}
                      >
                        {TONE_HEX[t].label}
                      </Text>
                    </Pressable>
                  )
                )}
              </View>

              <View style={styles.rowWrap}>
                {([6, 12, 24, 48] as const).map((hrs) => (
                  <Pressable
                    key={hrs}
                    onPress={() => setDurationHours(hrs)}
                    style={[
                      styles.chipBtn,
                      {
                        backgroundColor:
                          durationHours === hrs
                            ? palette.accentBg
                            : palette.bgCanvas,
                        borderColor: palette.borderSubtle,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color:
                          durationHours === hrs
                            ? palette.accentFg
                            : palette.textSecondary,
                        fontSize: 11.5,
                        fontWeight: "800",
                      }}
                    >
                      {hrs}h
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.rowWrap}>
                {(["everyone", "contacts", "orbit"] as const).map((aud) => (
                  <Pressable
                    key={aud}
                    onPress={() => setAudience(aud)}
                    style={[
                      styles.chipBtn,
                      {
                        backgroundColor:
                          audience === aud
                            ? palette.accentBg
                            : palette.bgCanvas,
                        borderColor: palette.borderSubtle,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color:
                          audience === aud
                            ? palette.accentFg
                            : palette.textSecondary,
                        fontSize: 11.5,
                        fontWeight: "700",
                      }}
                    >
                      {aud === "orbit"
                        ? "Close Orbit"
                        : aud === "contacts"
                          ? "Direct Contacts"
                          : "Everyone"}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                onPress={async () => {
                  try {
                    const img = await pickAndValidateNativeFile("social-image");
                    if (img) setPickedImage(img);
                  } catch (err) {
                    showToast(
                      err instanceof Error ? err.message : "Image rejected.",
                      "error"
                    );
                  }
                }}
                style={[
                  styles.pickPhotoBtn,
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
                    fontWeight: "700",
                  }}
                >
                  {pickedImage
                    ? `Photo: ${pickedImage.fileName} (${formatByteSize(
                        pickedImage.byteSize
                      )})${uploadPercent !== null ? ` · ${uploadPercent}%` : ""}`
                    : "Attach Photo (optional)"}
                </Text>
              </Pressable>

              <View style={{ marginTop: 18, flexDirection: "row", gap: 10 }}>
                <Pressable
                  onPress={() => {
                    if (activeUploadIdRef.current) {
                      void AsterialNative.cancelUpload(
                        activeUploadIdRef.current
                      );
                    }
                    setComposeVisible(false);
                  }}
                  style={[
                    styles.cancelBtn,
                    { borderColor: palette.borderSubtle },
                  ]}
                >
                  <Text
                    style={{ color: palette.textSecondary, fontWeight: "700" }}
                  >
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  disabled={publishing}
                  onPress={() => void handlePublish()}
                  style={[
                    styles.publishBtn,
                    { backgroundColor: palette.accentBg },
                  ]}
                >
                  {publishing ? (
                    <ActivityIndicator color={palette.accentFg} size="small" />
                  ) : (
                    <Text
                      style={{ color: palette.accentFg, fontWeight: "800" }}
                    >
                      Publish Moment
                    </Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ReportModal
        visible={Boolean(reportTarget)}
        palette={palette}
        subjectLabel={
          reportTarget
            ? `Moment by @${reportTarget.author_username}`
            : "Moment"
        }
        onClose={() => setReportTarget(null)}
        onSubmit={async (reason, details) => {
          if (!reportTarget) return;
          await submitReport({
            momentId: reportTarget.id,
            reportedUserId: reportTarget.author_id,
            reason,
            details,
          });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  primaryBtnText: {
    fontSize: 12.5,
    fontWeight: "800",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
  },
  momentTile: {
    flex: 1,
    minHeight: 205,
    borderRadius: 18,
    padding: 13,
    justifyContent: "space-between",
    gap: 10,
  },
  tileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.82)",
    justifyContent: "center",
    padding: 18,
  },
  viewerCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    minHeight: 380,
    justifyContent: "space-between",
  },
  viewerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  viewerBody: {
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  viewerFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  composeSheet: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    maxHeight: "90%",
  },
  captionInput: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 84,
    padding: 12,
    fontSize: 14,
    textAlignVertical: "top",
  },
  rowWrap: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chipBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  pickPhotoBtn: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
  },
  publishBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
});
