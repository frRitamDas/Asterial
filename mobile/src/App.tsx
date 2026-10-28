import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import type { Session } from '@supabase/supabase-js';
import {
  ASTERIAL_BRAND,
  THEME_PALETTES,
  getInitials,
  loginSchema,
  type AppearanceTheme,
  type Profile,
} from '@asterial/core';
import { getMobileRuntimeConfig } from './config/env';
import { getMobileSupabaseClient } from './lib/supabase';
import { RADII, SPACING } from './theme/tokens';

const THEME_ORDER: readonly AppearanceTheme[] = [
  'obsidian',
  'pitch',
  'graphite',
  'alabaster',
];

function NativeFoundationScreen(): React.JSX.Element {
  const runtimeConfig = getMobileRuntimeConfig();
  const supabase = getMobileSupabaseClient();

  const [themeId, setThemeId] = useState<AppearanceTheme>('obsidian');
  const palette = THEME_PALETTES[themeId];

  const [bootstrapping, setBootstrapping] = useState<boolean>(
    Boolean(supabase),
  );
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [conversationCount, setConversationCount] = useState<number | null>(
    null,
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadAuthenticatedWorkspaceSnapshot = useCallback(
    async (userId: string) => {
      if (!supabase) return;
      const [profileRes, memberCountRes, prefsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase
          .from('conversation_members')
          .select('conversation_id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .is('left_at', null),
        supabase
          .from('notification_preferences')
          .select('appearance_theme')
          .eq('user_id', userId)
          .maybeSingle(),
      ]);

      if (profileRes.data) {
        setProfile(profileRes.data as Profile);
      }
      if (typeof memberCountRes.count === 'number') {
        setConversationCount(memberCountRes.count);
      }
      const savedTheme = prefsRes.data?.appearance_theme as
        | AppearanceTheme
        | undefined;
      if (savedTheme && savedTheme in THEME_PALETTES) {
        setThemeId(savedTheme);
      }
    },
    [supabase],
  );

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        const currentSession = data.session ?? null;
        setSession(currentSession);
        if (currentSession?.user?.id) {
          return loadAuthenticatedWorkspaceSnapshot(currentSession.user.id);
        }
        return undefined;
      })
      .finally(() => {
        if (active) setBootstrapping(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!active) return;
        setSession(nextSession);
        if (nextSession?.user?.id) {
          loadAuthenticatedWorkspaceSnapshot(nextSession.user.id).catch(
            () => undefined,
          );
        } else {
          setProfile(null);
          setConversationCount(null);
        }
      },
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [loadAuthenticatedWorkspaceSnapshot, supabase]);

  const handleSignIn = async () => {
    setErrorMessage(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrorMessage(
        parsed.error.issues[0]?.message || 'Check your email and password.',
      );
      return;
    }
    if (!supabase) {
      setErrorMessage(
        'Supabase environment is not configured in this build.',
      );
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (error) {
        setErrorMessage(error.message);
      } else {
        setPassword('');
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to reach Supabase Auth.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    setSubmitting(true);
    try {
      await supabase.auth.signOut();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.bgVoid }]}
      edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar
        barStyle={palette.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={palette.bgVoid}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { backgroundColor: palette.bgCanvas },
          ]}
          keyboardShouldPersistTaps="handled">
          {/* Brand Header */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: palette.bgSurface,
                borderColor: palette.borderSubtle,
              },
            ]}>
            <View style={styles.brandRow}>
              <View
                style={[
                  styles.emblemBox,
                  {
                    backgroundColor: palette.bgElevated,
                    borderColor: palette.borderStrong,
                  },
                ]}>
                <Text style={[styles.emblemGlyph, { color: palette.textPrimary }]}>
                  ✦
                </Text>
              </View>
              <View style={styles.flex}>
                <Text style={[styles.brandTitle, { color: palette.textPrimary }]}>
                  {ASTERIAL_BRAND.name}
                </Text>
                <Text style={[styles.brandMeta, { color: palette.textSecondary }]}>
                  Native Android · v{ASTERIAL_BRAND.semver} (Code{' '}
                  {ASTERIAL_BRAND.versionCode})
                </Text>
              </View>
            </View>
            <Text style={[styles.tagline, { color: palette.textSecondary }]}>
              {ASTERIAL_BRAND.tagline}
            </Text>
            <View
              style={[
                styles.metaPillRow,
                { borderTopColor: palette.borderSubtle },
              ]}>
              <Text style={[styles.monoCaption, { color: palette.textMuted }]}>
                Developer: {ASTERIAL_BRAND.developer} ·{' '}
                {ASTERIAL_BRAND.attribution}
              </Text>
              <Text style={[styles.monoCaption, { color: palette.textMuted }]}>
                Package: {ASTERIAL_BRAND.androidPackageId} · React Native 0.83
                (Hermes)
              </Text>
            </View>
          </View>

          {/* Theme Token Switcher (Shared with Web via @asterial/core) */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: palette.bgSurface,
                borderColor: palette.borderSubtle,
              },
            ]}>
            <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
              Appearance Palette
            </Text>
            <View style={styles.themeRow}>
              {THEME_ORDER.map(candidate => {
                const active = candidate === themeId;
                return (
                  <Pressable
                    key={candidate}
                    accessibilityRole="button"
                    onPress={() => setThemeId(candidate)}
                    style={[
                      styles.themeChip,
                      {
                        backgroundColor: active
                          ? palette.accentBg
                          : palette.bgElevated,
                        borderColor: active
                          ? palette.accentBg
                          : palette.borderSubtle,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.themeChipText,
                        {
                          color: active
                            ? palette.accentFg
                            : palette.textSecondary,
                        },
                      ]}>
                      {THEME_PALETTES[candidate].label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Shared Supabase Backend & Session Foundation */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: palette.bgSurface,
                borderColor: palette.borderSubtle,
              },
            ]}>
            <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
              Shared Supabase Account &amp; Session
            </Text>

            {!runtimeConfig.isSupabaseConfigured ? (
              <Text style={[styles.bodyText, { color: palette.textSecondary }]}>
                Supabase environment variables were not supplied at build time.
                Configure NEXT_PUBLIC_SUPABASE_URL and
                NEXT_PUBLIC_SUPABASE_ANON_KEY before building to connect to the
                shared ASTERIAL backend.
              </Text>
            ) : bootstrapping ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={palette.textPrimary} />
                <Text
                  style={[styles.bodyText, { color: palette.textSecondary }]}>
                  Restoring native AsyncStorage session…
                </Text>
              </View>
            ) : session ? (
              <View style={styles.sessionStack}>
                <View style={styles.profileRow}>
                  <View
                    style={[
                      styles.avatarCircle,
                      {
                        backgroundColor: palette.bgElevated,
                        borderColor: palette.borderStrong,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.avatarInitials,
                        { color: palette.textPrimary },
                      ]}>
                      {getInitials(
                        profile?.display_name || session.user.email || 'AS',
                      )}
                    </Text>
                  </View>
                  <View style={styles.flex}>
                    <Text
                      style={[
                        styles.profileName,
                        { color: palette.textPrimary },
                      ]}>
                      {profile?.display_name || 'Authenticated Account'}
                    </Text>
                    <Text
                      style={[
                        styles.bodyText,
                        { color: palette.textSecondary },
                      ]}>
                      {profile?.username
                        ? `@${profile.username}`
                        : session.user.email}
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.statBox,
                    {
                      backgroundColor: palette.bgElevated,
                      borderColor: palette.borderSubtle,
                    },
                  ]}>
                  <Text
                    style={[styles.monoCaption, { color: palette.textMuted }]}>
                    Active RLS-verified conversations on shared backend
                  </Text>
                  <Text
                    style={[styles.statValue, { color: palette.textPrimary }]}>
                    {conversationCount === null
                      ? 'Synchronizing…'
                      : String(conversationCount)}
                  </Text>
                </View>

                <Pressable
                  accessibilityRole="button"
                  disabled={submitting}
                  onPress={handleSignOut}
                  style={[
                    styles.secondaryButton,
                    { borderColor: palette.borderStrong },
                  ]}>
                  <Text
                    style={[
                      styles.secondaryButtonText,
                      { color: palette.textPrimary },
                    ]}>
                    {submitting ? 'Signing out…' : 'Sign out'}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.formStack}>
                <Text
                  style={[styles.bodyText, { color: palette.textSecondary }]}>
                  Sign in with your existing ASTERIAL account to verify live
                  session persistence and RLS data access on Android.
                </Text>

                {errorMessage ? (
                  <View
                    style={[
                      styles.errorBanner,
                      { borderColor: palette.danger },
                    ]}>
                    <Text style={[styles.errorText, { color: palette.danger }]}>
                      {errorMessage}
                    </Text>
                  </View>
                ) : null}

                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholder="Email address"
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
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="Password"
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

                <Pressable
                  accessibilityRole="button"
                  disabled={submitting}
                  onPress={handleSignIn}
                  style={[
                    styles.primaryButton,
                    { backgroundColor: palette.accentBg },
                  ]}>
                  <Text
                    style={[
                      styles.primaryButtonText,
                      { color: palette.accentFg },
                    ]}>
                    {submitting ? 'Authenticating…' : 'Sign in to ASTERIAL'}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Honest Phase 1 Engineering Status */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: palette.bgSurface,
                borderColor: palette.borderSubtle,
              },
            ]}>
            <Text style={[styles.monoCaption, { color: palette.textMuted }]}>
              PHASE 1 FOUNDATION STATUS
            </Text>
            <Text style={[styles.bodyText, { color: palette.textSecondary }]}>
              This APK renders 100% native Android views via React Native Fabric
              and Hermes (no WebView or website wrapper) and shares{' '}
              @asterial/core contracts and Supabase PostgreSQL RLS with the
              Next.js website. Native messaging threads, media pickers, and
              social feed surfaces will be added in Phase 2+.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <NativeFoundationScreen />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  card: {
    borderRadius: RADII.xl,
    borderWidth: 1,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  emblemBox: {
    width: 46,
    height: 46,
    borderRadius: RADII.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblemGlyph: {
    fontSize: 22,
    fontWeight: '700',
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2.4,
  },
  brandMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  tagline: {
    fontSize: 13,
    lineHeight: 19,
  },
  metaPillRow: {
    borderTopWidth: 1,
    paddingTop: SPACING.sm,
    gap: 4,
  },
  monoCaption: {
    fontSize: 11,
    fontFamily: Platform.select({ android: 'monospace', ios: 'Menlo' }),
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  themeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  themeChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADII.md,
    borderWidth: 1,
  },
  themeChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  bodyText: {
    fontSize: 13,
    lineHeight: 19,
  },
  sessionStack: {
    gap: SPACING.md,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: RADII.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 14,
    fontWeight: '700',
  },
  profileName: {
    fontSize: 15,
    fontWeight: '600',
  },
  statBox: {
    borderRadius: RADII.md,
    borderWidth: 1,
    padding: SPACING.md,
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  formStack: {
    gap: SPACING.sm,
  },
  errorBanner: {
    borderWidth: 1,
    borderRadius: RADII.md,
    padding: SPACING.sm,
  },
  errorText: {
    fontSize: 12,
  },
  input: {
    height: 46,
    borderRadius: RADII.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    fontSize: 14,
  },
  primaryButton: {
    height: 46,
    borderRadius: RADII.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    height: 42,
    borderRadius: RADII.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
