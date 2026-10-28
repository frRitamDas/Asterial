import React, { useCallback, useEffect, useRef, useState } from "react";
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
  classifyAuthError,
  loginSchema,
  passwordUpdateSchema,
  resetRequestSchema,
  signupSchema,
  usernameSchema,
} from "@asterial/core";
import { AsterialEmblem } from "../components/AsterialEmblem";
import { MOBILE_ENV } from "../config/env";
import { useMobileWorkspace } from "../context/MobileWorkspaceContext";
import {
  ensureMobileSupabaseClient,
  verifySupabaseAuthConnectivity,
  type AuthConnectivityStatus,
} from "../lib/supabase";

type AuthMode = "signin" | "signup" | "forgot" | "recovery";

export function AuthScreen({
  forceRecoveryMode = false,
}: {
  forceRecoveryMode?: boolean;
}) {
  const {
    supabase,
    palette,
    isOnline,
    sessionNotice,
    clearSessionNotice,
    exitPasswordRecovery,
    retryBootstrap,
    showToast,
  } = useMobileWorkspace();

  const [mode, setMode] = useState<AuthMode>(
    forceRecoveryMode ? "recovery" : "signin"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [usernameAvailability, setUsernameAvailability] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [retryableError, setRetryableError] = useState(false);
  const [infoText, setInfoText] = useState<string | null>(null);
  const [connectivity, setConnectivity] =
    useState<AuthConnectivityStatus | null>(null);
  const [checkingConn, setCheckingConn] = useState(false);

  const inFlightRef = useRef(false);

  const runHealthCheck = useCallback(async () => {
    setCheckingConn(true);
    try {
      const status = await verifySupabaseAuthConnectivity();
      setConnectivity(status);
    } finally {
      setCheckingConn(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      void runHealthCheck();
    }, 0);
    return () => clearTimeout(id);
  }, [runHealthCheck]);

  // Live @username availability verification during registration
  useEffect(() => {
    if (mode !== "signup") return;
    const normalized = username.trim().toLowerCase();
    if (!normalized) return;

    const valid = usernameSchema.safeParse(normalized);
    if (!valid.success) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (!supabase) return;
      if (!cancelled) setUsernameAvailability("checking");
      try {
        const { data, error } = await supabase.rpc("check_username_available", {
          p_username: normalized,
        });
        if (cancelled) return;
        if (error) {
          setUsernameAvailability("idle");
        } else {
          setUsernameAvailability(data ? "available" : "taken");
        }
      } catch {
        if (!cancelled) setUsernameAvailability("idle");
      }
    }, 320);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mode, supabase, username]);

  const switchMode = (next: AuthMode) => {
    if (inFlightRef.current) return;
    clearSessionNotice();
    setErrorText(null);
    setRetryableError(false);
    setInfoText(null);
    setMode(next);
  };

  const resolveActiveClient = async () => {
    if (supabase) return supabase;
    return ensureMobileSupabaseClient({ forceRemoteRefresh: true });
  };

  const applyClassifiedError = (err: unknown) => {
    const classified = classifyAuthError(err, isOnline);
    setErrorText(classified.userMessage);
    setRetryableError(classified.retryable);
  };

  const handleRetryConnection = async () => {
    if (checkingConn || submitting) return;
    setErrorText(null);
    setCheckingConn(true);
    try {
      await ensureMobileSupabaseClient({ forceRemoteRefresh: true });
      await retryBootstrap();
      const status = await verifySupabaseAuthConnectivity();
      setConnectivity(status);
      if (status.ok) {
        showToast("Authentication service connected.", "success");
      } else if (status.detail) {
        setErrorText(status.detail);
        setRetryableError(true);
      }
    } finally {
      setCheckingConn(false);
    }
  };

  const handleSignIn = async () => {
    if (inFlightRef.current) return;
    clearSessionNotice();
    setErrorText(null);
    setRetryableError(false);
    setInfoText(null);

    const parsed = loginSchema.safeParse({
      email: email.trim(),
      password,
    });
    if (!parsed.success) {
      setErrorText(
        parsed.error.issues[0]?.message || "Enter a valid email and password."
      );
      return;
    }

    if (!isOnline) {
      applyClassifiedError(new Error("Offline"));
      return;
    }

    inFlightRef.current = true;
    setSubmitting(true);
    try {
      const client = await resolveActiveClient();
      if (!client) {
        throw new Error("Workspace connection unavailable");
      }

      const { error } = await client.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });

      if (error) {
        applyClassifiedError(error);
        return;
      }

      showToast("Signed in to ASTERIAL.", "success");
    } catch (err) {
      applyClassifiedError(err);
    } finally {
      setSubmitting(false);
      inFlightRef.current = false;
    }
  };

  const handleSignUp = async () => {
    if (inFlightRef.current) return;
    clearSessionNotice();
    setErrorText(null);
    setRetryableError(false);
    setInfoText(null);

    const cleanUsername = username.trim().toLowerCase();
    const parsed = signupSchema.safeParse({
      username: cleanUsername,
      displayName: displayName.trim(),
      email: email.trim(),
      password,
    });
    if (!parsed.success) {
      setErrorText(
        parsed.error.issues[0]?.message ||
          "Check your registration details and try again."
      );
      return;
    }
    if (usernameAvailability === "taken") {
      setErrorText("That @username is already taken. Choose another handle.");
      return;
    }
    if (!isOnline) {
      applyClassifiedError(new Error("Offline"));
      return;
    }

    inFlightRef.current = true;
    setSubmitting(true);
    try {
      const client = await resolveActiveClient();
      if (!client) {
        throw new Error("Workspace connection unavailable");
      }

      const { data: avail } = await client.rpc("check_username_available", {
        p_username: parsed.data.username,
      });
      if (avail === false) {
        setUsernameAvailability("taken");
        setErrorText("That @username was just claimed. Pick another handle.");
        return;
      }

      const { data, error } = await client.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: MOBILE_ENV.authCallbackRedirectUrl,
          data: {
            username: parsed.data.username,
            display_name: parsed.data.displayName,
          },
        },
      });

      if (error) {
        applyClassifiedError(error);
        return;
      }

      if (data.session) {
        try {
          await client.rpc("complete_profile_onboarding", {
            p_username: parsed.data.username,
            p_display_name: parsed.data.displayName,
            p_bio: "",
            p_status_text: "",
          });
        } catch {
          // Non-fatal: OnboardingScreen fallback will handle if needed
        }
        showToast("Welcome to ASTERIAL.", "success");
        return;
      }

      setInfoText(
        `Account registered for ${parsed.data.email}. Open the confirmation link sent to your inbox to activate sign-in.`
      );
      setMode("signin");
    } catch (err) {
      applyClassifiedError(err);
    } finally {
      setSubmitting(false);
      inFlightRef.current = false;
    }
  };

  const handleForgotPassword = async () => {
    if (inFlightRef.current) return;
    clearSessionNotice();
    setErrorText(null);
    setRetryableError(false);
    setInfoText(null);

    const parsed = resetRequestSchema.safeParse({ email: email.trim() });
    if (!parsed.success) {
      setErrorText(
        parsed.error.issues[0]?.message || "Enter your account email address."
      );
      return;
    }
    if (!isOnline) {
      applyClassifiedError(new Error("Offline"));
      return;
    }

    inFlightRef.current = true;
    setSubmitting(true);
    try {
      const client = await resolveActiveClient();
      if (!client) {
        throw new Error("Workspace connection unavailable");
      }

      const { error } = await client.auth.resetPasswordForEmail(
        parsed.data.email,
        {
          redirectTo: `${MOBILE_ENV.authCallbackRedirectUrl}?type=recovery`,
        }
      );

      if (error) {
        applyClassifiedError(error);
        return;
      }

      setInfoText(
        "If an account exists for that email, a password recovery link has been sent."
      );
    } catch (err) {
      applyClassifiedError(err);
    } finally {
      setSubmitting(false);
      inFlightRef.current = false;
    }
  };

  const handleUpdateRecoveredPassword = async () => {
    if (inFlightRef.current) return;
    setErrorText(null);
    setRetryableError(false);

    const parsed = passwordUpdateSchema.safeParse({
      password,
      confirmPassword,
    });
    if (!parsed.success) {
      setErrorText(
        parsed.error.issues[0]?.message || "Passwords must match (8+ chars)."
      );
      return;
    }

    inFlightRef.current = true;
    setSubmitting(true);
    try {
      const client = await resolveActiveClient();
      if (!client) {
        throw new Error("Workspace connection unavailable");
      }

      const { error } = await client.auth.updateUser({
        password: parsed.data.password,
      });

      if (error) {
        applyClassifiedError(error);
        return;
      }

      showToast("Password updated.", "success");
      exitPasswordRecovery();
    } catch (err) {
      applyClassifiedError(err);
    } finally {
      setSubmitting(false);
      inFlightRef.current = false;
    }
  };

  const activeMode: AuthMode = forceRecoveryMode ? "recovery" : mode;
  const trimmedUser = username.trim().toLowerCase();
  const effectiveUsernameStatus = !trimmedUser
    ? "idle"
    : !usernameSchema.safeParse(trimmedUser).success
      ? "invalid"
      : usernameAvailability;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: palette.bgCanvas }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandHeader}>
          <AsterialEmblem palette={palette} size={50} />
          <Text style={[styles.brandName, { color: palette.textPrimary }]}>
            {ASTERIAL_BRAND.name}
          </Text>
          <Text style={[styles.brandSub, { color: palette.textSecondary }]}>
            {ASTERIAL_BRAND.tagline}
          </Text>
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.versionPill,
                {
                  backgroundColor: palette.bgSurface,
                  borderColor: palette.borderStrong,
                },
              ]}
            >
              <Text
                style={[styles.versionPillText, { color: palette.textPrimary }]}
              >
                v{ASTERIAL_BRAND.version} · {ASTERIAL_BRAND.attribution}
              </Text>
            </View>

            <Pressable
              onPress={() => void handleRetryConnection()}
              accessibilityRole="button"
              accessibilityLabel="Verify authentication server status"
              style={[
                styles.connPill,
                {
                  backgroundColor: palette.bgSurface,
                  borderColor: palette.borderSubtle,
                },
              ]}
            >
              <View
                style={[
                  styles.connDot,
                  {
                    backgroundColor: !isOnline
                      ? palette.danger
                      : connectivity?.ok
                        ? palette.success
                        : palette.textMuted,
                  },
                ]}
              />
              <Text
                style={[styles.connPillText, { color: palette.textSecondary }]}
              >
                {checkingConn
                  ? "Verifying TLS…"
                  : !isOnline
                    ? "Offline"
                    : connectivity?.ok
                      ? "Auth TLS Ready"
                      : "Tap to Verify"}
              </Text>
            </Pressable>
          </View>
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
          {activeMode !== "recovery" ? (
            <View
              style={[
                styles.segmentedTabs,
                {
                  backgroundColor: palette.bgCanvas,
                  borderColor: palette.borderSubtle,
                },
              ]}
            >
              <Pressable
                onPress={() => switchMode("signin")}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeMode === "signin" }}
                style={[
                  styles.segmentBtn,
                  activeMode === "signin" && {
                    backgroundColor: palette.accentBg,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    {
                      color:
                        activeMode === "signin"
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
                accessibilityState={{ selected: activeMode === "signup" }}
                style={[
                  styles.segmentBtn,
                  activeMode === "signup" && {
                    backgroundColor: palette.accentBg,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    {
                      color:
                        activeMode === "signup"
                          ? palette.accentFg
                          : palette.textSecondary,
                    },
                  ]}
                >
                  Create Account
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ marginBottom: 14 }}>
              <Text
                style={[styles.recoveryTitle, { color: palette.textPrimary }]}
              >
                Set New Password
              </Text>
              <Text
                style={[styles.recoveryDesc, { color: palette.textSecondary }]}
              >
                Choose a strong password (minimum 8 characters) to secure your
                account.
              </Text>
            </View>
          )}

          {sessionNotice ? (
            <View
              style={[
                styles.noticeBox,
                {
                  backgroundColor: palette.accentSoft,
                  borderColor: palette.borderStrong,
                },
              ]}
            >
              <Text style={[styles.noticeText, { color: palette.textPrimary }]}>
                {sessionNotice}
              </Text>
            </View>
          ) : null}

          {infoText ? (
            <View
              style={[
                styles.noticeBox,
                {
                  backgroundColor: palette.accentSoft,
                  borderColor: palette.borderStrong,
                },
              ]}
            >
              <Text style={[styles.noticeText, { color: palette.textPrimary }]}>
                {infoText}
              </Text>
            </View>
          ) : null}

          {errorText ? (
            <View
              style={[
                styles.errorBox,
                {
                  backgroundColor: "rgba(239, 68, 68, 0.12)",
                  borderColor: palette.danger,
                },
              ]}
            >
              <Text style={[styles.errorText, { color: palette.danger }]}>
                {errorText}
              </Text>
              {retryableError ? (
                <Pressable
                  onPress={() => void handleRetryConnection()}
                  style={[
                    styles.inlineRetryBtn,
                    { borderColor: palette.borderStrong },
                  ]}
                >
                  <Text
                    style={{
                      color: palette.textPrimary,
                      fontSize: 12,
                      fontWeight: "700",
                    }}
                  >
                    {checkingConn ? "Reconnecting…" : "Retry Connection"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {activeMode === "signup" ? (
            <>
              <Text style={[styles.label, { color: palette.textSecondary }]}>
                Username (@handle)
              </Text>
              <TextInput
                value={username}
                onChangeText={(v) => {
                  const clean = v.toLowerCase().replace(/[^a-z0-9_]/g, "");
                  setUsername(clean);
                  if (!clean) {
                    setUsernameAvailability("idle");
                  }
                }}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="e.g. ritam_das"
                placeholderTextColor={palette.textMuted}
                maxLength={24}
                style={[
                  styles.input,
                  {
                    backgroundColor: palette.bgCanvas,
                    borderColor: palette.borderSubtle,
                    color: palette.textPrimary,
                  },
                ]}
              />
              {effectiveUsernameStatus !== "idle" ? (
                <Text
                  style={[
                    styles.helperText,
                    {
                      color:
                        effectiveUsernameStatus === "available"
                          ? palette.success
                          : effectiveUsernameStatus === "checking"
                            ? palette.textMuted
                            : palette.danger,
                    },
                  ]}
                >
                  {effectiveUsernameStatus === "checking"
                    ? "Checking handle availability…"
                    : effectiveUsernameStatus === "available"
                      ? `@${trimmedUser} is available`
                      : effectiveUsernameStatus === "taken"
                        ? `@${trimmedUser} is already taken`
                        : "Use 3–24 lowercase letters, numbers, or underscores"}
                </Text>
              ) : null}

              <Text style={[styles.label, { color: palette.textSecondary }]}>
                Display Name
              </Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your full name or alias"
                placeholderTextColor={palette.textMuted}
                maxLength={60}
                style={[
                  styles.input,
                  {
                    backgroundColor: palette.bgCanvas,
                    borderColor: palette.borderSubtle,
                    color: palette.textPrimary,
                  },
                ]}
              />
            </>
          ) : null}

          {activeMode !== "recovery" ? (
            <>
              <Text style={[styles.label, { color: palette.textSecondary }]}>
                Email Address
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="you@domain.com"
                placeholderTextColor={palette.textMuted}
                style={[
                  styles.input,
                  {
                    backgroundColor: palette.bgCanvas,
                    borderColor: palette.borderSubtle,
                    color: palette.textPrimary,
                  },
                ]}
              />
            </>
          ) : null}

          {activeMode !== "forgot" ? (
            <>
              <View style={styles.passwordHeaderRow}>
                <Text style={[styles.label, { color: palette.textSecondary }]}>
                  {activeMode === "recovery" ? "New Password" : "Password"}
                </Text>
                <Pressable onPress={() => setShowPassword((p) => !p)}>
                  <Text
                    style={{
                      color: palette.textSecondary,
                      fontSize: 12,
                      fontWeight: "700",
                    }}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </Text>
                </Pressable>
              </View>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={
                  activeMode === "signin"
                    ? "Enter your password"
                    : "Minimum 8 characters"
                }
                placeholderTextColor={palette.textMuted}
                style={[
                  styles.input,
                  {
                    backgroundColor: palette.bgCanvas,
                    borderColor: palette.borderSubtle,
                    color: palette.textPrimary,
                  },
                ]}
              />
            </>
          ) : null}

          {activeMode === "recovery" ? (
            <>
              <Text style={[styles.label, { color: palette.textSecondary }]}>
                Confirm New Password
              </Text>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Re-enter your new password"
                placeholderTextColor={palette.textMuted}
                style={[
                  styles.input,
                  {
                    backgroundColor: palette.bgCanvas,
                    borderColor: palette.borderSubtle,
                    color: palette.textPrimary,
                  },
                ]}
              />
            </>
          ) : null}

          {activeMode === "signin" ? (
            <Pressable
              onPress={() => switchMode("forgot")}
              style={styles.forgotLink}
            >
              <Text style={{ color: palette.textSecondary, fontSize: 12.5 }}>
                Forgot password?
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            disabled={submitting}
            onPress={() => {
              if (activeMode === "signin") void handleSignIn();
              else if (activeMode === "signup") void handleSignUp();
              else if (activeMode === "forgot") void handleForgotPassword();
              else void handleUpdateRecoveredPassword();
            }}
            accessibilityRole="button"
            style={[
              styles.submitBtn,
              {
                backgroundColor: palette.accentBg,
                opacity: submitting ? 0.72 : 1,
              },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color={palette.accentFg} size="small" />
            ) : (
              <Text
                style={[styles.submitBtnText, { color: palette.accentFg }]}
              >
                {activeMode === "signin"
                  ? "Sign In"
                  : activeMode === "signup"
                    ? "Create Account"
                    : activeMode === "forgot"
                      ? "Send Recovery Link"
                      : "Save New Password"}
              </Text>
            )}
          </Pressable>

          {activeMode === "forgot" ? (
            <Pressable
              onPress={() => switchMode("signin")}
              style={styles.backToSignIn}
            >
              <Text
                style={{
                  color: palette.textSecondary,
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                ← Back to Sign In
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.footerBlock}>
          <Text style={[styles.footerNote, { color: palette.textMuted }]}>
            Protected in transit via HTTPS/TLS and governed by PostgreSQL Row
            Level Security.
          </Text>
          <Text style={[styles.footerCredit, { color: palette.textSecondary }]}>
            Developer: {ASTERIAL_BRAND.developer} · {ASTERIAL_BRAND.attribution}
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
  brandHeader: {
    alignItems: "center",
    marginBottom: 22,
  },
  brandName: {
    marginTop: 12,
    fontSize: 25,
    fontWeight: "800",
    letterSpacing: 2.2,
  },
  brandSub: {
    marginTop: 6,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 320,
  },
  badgeRow: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  versionPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  versionPillText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  connPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  connDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  connPillText: {
    fontSize: 11,
    fontWeight: "600",
  },
  card: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
  },
  segmentedTabs: {
    flexDirection: "row",
    borderRadius: 13,
    borderWidth: 1,
    padding: 3,
    marginBottom: 14,
  },
  segmentBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: "center",
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "700",
  },
  recoveryTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  recoveryDesc: {
    marginTop: 4,
    fontSize: 12.5,
    lineHeight: 18,
  },
  noticeBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 11,
    marginBottom: 12,
  },
  noticeText: {
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "600",
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  errorText: {
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "600",
  },
  inlineRetryBtn: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  label: {
    marginTop: 10,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: "700",
  },
  passwordHeaderRow: {
    marginTop: 10,
    marginBottom: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  input: {
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14.5,
  },
  helperText: {
    marginTop: 5,
    fontSize: 11.5,
    fontWeight: "600",
  },
  forgotLink: {
    marginTop: 10,
    alignSelf: "flex-end",
  },
  submitBtn: {
    marginTop: 18,
    borderRadius: 13,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnText: {
    fontSize: 14.5,
    fontWeight: "800",
  },
  backToSignIn: {
    marginTop: 14,
    alignItems: "center",
  },
  footerBlock: {
    marginTop: 22,
    alignItems: "center",
    gap: 5,
  },
  footerNote: {
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
    maxWidth: 320,
  },
  footerCredit: {
    fontSize: 11.5,
    fontWeight: "700",
  },
});
