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
import {
  ASTERIAL_BRAND,
  loginSchema,
  passwordUpdateSchema,
  resetRequestSchema,
  signupSchema,
  usernameSchema,
} from "@asterial/core";
import { BrandLockup } from "../components/AsterialEmblem";
import { useMobileWorkspace } from "../context/MobileWorkspaceContext";

type AuthViewMode = "signin" | "signup" | "reset_request" | "verify_pending";

export function AuthScreen({
  forceRecoveryMode = false,
}: {
  forceRecoveryMode?: boolean;
}) {
  const {
    supabase,
    palette,
    sessionNotice,
    clearSessionNotice,
    exitPasswordRecovery,
    refreshWorkspace,
    showToast,
  } = useMobileWorkspace();

  const [mode, setMode] = useState<AuthViewMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [usernameState, setUsernameState] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const activeRecovery = forceRecoveryMode;

  // Live @username availability check during registration
  useEffect(() => {
    if (mode !== "signup" || activeRecovery || !supabase) return;
    const cleaned = username.trim().toLowerCase();
    if (!cleaned) return;

    const valid = usernameSchema.safeParse(cleaned);
    if (!valid.success) return;

    let active = true;
    const timer = setTimeout(async () => {
      setUsernameState("checking");
      const { data, error } = await supabase.rpc("check_username_available", {
        p_username: cleaned,
      });
      if (!active) return;
      if (error) {
        setUsernameState("idle");
        return;
      }
      setUsernameState(data ? "available" : "taken");
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [activeRecovery, mode, supabase, username]);

  const computedUsernameStatus = (() => {
    const cleaned = username.trim().toLowerCase();
    if (!cleaned) return null;
    if (!usernameSchema.safeParse(cleaned).success) {
      return {
        color: palette.danger,
        label: "Use 3–24 lowercase letters, numbers, or underscores.",
      };
    }
    if (usernameState === "checking") {
      return { color: palette.textMuted, label: "Checking @username…" };
    }
    if (usernameState === "available") {
      return { color: palette.success, label: `@${cleaned} is available` };
    }
    if (usernameState === "taken") {
      return { color: palette.danger, label: `@${cleaned} is already taken` };
    }
    return null;
  })();

  const switchMode = (next: AuthViewMode) => {
    setMode(next);
    setErrorMsg(null);
    setInfoMsg(null);
    clearSessionNotice();
  };

  const handleSignIn = async () => {
    if (!supabase) return;
    setErrorMsg(null);
    setInfoMsg(null);
    clearSessionNotice();

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrorMsg(parsed.error.issues[0]?.message || "Check your credentials.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (error) {
        const lower = error.message.toLowerCase();
        if (lower.includes("email not confirmed")) {
          setMode("verify_pending");
          setInfoMsg(
            "Please confirm your email address first, or resend the confirmation email below."
          );
          return;
        }
        setErrorMsg(
          lower.includes("invalid login")
            ? "Incorrect email or password."
            : error.message
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignUp = async () => {
    if (!supabase) return;
    setErrorMsg(null);
    setInfoMsg(null);
    clearSessionNotice();

    const parsed = signupSchema.safeParse({
      email,
      password,
      displayName,
      username,
    });
    if (!parsed.success) {
      setErrorMsg(parsed.error.issues[0]?.message || "Check registration fields.");
      return;
    }

    if (usernameState === "taken") {
      setErrorMsg(`@${parsed.data.username} is already taken.`);
      return;
    }

    setSubmitting(true);
    try {
      const { data: avail } = await supabase.rpc("check_username_available", {
        p_username: parsed.data.username,
      });
      if (avail === false) {
        setUsernameState("taken");
        setErrorMsg(`@${parsed.data.username} is already taken.`);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: "asterial://auth/callback",
          data: {
            username: parsed.data.username,
            display_name: parsed.data.displayName,
          },
        },
      });

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      if (data.session) {
        showToast("Welcome to ASTERIAL.", "success");
      } else {
        setMode("verify_pending");
        setInfoMsg(
          `Confirmation link sent to ${parsed.data.email}. Open it on this Android device to sign in automatically.`
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestReset = async () => {
    if (!supabase) return;
    setErrorMsg(null);
    setInfoMsg(null);

    const parsed = resetRequestSchema.safeParse({ email });
    if (!parsed.success) {
      setErrorMsg(parsed.error.issues[0]?.message || "Enter a valid email.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        parsed.data.email,
        {
          redirectTo: "asterial://auth/callback?type=recovery",
        }
      );
      if (error) {
        setErrorMsg(error.message);
        return;
      }
      setInfoMsg(
        `Password recovery instructions sent to ${parsed.data.email}. Tap the recovery link in your email to set a new password here.`
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!supabase || !email.trim()) {
      setErrorMsg("Enter your email address above first.");
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: "asterial://auth/callback" },
      });
      if (error) {
        setErrorMsg(error.message);
      } else {
        setInfoMsg("Fresh confirmation email sent.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!supabase) return;
    setErrorMsg(null);
    setInfoMsg(null);

    const parsed = passwordUpdateSchema.safeParse({
      password,
      confirmPassword,
    });
    if (!parsed.success) {
      setErrorMsg(
        parsed.error.issues[0]?.message || "Check your new password."
      );
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: parsed.data.password,
      });
      if (error) {
        setErrorMsg(error.message);
        return;
      }
      setPassword("");
      setConfirmPassword("");
      exitPasswordRecovery();
      showToast("Password updated.", "success");
      await refreshWorkspace();
    } finally {
      setSubmitting(false);
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
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandSection}>
          <BrandLockup
            palette={palette}
            subtitle={`Private Real-Time Messaging · ${ASTERIAL_BRAND.attribution}`}
          />
        </View>

        {sessionNotice ? (
          <View
            style={[
              styles.noticeCard,
              {
                backgroundColor: palette.bgSurface,
                borderColor: palette.accent,
              },
            ]}
          >
            <Text style={[styles.noticeText, { color: palette.textPrimary }]}>
              {sessionNotice}
            </Text>
          </View>
        ) : null}

        <View
          style={[
            styles.authCard,
            {
              backgroundColor: palette.bgSurface,
              borderColor: palette.borderSubtle,
            },
          ]}
        >
          {activeRecovery ? (
            <>
              <Text style={[styles.eyebrow, { color: palette.accent }]}>
                ACCOUNT RECOVERY
              </Text>
              <Text style={[styles.heading, { color: palette.textPrimary }]}>
                Set New Password
              </Text>
              <Text style={[styles.subheading, { color: palette.textSecondary }]}>
                Choose a strong password (at least 8 characters with letters and
                numbers).
              </Text>

              <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
                New Password
              </Text>
              <View
                style={[
                  styles.passwordWrap,
                  {
                    backgroundColor: palette.bgElevated,
                    borderColor: palette.borderSubtle,
                  },
                ]}
              >
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Minimum 8 characters"
                  placeholderTextColor={palette.textMuted}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  accessibilityLabel="New password"
                  style={[styles.passwordInput, { color: palette.textPrimary }]}
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword ? "Hide password" : "Show password"
                  }
                  style={styles.toggleBtn}
                >
                  <Text style={{ color: palette.accent, fontWeight: "700", fontSize: 12 }}>
                    {showPassword ? "Hide" : "Show"}
                  </Text>
                </Pressable>
              </View>

              <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
                Confirm Password
              </Text>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter new password"
                placeholderTextColor={palette.textMuted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                accessibilityLabel="Confirm new password"
                style={[
                  styles.input,
                  {
                    backgroundColor: palette.bgElevated,
                    borderColor: palette.borderSubtle,
                    color: palette.textPrimary,
                  },
                ]}
              />

              {errorMsg ? (
                <Text style={[styles.errorText, { color: palette.danger }]}>
                  {errorMsg}
                </Text>
              ) : null}

              <Pressable
                onPress={() => void handleUpdatePassword()}
                disabled={submitting}
                accessibilityRole="button"
                style={[styles.submitBtn, { backgroundColor: palette.accent }]}
              >
                {submitting ? (
                  <ActivityIndicator color={palette.accentFg} size="small" />
                ) : (
                  <Text style={[styles.submitBtnText, { color: palette.accentFg }]}>
                    Update Password
                  </Text>
                )}
              </Pressable>
            </>
          ) : mode === "reset_request" ? (
            <>
              <Text style={[styles.eyebrow, { color: palette.accent }]}>
                PASSWORD RECOVERY
              </Text>
              <Text style={[styles.heading, { color: palette.textPrimary }]}>
                Reset your password
              </Text>
              <Text style={[styles.subheading, { color: palette.textSecondary }]}>
                Enter the email linked to your ASTERIAL account to receive a
                recovery deep link.
              </Text>

              <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
                Email Address
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={palette.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Email address"
                style={[
                  styles.input,
                  {
                    backgroundColor: palette.bgElevated,
                    borderColor: palette.borderSubtle,
                    color: palette.textPrimary,
                  },
                ]}
              />

              {errorMsg ? (
                <Text style={[styles.errorText, { color: palette.danger }]}>
                  {errorMsg}
                </Text>
              ) : null}
              {infoMsg ? (
                <Text style={[styles.infoText, { color: palette.success }]}>
                  {infoMsg}
                </Text>
              ) : null}

              <Pressable
                onPress={() => void handleRequestReset()}
                disabled={submitting}
                accessibilityRole="button"
                style={[styles.submitBtn, { backgroundColor: palette.accent }]}
              >
                {submitting ? (
                  <ActivityIndicator color={palette.accentFg} size="small" />
                ) : (
                  <Text style={[styles.submitBtnText, { color: palette.accentFg }]}>
                    Send Recovery Link
                  </Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => switchMode("signin")}
                style={styles.textLinkBtn}
              >
                <Text style={{ color: palette.textSecondary, fontWeight: "600" }}>
                  ← Back to Sign In
                </Text>
              </Pressable>
            </>
          ) : mode === "verify_pending" ? (
            <>
              <Text style={[styles.eyebrow, { color: palette.accent }]}>
                EMAIL CONFIRMATION
              </Text>
              <Text style={[styles.heading, { color: palette.textPrimary }]}>
                Confirm your email
              </Text>
              <Text style={[styles.subheading, { color: palette.textSecondary }]}>
                {infoMsg ||
                  "Open the confirmation link sent to your inbox. ASTERIAL will complete sign-in automatically."}
              </Text>

              {errorMsg ? (
                <Text style={[styles.errorText, { color: palette.danger }]}>
                  {errorMsg}
                </Text>
              ) : null}

              <Pressable
                onPress={() => void handleResendConfirmation()}
                disabled={submitting}
                style={[styles.submitBtn, { backgroundColor: palette.accent }]}
              >
                {submitting ? (
                  <ActivityIndicator color={palette.accentFg} size="small" />
                ) : (
                  <Text style={[styles.submitBtnText, { color: palette.accentFg }]}>
                    Resend Confirmation Email
                  </Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => switchMode("signin")}
                style={styles.textLinkBtn}
              >
                <Text style={{ color: palette.textSecondary, fontWeight: "600" }}>
                  ← Return to Sign In
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <View
                style={[
                  styles.segmentBar,
                  {
                    backgroundColor: palette.bgElevated,
                    borderColor: palette.borderSubtle,
                  },
                ]}
              >
                <Pressable
                  onPress={() => switchMode("signin")}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: mode === "signin" }}
                  style={[
                    styles.segmentItem,
                    mode === "signin" && {
                      backgroundColor: palette.accent,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentLabel,
                      {
                        color:
                          mode === "signin"
                            ? palette.accentFg
                            : palette.textSecondary,
                      },
                    ]}
                  >
                    Sign In
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => switchMode("signup")}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: mode === "signup" }}
                  style={[
                    styles.segmentItem,
                    mode === "signup" && {
                      backgroundColor: palette.accent,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentLabel,
                      {
                        color:
                          mode === "signup"
                            ? palette.accentFg
                            : palette.textSecondary,
                      },
                    ]}
                  >
                    Create Account
                  </Text>
                </Pressable>
              </View>

              {mode === "signup" ? (
                <>
                  <Text
                    style={[styles.fieldLabel, { color: palette.textSecondary }]}
                  >
                    Display Name
                  </Text>
                  <TextInput
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="Your name"
                    placeholderTextColor={palette.textMuted}
                    maxLength={60}
                    accessibilityLabel="Display name"
                    style={[
                      styles.input,
                      {
                        backgroundColor: palette.bgElevated,
                        borderColor: palette.borderSubtle,
                        color: palette.textPrimary,
                      },
                    ]}
                  />

                  <Text
                    style={[styles.fieldLabel, { color: palette.textSecondary }]}
                  >
                    Username
                  </Text>
                  <TextInput
                    value={username}
                    onChangeText={(txt) =>
                      setUsername(txt.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                    }
                    placeholder="unique_handle"
                    placeholderTextColor={palette.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={24}
                    accessibilityLabel="Username"
                    style={[
                      styles.input,
                      {
                        backgroundColor: palette.bgElevated,
                        borderColor: palette.borderSubtle,
                        color: palette.textPrimary,
                      },
                    ]}
                  />
                  {computedUsernameStatus ? (
                    <Text
                      style={{
                        marginTop: 5,
                        fontSize: 11.5,
                        fontWeight: "600",
                        color: computedUsernameStatus.color,
                      }}
                    >
                      {computedUsernameStatus.label}
                    </Text>
                  ) : null}
                </>
              ) : null}

              <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
                Email Address
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={palette.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Email address"
                style={[
                  styles.input,
                  {
                    backgroundColor: palette.bgElevated,
                    borderColor: palette.borderSubtle,
                    color: palette.textPrimary,
                  },
                ]}
              />

              <View style={styles.labelRowBetween}>
                <Text
                  style={[styles.fieldLabel, { color: palette.textSecondary }]}
                >
                  Password
                </Text>
                {mode === "signin" ? (
                  <Pressable onPress={() => switchMode("reset_request")}>
                    <Text
                      style={{
                        marginTop: 12,
                        fontSize: 12,
                        fontWeight: "700",
                        color: palette.accent,
                      }}
                    >
                      Forgot password?
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              <View
                style={[
                  styles.passwordWrap,
                  {
                    backgroundColor: palette.bgElevated,
                    borderColor: palette.borderSubtle,
                  },
                ]}
              >
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder={
                    mode === "signup"
                      ? "8+ chars with letters & numbers"
                      : "Enter your password"
                  }
                  placeholderTextColor={palette.textMuted}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  accessibilityLabel="Password"
                  style={[styles.passwordInput, { color: palette.textPrimary }]}
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword ? "Hide password" : "Show password"
                  }
                  style={styles.toggleBtn}
                >
                  <Text
                    style={{
                      color: palette.accent,
                      fontWeight: "700",
                      fontSize: 12,
                    }}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </Text>
                </Pressable>
              </View>

              {errorMsg ? (
                <Text style={[styles.errorText, { color: palette.danger }]}>
                  {errorMsg}
                </Text>
              ) : null}
              {infoMsg ? (
                <Text style={[styles.infoText, { color: palette.success }]}>
                  {infoMsg}
                </Text>
              ) : null}

              <Pressable
                onPress={() =>
                  void (mode === "signin" ? handleSignIn() : handleSignUp())
                }
                disabled={submitting}
                accessibilityRole="button"
                style={[styles.submitBtn, { backgroundColor: palette.accent }]}
              >
                {submitting ? (
                  <ActivityIndicator color={palette.accentFg} size="small" />
                ) : (
                  <Text style={[styles.submitBtnText, { color: palette.accentFg }]}>
                    {mode === "signin" ? "Sign In" : "Create ASTERIAL Account"}
                  </Text>
                )}
              </Pressable>
            </>
          )}
        </View>

        <View style={styles.footerBlock}>
          <Text style={[styles.footerMeta, { color: palette.textMuted }]}>
            {ASTERIAL_BRAND.name} v{ASTERIAL_BRAND.version} · Developer:{" "}
            {ASTERIAL_BRAND.developer} · {ASTERIAL_BRAND.attribution}
          </Text>
          <Text style={[styles.footerSub, { color: palette.textMuted }]}>
            Protected by TLS in transit & Supabase Row-Level Security
          </Text>
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
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  brandSection: {
    marginBottom: 20,
  },
  noticeCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 14,
  },
  noticeText: {
    fontSize: 12.5,
    fontWeight: "600",
    lineHeight: 18,
  },
  authCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
  },
  eyebrow: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  heading: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: "800",
  },
  subheading: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 19,
  },
  segmentBar: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 14,
    padding: 3,
    marginBottom: 6,
  },
  segmentItem: {
    flex: 1,
    borderRadius: 11,
    paddingVertical: 9,
    alignItems: "center",
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: "800",
  },
  labelRowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fieldLabel: {
    marginTop: 12,
    marginBottom: 5,
    fontSize: 12,
    fontWeight: "700",
  },
  input: {
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14,
  },
  passwordWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 13,
    paddingLeft: 13,
    paddingRight: 6,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 14,
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  errorText: {
    marginTop: 10,
    fontSize: 12.5,
    fontWeight: "600",
    lineHeight: 17,
  },
  infoText: {
    marginTop: 10,
    fontSize: 12.5,
    fontWeight: "600",
    lineHeight: 17,
  },
  submitBtn: {
    marginTop: 18,
    borderRadius: 14,
    paddingVertical: 13.5,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnText: {
    color: "#0B0C10",
    fontSize: 14,
    fontWeight: "800",
  },
  textLinkBtn: {
    marginTop: 14,
    alignItems: "center",
    paddingVertical: 6,
  },
  footerBlock: {
    marginTop: 22,
    alignItems: "center",
    gap: 3,
  },
  footerMeta: {
    fontSize: 11.5,
    fontWeight: "600",
    textAlign: "center",
  },
  footerSub: {
    fontSize: 11,
    textAlign: "center",
  },
});
