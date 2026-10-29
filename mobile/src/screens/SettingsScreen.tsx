import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  ASTERIAL_BRAND,
  THEME_PALETTES,
  isUpdateAvailable,
  passwordUpdateSchema,
  type AllowDirectMessages,
  type AppearanceTheme,
  type PresenceVisibility,
  type ProfileRow,
} from "@asterial/core";
import { useMobileWorkspace } from "../context/MobileWorkspaceContext";

const THEME_OPTIONS: AppearanceTheme[] = [
  "obsidian",
  "pitch",
  "graphite",
  "alabaster",
  "system",
];

interface LiveReleaseCheck {
  version: string;
  semver: string;
  versionCode: number;
  expectedTag: string;
  tagReleasePublished: boolean;
  verifiedApkDownloadUrl: string | null;
  githubReleasesUrl: string;
  signingStatus: string;
}

export function SettingsScreen() {
  const {
    supabase,
    profile,
    preferences,
    theme,
    palette,
    density,
    reducedMotion,
    blockedIds,
    installedAppInfo,
    updateAppearancePreferences,
    updateProfileRecord,
    toggleBlockUser,
    signOut,
    deleteOwnAccount,
    showToast,
  } = useMobileWorkspace();

  const [blockedProfiles, setBlockedProfiles] = useState<ProfileRow[]>([]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPass, setChangingPass] = useState(false);

  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [liveRelease, setLiveRelease] = useState<LiveReleaseCheck | null>(null);

  useEffect(() => {
    let active = true;
    const ids = Array.from(blockedIds);
    if (!supabase || ids.length === 0) {
      return () => {
        active = false;
      };
    }

    void supabase
      .from("profiles")
      .select("*")
      .in("id", ids)
      .then(({ data }) => {
        if (active) {
          setBlockedProfiles((data || []) as ProfileRow[]);
        }
      });

    return () => {
      active = false;
    };
  }, [blockedIds, supabase]);

  const visibleBlockedProfiles =
    blockedIds.size === 0
      ? []
      : blockedProfiles.filter((p) => blockedIds.has(p.id));

  const checkLiveRelease = useCallback(async () => {
    setCheckingUpdate(true);
    try {
      const res = await fetch(`${ASTERIAL_BRAND.productionUrl}/api/release`);
      if (res.ok) {
        const json = (await res.json()) as LiveReleaseCheck;
        setLiveRelease(json);
      }
    } catch {
      // Offline or unreachable — retain bundled release info
    } finally {
      setCheckingUpdate(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      void checkLiveRelease();
    }, 0);
    return () => clearTimeout(id);
  }, [checkLiveRelease]);

  const handlePasswordChange = async () => {
    if (!supabase) return;
    const parsed = passwordUpdateSchema.safeParse({
      password: newPassword,
      confirmPassword,
    });
    if (!parsed.success) {
      showToast(
        parsed.error.issues[0]?.message || "Check password requirements.",
        "error"
      );
      return;
    }

    setChangingPass(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: parsed.data.password,
      });
      if (error) {
        showToast(error.message, "error");
        return;
      }
      setNewPassword("");
      setConfirmPassword("");
      showToast("Password updated.", "success");
    } finally {
      setChangingPass(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim() !== "DELETE") {
      showToast("Type DELETE in uppercase to confirm.", "error");
      return;
    }
    setDeletingAccount(true);
    try {
      await deleteOwnAccount();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not delete account.",
        "error"
      );
    } finally {
      setDeletingAccount(false);
    }
  };

  const installedSemver =
    installedAppInfo?.baseVersionName || ASTERIAL_BRAND.semver;
  const installedCode =
    installedAppInfo?.versionCode || ASTERIAL_BRAND.versionCode;
  const updateAvailable = liveRelease
    ? isUpdateAvailable({
        currentVersion: installedSemver,
        currentVersionCode: installedCode,
        latestVersion: liveRelease.semver,
        latestVersionCode: liveRelease.versionCode,
      })
    : false;

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
            Settings
          </Text>
          <Text style={[styles.screenSubtitle, { color: palette.textMuted }]}>
            Appearance, privacy & release
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Appearance & Theme */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: palette.bgSurface,
              borderColor: palette.borderSubtle,
            },
          ]}
        >
          <Text style={[styles.eyebrow, { color: palette.accent }]}>
            APPEARANCE & THEME
          </Text>
          <View style={styles.themeGrid}>
            {THEME_OPTIONS.map((key) => {
              const p = THEME_PALETTES[key];
              const active = theme === key;
              return (
                <Pressable
                  key={key}
                  onPress={() =>
                    void updateAppearancePreferences({ appearance_theme: key })
                  }
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  style={[
                    styles.themeTile,
                    {
                      backgroundColor: p.bgVoid,
                      borderColor: active ? palette.accent : p.borderSubtle,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.swatchDot,
                      { backgroundColor: p.accent },
                    ]}
                  />
                  <Text
                    style={{
                      color: p.textPrimary,
                      fontWeight: "700",
                      fontSize: 12.5,
                    }}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.subHeading, { color: palette.textSecondary }]}>
            Message Density
          </Text>
          <View style={styles.inlineSegment}>
            {(["comfortable", "compact"] as const).map((d) => {
              const active = density === d;
              return (
                <Pressable
                  key={d}
                  onPress={() =>
                    void updateAppearancePreferences({ message_density: d })
                  }
                  style={[
                    styles.segmentBtn,
                    {
                      backgroundColor: active
                        ? palette.accent
                        : palette.bgElevated,
                      borderColor: active
                        ? palette.accent
                        : palette.borderSubtle,
                    },
                  ]}
                >
                    <Text
                      style={{
                        color: active ? palette.accentFg : palette.textPrimary,
                        fontWeight: "700",
                        fontSize: 12.5,
                      }}
                    >
                    {d === "comfortable" ? "Comfortable" : "Compact"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.toggleRow}>
            <Text style={{ color: palette.textPrimary, fontSize: 13.5 }}>
              Reduced Motion
            </Text>
            <Switch
              value={reducedMotion}
              onValueChange={(val) =>
                void updateAppearancePreferences({ reduced_motion: val })
              }
              trackColor={{
                false: palette.bgElevated,
                true: palette.accent,
              }}
            />
          </View>
        </View>

        {/* Privacy Controls */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: palette.bgSurface,
              borderColor: palette.borderSubtle,
            },
          ]}
        >
          <Text style={[styles.eyebrow, { color: palette.accent }]}>
            PRIVACY & SAFETY
          </Text>

          <Text style={[styles.subHeading, { color: palette.textSecondary }]}>
            Online Presence Visibility
          </Text>
          <View style={styles.inlineSegment}>
            {(["everyone", "contacts", "nobody"] as PresenceVisibility[]).map(
              (vis) => {
                const active =
                  (profile?.presence_visibility || "everyone") === vis;
                return (
                  <Pressable
                    key={vis}
                    onPress={() =>
                      void updateProfileRecord({ presence_visibility: vis })
                    }
                    style={[
                      styles.segmentBtn,
                      {
                        backgroundColor: active
                          ? palette.accent
                          : palette.bgElevated,
                        borderColor: active
                          ? palette.accent
                          : palette.borderSubtle,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: active ? palette.accentFg : palette.textPrimary,
                        fontWeight: "700",
                        fontSize: 12,
                      }}
                    >
                      {vis.charAt(0).toUpperCase() + vis.slice(1)}
                    </Text>
                  </Pressable>
                );
              }
            )}
          </View>

          <Text style={[styles.subHeading, { color: palette.textSecondary }]}>
            Allow New Direct Messages
          </Text>
          <View style={styles.inlineSegment}>
            {(["everyone", "none"] as AllowDirectMessages[]).map((opt) => {
              const active =
                (profile?.allow_direct_messages || "everyone") === opt;
              return (
                <Pressable
                  key={opt}
                  onPress={() =>
                    void updateProfileRecord({ allow_direct_messages: opt })
                  }
                  style={[
                    styles.segmentBtn,
                    {
                      backgroundColor: active
                        ? palette.accent
                        : palette.bgElevated,
                      borderColor: active
                        ? palette.accent
                        : palette.borderSubtle,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? palette.accentFg : palette.textPrimary,
                      fontWeight: "700",
                      fontSize: 12,
                    }}
                  >
                    {opt === "everyone" ? "Everyone" : "No New Requests"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.toggleRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ color: palette.textPrimary, fontSize: 13.5 }}>
                Read Receipts
              </Text>
              <Text style={{ color: palette.textMuted, fontSize: 11.5 }}>
                Mutual: disabling hides read timestamps both ways
              </Text>
            </View>
            <Switch
              value={profile?.read_receipts_enabled ?? true}
              onValueChange={(val) =>
                void updateProfileRecord({ read_receipts_enabled: val })
              }
              trackColor={{
                false: palette.bgElevated,
                true: palette.accent,
              }}
            />
          </View>

          {visibleBlockedProfiles.length > 0 ? (
            <View style={{ marginTop: 12 }}>
              <Text
                style={[styles.subHeading, { color: palette.textSecondary }]}
              >
                Blocked Accounts ({visibleBlockedProfiles.length})
              </Text>
              {visibleBlockedProfiles.map((bp) => (
                <View
                  key={bp.id}
                  style={[
                    styles.blockedItemRow,
                    { borderBottomColor: palette.borderSubtle },
                  ]}
                >
                  <Text style={{ color: palette.textPrimary, flex: 1 }}>
                    @{bp.username}
                  </Text>
                  <Pressable onPress={() => void toggleBlockUser(bp.id)}>
                    <Text
                      style={{
                        color: palette.accent,
                        fontWeight: "700",
                        fontSize: 12.5,
                      }}
                    >
                      Unblock
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* In-App Alerts */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: palette.bgSurface,
              borderColor: palette.borderSubtle,
            },
          ]}
        >
          <Text style={[styles.eyebrow, { color: palette.accent }]}>
            IN-APP NOTIFICATIONS
          </Text>
          <View style={styles.toggleRow}>
            <Text style={{ color: palette.textPrimary, fontSize: 13.5 }}>
              In-App Message Alerts
            </Text>
            <Switch
              value={preferences?.in_app_enabled ?? true}
              onValueChange={(v) =>
                void updateAppearancePreferences({ in_app_enabled: v })
              }
              trackColor={{ false: palette.bgElevated, true: palette.accent }}
            />
          </View>
          <View style={styles.toggleRow}>
            <Text style={{ color: palette.textPrimary, fontSize: 13.5 }}>
              Show Message Previews
            </Text>
            <Switch
              value={preferences?.message_preview ?? true}
              onValueChange={(v) =>
                void updateAppearancePreferences({ message_preview: v })
              }
              trackColor={{ false: palette.bgElevated, true: palette.accent }}
            />
          </View>
          <Text style={{ marginTop: 6, fontSize: 11.5, color: palette.textMuted }}>
            Preferences sync across Android and Web. Background OS push
            notifications (FCM) are not yet enabled in v{ASTERIAL_BRAND.version}.
          </Text>
        </View>

        {/* Security & Password */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: palette.bgSurface,
              borderColor: palette.borderSubtle,
            },
          ]}
        >
          <Text style={[styles.eyebrow, { color: palette.accent }]}>
            ACCOUNT SECURITY
          </Text>
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="New password (8+ chars, letters & numbers)"
            placeholderTextColor={palette.textMuted}
            secureTextEntry
            autoCapitalize="none"
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
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm new password"
            placeholderTextColor={palette.textMuted}
            secureTextEntry
            autoCapitalize="none"
            style={[
              styles.input,
              {
                backgroundColor: palette.bgElevated,
                borderColor: palette.borderSubtle,
                color: palette.textPrimary,
              },
            ]}
          />
          <Pressable
            onPress={() => void handlePasswordChange()}
            disabled={changingPass || !newPassword}
            style={[
              styles.secondaryActionBtn,
              {
                backgroundColor: palette.bgElevated,
                borderColor: palette.borderSubtle,
                opacity: changingPass || !newPassword ? 0.5 : 1,
              },
            ]}
          >
            {changingPass ? (
              <ActivityIndicator color={palette.accent} size="small" />
            ) : (
              <Text style={{ color: palette.textPrimary, fontWeight: "700" }}>
                Update Password
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => void signOut()}
            style={[
              styles.secondaryActionBtn,
              {
                marginTop: 10,
                backgroundColor: palette.bgElevated,
                borderColor: palette.borderSubtle,
              },
            ]}
          >
            <Text style={{ color: palette.accent, fontWeight: "800" }}>
              Sign Out of Device
            </Text>
          </Pressable>
        </View>

        {/* Release & Build Verification */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: palette.bgSurface,
              borderColor: palette.borderSubtle,
            },
          ]}
        >
          <View style={styles.releaseHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.eyebrow, { color: palette.accent }]}>
                ABOUT & RELEASE VERIFICATION
              </Text>
              <Text style={[styles.releaseTitle, { color: palette.textPrimary }]}>
                {ASTERIAL_BRAND.name} v{ASTERIAL_BRAND.version}
              </Text>
            </View>
            <Pressable
              onPress={() => void checkLiveRelease()}
              disabled={checkingUpdate}
              style={[
                styles.smallOutlineBtn,
                { borderColor: palette.borderSubtle },
              ]}
            >
              <Text
                style={{
                  color: palette.accent,
                  fontSize: 11.5,
                  fontWeight: "700",
                }}
              >
                {checkingUpdate ? "Checking…" : "Check Updates"}
              </Text>
            </Pressable>
          </View>

          <Text style={[styles.metaLine, { color: palette.textSecondary }]}>
            Installed OS Package:{" "}
            {installedAppInfo?.applicationId || ASTERIAL_BRAND.androidPackageId}
          </Text>
          <Text style={[styles.metaLine, { color: palette.textSecondary }]}>
            Android versionName: {installedAppInfo?.versionName || ASTERIAL_BRAND.semver}{" "}
            (versionCode {installedCode})
          </Text>
          <Text style={[styles.metaLine, { color: palette.textSecondary }]}>
            Official Developer: {ASTERIAL_BRAND.developer} ·{" "}
            {ASTERIAL_BRAND.attribution}
          </Text>
          <Text style={[styles.metaLine, { color: palette.textMuted }]}>
            Security model: TLS encryption in transit + Supabase PostgreSQL
            Row-Level Security & signed private Storage URLs (not client-side
            E2EE).
          </Text>

          {updateAvailable && liveRelease ? (
            <Pressable
              onPress={() =>
                void Linking.openURL(
                  liveRelease.verifiedApkDownloadUrl ||
                    `${ASTERIAL_BRAND.productionUrl}/download`
                )
              }
              style={[
                styles.updateBtn,
                { backgroundColor: palette.accent },
              ]}
            >
              <Text style={{ color: palette.accentFg, fontWeight: "800" }}>
                Download Update v{liveRelease.semver}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() =>
                void Linking.openURL(`${ASTERIAL_BRAND.productionUrl}/download`)
              }
              style={[
                styles.secondaryActionBtn,
                {
                  marginTop: 12,
                  backgroundColor: palette.bgElevated,
                  borderColor: palette.borderSubtle,
                },
              ]}
            >
              <Text style={{ color: palette.textPrimary, fontWeight: "700" }}>
                Open Official Download Center
              </Text>
            </Pressable>
          )}
        </View>

        {/* Permanent Account Deletion */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: palette.bgSurface,
              borderColor: `${palette.danger}55`,
            },
          ]}
        >
          <Text style={[styles.eyebrow, { color: palette.danger }]}>
            DANGER ZONE
          </Text>
          <Text
            style={{
              marginTop: 4,
              fontSize: 12.5,
              lineHeight: 18,
              color: palette.textSecondary,
            }}
          >
            Permanently deletes your ASTERIAL account, private media, and profile.
            Type DELETE below to confirm.
          </Text>
          <TextInput
            value={deleteConfirmText}
            onChangeText={setDeleteConfirmText}
            placeholder="Type DELETE to confirm"
            placeholderTextColor={palette.textMuted}
            autoCapitalize="characters"
            style={[
              styles.input,
              {
                backgroundColor: palette.bgElevated,
                borderColor: palette.borderSubtle,
                color: palette.textPrimary,
              },
            ]}
          />
          <Pressable
            onPress={() => void handleDeleteAccount()}
            disabled={deletingAccount || deleteConfirmText.trim() !== "DELETE"}
            style={[
              styles.deleteBtn,
              {
                backgroundColor: palette.danger,
                opacity:
                  deletingAccount || deleteConfirmText.trim() !== "DELETE"
                    ? 0.45
                    : 1,
              },
            ]}
          >
            {deletingAccount ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>
                Permanently Delete Account
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  screenHeading: {
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
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  card: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
  },
  eyebrow: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  subHeading: {
    marginTop: 14,
    marginBottom: 7,
    fontSize: 12,
    fontWeight: "700",
  },
  themeGrid: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  themeTile: {
    width: "48%",
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  swatchDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  inlineSegment: {
    flexDirection: "row",
    gap: 7,
  },
  segmentBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 9,
    alignItems: "center",
  },
  toggleRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  blockedItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  input: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 10,
    fontSize: 13.5,
  },
  secondaryActionBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 13,
    paddingVertical: 11.5,
    alignItems: "center",
  },
  releaseHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  releaseTitle: {
    marginTop: 3,
    fontSize: 17,
    fontWeight: "800",
  },
  smallOutlineBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metaLine: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
  },
  updateBtn: {
    marginTop: 12,
    borderRadius: 13,
    paddingVertical: 12,
    alignItems: "center",
  },
  deleteBtn: {
    marginTop: 12,
    borderRadius: 13,
    paddingVertical: 12,
    alignItems: "center",
  },
});
