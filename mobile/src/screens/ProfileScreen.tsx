import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { profileSchema, usernameSchema } from "@asterial/core";
import { BrandLockup } from "../components/AsterialEmblem";
import { NativeAvatar } from "../components/NativeAvatar";
import { useMobileWorkspace } from "../context/MobileWorkspaceContext";
import {
  buildAvatarStoragePath,
  pickAndValidateNativeFile,
  primePrivateSignedUrls,
  uploadValidatedNativeFile,
} from "../lib/storage";

export function ProfileScreen() {
  const {
    supabase,
    user,
    profile,
    palette,
    conversations,
    updateProfileRecord,
    showToast,
  } = useMobileWorkspace();

  const [displayName, setDisplayName] = useState(
    () => profile?.display_name || ""
  );
  const [username, setUsername] = useState(() => profile?.username || "");
  const [statusText, setStatusText] = useState(
    () => profile?.status_text || ""
  );
  const [bio, setBio] = useState(() => profile?.bio || "");
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [availability, setAvailability] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    const cleaned = username.trim().toLowerCase();
    if (!cleaned || cleaned === profile?.username) return;
    if (!usernameSchema.safeParse(cleaned).success) return;

    let active = true;
    const timer = setTimeout(async () => {
      setAvailability("checking");
      const { data } = await supabase.rpc("check_username_available", {
        p_username: cleaned,
      });
      if (!active) return;
      setAvailability(data ? "available" : "taken");
    }, 280);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [profile?.username, supabase, username]);

  const handleAvatarUpload = async () => {
    if (!supabase || !user) return;
    setErrorMsg(null);
    try {
      const picked = await pickAndValidateNativeFile("avatar");
      if (!picked) return;
      const storagePath = buildAvatarStoragePath(user.id, picked.fileName);
      setUploadPercent(0);
      await uploadValidatedNativeFile({
        supabase,
        bucket: "avatars",
        storagePath,
        file: picked,
        upsert: true,
        onProgress: (pct) => setUploadPercent(pct),
      });
      await primePrivateSignedUrls(supabase, "avatars", [storagePath]);
      await updateProfileRecord({ avatar_url: storagePath });
      showToast("Profile photo updated.", "success");
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Could not upload profile photo."
      );
    } finally {
      setUploadPercent(null);
    }
  };

  const handleSaveProfile = async () => {
    setErrorMsg(null);
    const parsed = profileSchema.safeParse({
      username,
      displayName,
      bio,
      statusText,
    });
    if (!parsed.success) {
      setErrorMsg(parsed.error.issues[0]?.message || "Check profile fields.");
      return;
    }

    if (
      parsed.data.username !== profile?.username &&
      availability === "taken"
    ) {
      setErrorMsg(`@${parsed.data.username} is already taken.`);
      return;
    }

    setSaving(true);
    try {
      await updateProfileRecord({
        username: parsed.data.username,
        display_name: parsed.data.displayName,
        bio: parsed.data.bio,
        status_text: parsed.data.statusText,
      });
      showToast("Profile saved.", "success");
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Could not save profile."
      );
    } finally {
      setSaving(false);
    }
  };

  const groupCount = conversations.filter(
    (c) => c.conversation.type === "group"
  ).length;
  const directCount = conversations.filter(
    (c) => c.conversation.type === "direct"
  ).length;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: palette.bgVoid }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View
        style={[
          styles.topBar,
          { borderBottomColor: palette.borderSubtle },
        ]}
      >
        <BrandLockup palette={palette} compact subtitle="Your ASTERIAL Identity" />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: palette.bgSurface,
              borderColor: palette.borderSubtle,
            },
          ]}
        >
          <View style={styles.avatarRow}>
            <NativeAvatar
              supabase={supabase}
              storagePath={profile?.avatar_url}
              label={
                profile?.display_name || profile?.username || "ASTERIAL"
              }
              palette={palette}
              size={72}
              isOnline
            />
            <View style={styles.heroMeta}>
              <Text style={[styles.heroName, { color: palette.textPrimary }]}>
                {profile?.display_name || profile?.username || "Member"}
              </Text>
              <Text style={{ color: palette.accent, fontWeight: "700" }}>
                @{profile?.username || "username"}
              </Text>
              <Text style={{ marginTop: 2, fontSize: 12, color: palette.textMuted }}>
                {user?.email || ""}
              </Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View
              style={[
                styles.statTile,
                {
                  backgroundColor: palette.bgElevated,
                  borderColor: palette.borderSubtle,
                },
              ]}
            >
              <Text style={[styles.statNum, { color: palette.textPrimary }]}>
                {directCount}
              </Text>
              <Text style={[styles.statLabel, { color: palette.textMuted }]}>
                Direct Chats
              </Text>
            </View>
            <View
              style={[
                styles.statTile,
                {
                  backgroundColor: palette.bgElevated,
                  borderColor: palette.borderSubtle,
                },
              ]}
            >
              <Text style={[styles.statNum, { color: palette.textPrimary }]}>
                {groupCount}
              </Text>
              <Text style={[styles.statLabel, { color: palette.textMuted }]}>
                Groups
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => void handleAvatarUpload()}
            disabled={uploadPercent !== null}
            style={[
              styles.uploadBtn,
              {
                backgroundColor: palette.bgElevated,
                borderColor: palette.borderSubtle,
              },
            ]}
          >
            <Text style={{ color: palette.accent, fontWeight: "800" }}>
              {uploadPercent !== null
                ? `Uploading private photo (${uploadPercent}%)…`
                : "Update Profile Photo"}
            </Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.formCard,
            {
              backgroundColor: palette.bgSurface,
              borderColor: palette.borderSubtle,
            },
          ]}
        >
          <Text style={[styles.sectionEyebrow, { color: palette.accent }]}>
            EDIT PROFILE
          </Text>

          <Text style={[styles.label, { color: palette.textSecondary }]}>
            Display Name
          </Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            maxLength={60}
            placeholder="Your display name"
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

          <Text style={[styles.label, { color: palette.textSecondary }]}>
            @username
          </Text>
          <TextInput
            value={username}
            onChangeText={(txt) =>
              setUsername(txt.toLowerCase().replace(/[^a-z0-9_]/g, ""))
            }
            maxLength={24}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="handle"
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
          {username.trim() && username !== profile?.username ? (
            <Text
              style={{
                marginTop: 4,
                fontSize: 11.5,
                fontWeight: "600",
                color:
                  availability === "taken"
                    ? palette.danger
                    : availability === "available"
                    ? palette.success
                    : palette.textMuted,
              }}
            >
              {availability === "checking"
                ? "Checking @username…"
                : availability === "taken"
                ? `@${username} is already taken`
                : availability === "available"
                ? `@${username} is available`
                : ""}
            </Text>
          ) : null}

          <Text style={[styles.label, { color: palette.textSecondary }]}>
            Status
          </Text>
          <TextInput
            value={statusText}
            onChangeText={setStatusText}
            maxLength={80}
            placeholder="Available"
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

          <Text style={[styles.label, { color: palette.textSecondary }]}>
            Bio
          </Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            maxLength={240}
            multiline
            placeholder="Write a short bio"
            placeholderTextColor={palette.textMuted}
            style={[
              styles.input,
              styles.bioInput,
              {
                backgroundColor: palette.bgElevated,
                borderColor: palette.borderSubtle,
                color: palette.textPrimary,
              },
            ]}
          />

          {errorMsg ? (
            <Text style={{ marginTop: 10, color: palette.danger, fontSize: 12.5 }}>
              {errorMsg}
            </Text>
          ) : null}

          <Pressable
            onPress={() => void handleSaveProfile()}
            disabled={saving}
            style={[styles.saveBtn, { backgroundColor: palette.accent }]}
          >
            {saving ? (
              <ActivityIndicator color={palette.accentFg} size="small" />
            ) : (
              <Text style={[styles.saveBtnText, { color: palette.accentFg }]}>
                Save Profile Changes
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  heroMeta: {
    flex: 1,
  },
  heroName: {
    fontSize: 19,
    fontWeight: "800",
  },
  statsRow: {
    marginTop: 16,
    flexDirection: "row",
    gap: 10,
  },
  statTile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
  },
  statNum: {
    fontSize: 18,
    fontWeight: "800",
  },
  statLabel: {
    marginTop: 2,
    fontSize: 11.5,
  },
  uploadBtn: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 13,
    paddingVertical: 11,
    alignItems: "center",
  },
  formCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
  },
  sectionEyebrow: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  label: {
    marginTop: 12,
    marginBottom: 5,
    fontSize: 12,
    fontWeight: "700",
  },
  input: {
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 10,
    fontSize: 14,
  },
  bioInput: {
    minHeight: 74,
    textAlignVertical: "top",
  },
  saveBtn: {
    marginTop: 16,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
  },
  saveBtnText: {
    color: "#0B0C10",
    fontSize: 14,
    fontWeight: "800",
  },
});
