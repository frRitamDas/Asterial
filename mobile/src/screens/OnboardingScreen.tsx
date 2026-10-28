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

export function OnboardingScreen() {
  const {
    supabase,
    user,
    profile,
    palette,
    refreshWorkspace,
    signOut,
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
  const [avatarPath, setAvatarPath] = useState<string | null>(
    () => profile?.avatar_url || null
  );
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [availability, setAvailability] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");
  const [saving, setSaving] = useState(false);
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

  const handlePickAvatar = async () => {
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
      setAvatarPath(storagePath);
      showToast("Profile photo uploaded.", "success");
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Could not upload profile photo."
      );
    } finally {
      setUploadPercent(null);
    }
  };

  const handleComplete = async () => {
    if (!supabase) return;
    setErrorMsg(null);

    const parsed = profileSchema.safeParse({
      username,
      displayName,
      bio,
      statusText,
    });
    if (!parsed.success) {
      setErrorMsg(parsed.error.issues[0]?.message || "Check profile details.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.rpc("complete_profile_onboarding", {
        p_username: parsed.data.username,
        p_display_name: parsed.data.displayName,
        p_bio: parsed.data.bio,
        p_status_text: parsed.data.statusText,
      });
      if (error) {
        setErrorMsg(error.message);
        return;
      }
      if (avatarPath && user?.id) {
        await supabase
          .from("profiles")
          .update({ avatar_url: avatarPath })
          .eq("id", user.id);
      }
      showToast("Profile ready.", "success");
      await refreshWorkspace();
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: palette.bgVoid }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topRow}>
          <BrandLockup palette={palette} compact />
          <Pressable onPress={() => void signOut()} style={styles.signOutBtn}>
            <Text style={{ color: palette.textSecondary, fontWeight: "700" }}>
              Sign Out
            </Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: palette.bgSurface,
              borderColor: palette.borderSubtle,
            },
          ]}
        >
          <View style={styles.stepRow}>
            <Text style={[styles.eyebrow, { color: palette.accent }]}>YOUR PROFILE</Text>
            <Text style={[styles.stepCount, { color: palette.textMuted }]}>01 / 01</Text>
          </View>
          <Text style={[styles.heading, { color: palette.textPrimary }]}>
            Make it yours.
          </Text>
          <Text style={[styles.sub, { color: palette.textSecondary }]}>
            Add the details your friends will recognise. You can always change them later.
          </Text>

          <View style={styles.avatarRow}>
            <NativeAvatar
              supabase={supabase}
              storagePath={avatarPath}
              label={displayName || username || "AS"}
              palette={palette}
              size={64}
            />
            <View style={styles.avatarCol}>
              <Pressable
                onPress={() => void handlePickAvatar()}
                disabled={uploadPercent !== null}
                style={[
                  styles.photoBtn,
                  {
                    backgroundColor: palette.bgElevated,
                    borderColor: palette.borderSubtle,
                  },
                ]}
              >
                <Text style={{ color: palette.accent, fontWeight: "700" }}>
                  {uploadPercent !== null
                    ? `Uploading ${uploadPercent}%…`
                    : "Choose Profile Photo"}
                </Text>
              </Pressable>
              <Text style={{ fontSize: 11, color: palette.textMuted }}>
                JPEG, PNG, WEBP, or GIF up to 5 MB
              </Text>
            </View>
          </View>

          <Text style={[styles.label, { color: palette.textSecondary }]}>
            Display Name
          </Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your full or preferred name"
            placeholderTextColor={palette.textMuted}
            maxLength={60}
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
            placeholder="your_handle"
            placeholderTextColor={palette.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={24}
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
                ? "Checking availability…"
                : availability === "taken"
                ? `@${username} is already taken`
                : availability === "available"
                ? `@${username} is available`
                : ""}
            </Text>
          ) : null}

          <Text style={[styles.label, { color: palette.textSecondary }]}>
            Status (Optional)
          </Text>
          <TextInput
            value={statusText}
            onChangeText={setStatusText}
            placeholder="Available on ASTERIAL"
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

          <Text style={[styles.label, { color: palette.textSecondary }]}>
            Bio (Optional)
          </Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="Tell contacts a bit about yourself"
            placeholderTextColor={palette.textMuted}
            multiline
            maxLength={240}
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
            <Text style={[styles.errText, { color: palette.danger }]}>
              {errorMsg}
            </Text>
          ) : null}

          <Pressable
            onPress={() => void handleComplete()}
            disabled={saving}
            style={[styles.primaryBtn, { backgroundColor: palette.accent }]}
          >
            {saving ? (
              <ActivityIndicator color={palette.accentFg} size="small" />
            ) : (
              <Text style={[styles.primaryBtnText, { color: palette.accentFg }]}>
                Enter Workspace
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
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: "center",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 22,
  },
  signOutBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  card: {
    borderWidth: 1,
    borderRadius: 30,
    padding: 23,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepCount: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.1,
  },
  eyebrow: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  heading: {
    marginTop: 10,
    fontSize: 29,
    lineHeight: 35,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  sub: {
    marginTop: 7,
    fontSize: 13.5,
    lineHeight: 21,
  },
  avatarRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarCol: {
    flex: 1,
    gap: 4,
  },
  photoBtn: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  label: {
    marginTop: 12,
    marginBottom: 5,
    fontSize: 12,
    fontWeight: "700",
  },
  input: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontSize: 14,
  },
  bioInput: {
    minHeight: 68,
    textAlignVertical: "top",
  },
  errText: {
    marginTop: 10,
    fontSize: 12.5,
    fontWeight: "600",
  },
  primaryBtn: {
    marginTop: 20,
    borderRadius: 17,
    paddingVertical: 15,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#0B0C10",
    fontSize: 14,
    fontWeight: "800",
  },
});
