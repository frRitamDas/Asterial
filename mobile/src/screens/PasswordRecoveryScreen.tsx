import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { classifyAuthError, passwordSchema } from "@asterial/core";
import { BrandLockup } from "../components/AsterialEmblem";
import { useMobileWorkspace } from "../context/MobileWorkspaceContext";

export function PasswordRecoveryScreen() {
  const {
    supabase,
    palette,
    exitPasswordRecovery,
    retryBootstrap,
    showToast,
  } = useMobileWorkspace();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const handleSavePassword = async () => {
    if (!supabase || busy) return;
    setErrorText(null);

    const parsed = passwordSchema.safeParse(newPassword);
    if (!parsed.success) {
      setErrorText(
        parsed.error.issues[0]?.message ||
          "Password must be at least 8 characters."
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorText("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        setErrorText(classifyAuthError(error).userMessage);
        return;
      }
      exitPasswordRecovery();
      showToast("Password updated.", "success");
      await retryBootstrap();
    } catch (err) {
      setErrorText(classifyAuthError(err).userMessage);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: palette.bgCanvas }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: palette.bgSurface,
            borderColor: palette.borderSubtle,
          },
        ]}
      >
        <BrandLockup palette={palette} />
        <Text style={[styles.title, { color: palette.textPrimary }]}>
          Set a new password
        </Text>
        <Text style={[styles.sub, { color: palette.textSecondary }]}>
          Choose a strong password of at least 8 characters to secure your
          Asterial account.
        </Text>

        {errorText ? (
          <Text style={[styles.err, { color: palette.danger }]}>
            {errorText}
          </Text>
        ) : null}

        <TextInput
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="New password"
          placeholderTextColor={palette.textMuted}
          secureTextEntry
          style={[
            styles.input,
            {
              backgroundColor: palette.bgCanvas,
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
          style={[
            styles.input,
            {
              backgroundColor: palette.bgCanvas,
              borderColor: palette.borderSubtle,
              color: palette.textPrimary,
            },
          ]}
        />

        <Pressable
          disabled={busy}
          onPress={() => void handleSavePassword()}
          style={[styles.btn, { backgroundColor: palette.accentBg }]}
        >
          {busy ? (
            <ActivityIndicator color={palette.accentFg} />
          ) : (
            <Text style={[styles.btnText, { color: palette.accentFg }]}>
              Update Password
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={exitPasswordRecovery}
          style={{ marginTop: 12, alignItems: "center" }}
        >
          <Text style={{ color: palette.textSecondary, fontSize: 12.5 }}>
            Skip for now
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 22,
    gap: 12,
  },
  title: {
    marginTop: 6,
    fontSize: 20,
    fontWeight: "800",
  },
  sub: {
    fontSize: 13,
    lineHeight: 18,
  },
  err: {
    fontSize: 12.5,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14.5,
  },
  btn: {
    marginTop: 6,
    borderRadius: 13,
    paddingVertical: 13,
    alignItems: "center",
  },
  btnText: {
    fontSize: 14,
    fontWeight: "800",
  },
});
