import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AsterialEmblem } from "./components/AsterialEmblem";
import { NativeAvatar } from "./components/NativeAvatar";
import { NativeErrorBoundary } from "./components/NativeErrorBoundary";
import {
  MobileWorkspaceProvider,
  useMobileWorkspace,
} from "./context/MobileWorkspaceContext";
import type { MainTabKey } from "./navigation/types";
import { AuthScreen } from "./screens/AuthScreen";
import { ContactsScreen } from "./screens/ContactsScreen";
import { ConversationScreen } from "./screens/ConversationScreen";
import { FeedScreen } from "./screens/FeedScreen";
import { InboxScreen } from "./screens/InboxScreen";
import { MomentsScreen } from "./screens/MomentsScreen";
import { OnboardingScreen } from "./screens/OnboardingScreen";
import { OrbitRoomScreen } from "./screens/OrbitRoomScreen";
import { OrbitsScreen } from "./screens/OrbitsScreen";
import { PasswordRecoveryScreen } from "./screens/PasswordRecoveryScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { SettingsScreen } from "./screens/SettingsScreen";

const BOTTOM_TABS: { key: MainTabKey; label: string; glyph: string }[] = [
  { key: "chats", label: "Chats", glyph: "💬" },
  { key: "orbits", label: "Orbits", glyph: "◎" },
  { key: "moments", label: "Moments", glyph: "◷" },
  { key: "feed", label: "Feed", glyph: "▤" },
  { key: "contacts", label: "People", glyph: "⌕" },
];

function NativeAppRouter() {
  const {
    supabase,
    profile,
    bootStatus,
    palette,
    theme,
    conversations,
    isOnline,
    toast,
    dismissToast,
    retryBootstrap,
  } = useMobileWorkspace();

  const [activeTab, setActiveTab] = useState<MainTabKey>("chats");
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [activeOrbitId, setActiveOrbitId] = useState<string | null>(null);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (activeConversationId) {
          setActiveConversationId(null);
          return true;
        }
        if (activeOrbitId) {
          setActiveOrbitId(null);
          return true;
        }
        if (activeTab !== "chats") {
          setActiveTab("chats");
          return true;
        }
        return false;
      }
    );
    return () => subscription.remove();
  }, [activeConversationId, activeOrbitId, activeTab]);

  const unreadCounters = useMemo(() => {
    let totalUnread = 0;
    let groupUnread = 0;
    for (const c of conversations) {
      if (!c.membership.archived && c.membership.unread_count > 0) {
        totalUnread += c.membership.unread_count;
        if (c.conversation.type === "group") {
          groupUnread += c.membership.unread_count;
        }
      }
    }
    return { totalUnread, groupUnread };
  }, [conversations]);

  const statusBarStyle =
    theme === "alabaster" ? "dark-content" : "light-content";

  return (
    <SafeAreaView
      edges={["top", "left", "right", "bottom"]}
      style={[styles.safeRoot, { backgroundColor: palette.bgCanvas }]}
    >
      <StatusBar
        barStyle={statusBarStyle}
        backgroundColor={palette.bgCanvas}
        translucent={false}
      />

      {!isOnline ? (
        <View
          style={[
            styles.offlineBanner,
            {
              backgroundColor: palette.bgElevated,
              borderBottomColor: palette.borderSubtle,
            },
          ]}
        >
          <Text style={[styles.offlineText, { color: palette.textPrimary }]}>
            Offline — reconnecting automatically when your network returns.
          </Text>
        </View>
      ) : null}

      {toast ? (
        <Pressable
          onPress={dismissToast}
          style={[
            styles.toastBar,
            {
              backgroundColor:
                toast.kind === "error"
                  ? "rgba(248,113,113,0.18)"
                  : toast.kind === "success"
                    ? "rgba(52,211,153,0.18)"
                    : palette.bgElevated,
              borderColor:
                toast.kind === "error"
                  ? palette.danger
                  : toast.kind === "success"
                    ? palette.success
                    : palette.borderStrong,
            },
          ]}
        >
          <Text style={[styles.toastText, { color: palette.textPrimary }]}>
            {toast.text}
          </Text>
        </Pressable>
      ) : null}

      {bootStatus === "booting" ? (
        <View style={styles.center}>
          <AsterialEmblem size={46} palette={palette} />
          <ActivityIndicator
            color={palette.accent}
            style={{ marginTop: 18 }}
          />
          <Text style={[styles.bootLabel, { color: palette.textSecondary }]}>
            Restoring secure Asterial session…
          </Text>
        </View>
      ) : bootStatus === "unconfigured" ? (
        <View style={styles.center}>
          <AsterialEmblem size={44} palette={palette} />
          <Text style={[styles.errorHeading, { color: palette.textPrimary }]}>
            Unable to Reach Asterial Cloud
          </Text>
          <Text style={[styles.errorBody, { color: palette.textSecondary }]}>
            Check your internet connection and tap below to initialize secure
            authentication.
          </Text>
          <Pressable
            onPress={() => void retryBootstrap()}
            style={[styles.retryBtn, { backgroundColor: palette.accentBg }]}
          >
            <Text style={[styles.retryBtnText, { color: palette.accentFg }]}>
              Retry Connection
            </Text>
          </Pressable>
        </View>
      ) : bootStatus === "signed_out" ? (
        <AuthScreen />
      ) : bootStatus === "password_recovery" ? (
        <PasswordRecoveryScreen />
      ) : bootStatus === "onboarding" ? (
        <OnboardingScreen />
      ) : activeConversationId ? (
        <ConversationScreen
          conversationId={activeConversationId}
          onBack={() => setActiveConversationId(null)}
        />
      ) : activeOrbitId ? (
        <OrbitRoomScreen
          orbitId={activeOrbitId}
          onBack={() => setActiveOrbitId(null)}
        />
      ) : (
        <View style={{ flex: 1 }}>
          {/* Global Top Monochrome Chrome: Brand + Quick Groups, Profile & Settings */}
          <View
            style={[
              styles.topBar,
              {
                backgroundColor: palette.bgSurface,
                borderBottomColor: palette.borderSubtle,
              },
            ]}
          >
            <Pressable
              onPress={() => setActiveTab("chats")}
              style={styles.brandPress}
            >
              <AsterialEmblem size={22} palette={palette} />
              <Text
                style={[styles.brandName, { color: palette.textPrimary }]}
              >
                ASTERIAL
              </Text>
              <View
                style={[
                  styles.verBadge,
                  {
                    backgroundColor: palette.bgElevated,
                    borderColor: palette.borderSubtle,
                  },
                ]}
              >
                <Text style={{ color: palette.textMuted, fontSize: 9.5, fontWeight: "700" }}>
                  1.4
                </Text>
              </View>
            </Pressable>

            <View style={styles.topActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Groups"
                onPress={() => setActiveTab("groups")}
                style={[
                  styles.topPill,
                  {
                    backgroundColor:
                      activeTab === "groups"
                        ? palette.accentBg
                        : palette.bgCanvas,
                    borderColor: palette.borderSubtle,
                  },
                ]}
              >
                <Text
                  style={{
                    color:
                      activeTab === "groups"
                        ? palette.accentFg
                        : palette.textSecondary,
                    fontSize: 11.5,
                    fontWeight: "700",
                  }}
                >
                  Groups
                  {unreadCounters.groupUnread > 0
                    ? ` (${unreadCounters.groupUnread})`
                    : ""}
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Profile"
                onPress={() => setActiveTab("profile")}
                style={[
                  styles.avatarPill,
                  activeTab === "profile" && {
                    borderColor: palette.accent,
                    borderWidth: 2,
                  },
                ]}
              >
                <NativeAvatar
                  supabase={supabase}
                  palette={palette}
                  label={profile?.display_name || "You"}
                  storagePath={profile?.avatar_url || null}
                  size={28}
                />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Settings"
                onPress={() => setActiveTab("settings")}
                style={[
                  styles.iconPill,
                  {
                    backgroundColor:
                      activeTab === "settings"
                        ? palette.accentBg
                        : palette.bgCanvas,
                    borderColor: palette.borderSubtle,
                  },
                ]}
              >
                <Text
                  style={{
                    color:
                      activeTab === "settings"
                        ? palette.accentFg
                        : palette.textSecondary,
                    fontSize: 13.5,
                    fontWeight: "800",
                  }}
                >
                  ⚙
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={{ flex: 1 }}>
            {activeTab === "chats" ? (
              <InboxScreen
                key="inbox-all"
                mode="all"
                onOpenConversation={(id) => setActiveConversationId(id)}
              />
            ) : activeTab === "groups" ? (
              <InboxScreen
                key="inbox-groups"
                mode="groups"
                onOpenConversation={(id) => setActiveConversationId(id)}
              />
            ) : activeTab === "orbits" ? (
              <OrbitsScreen
                onOpenOrbit={(orbitId) => setActiveOrbitId(orbitId)}
              />
            ) : activeTab === "moments" ? (
              <MomentsScreen />
            ) : activeTab === "feed" ? (
              <FeedScreen
                onOpenConversation={(id) => setActiveConversationId(id)}
              />
            ) : activeTab === "contacts" ? (
              <ContactsScreen
                onOpenConversation={(id) => setActiveConversationId(id)}
              />
            ) : activeTab === "profile" ? (
              <ProfileScreen />
            ) : (
              <SettingsScreen />
            )}
          </View>

          {/* Bottom 5-Tab Bar */}
          <View
            style={[
              styles.tabBar,
              {
                backgroundColor: palette.bgSurface,
                borderTopColor: palette.borderSubtle,
              },
            ]}
          >
            {BOTTOM_TABS.map((tab) => {
              const selected =
                activeTab === tab.key ||
                (tab.key === "chats" && activeTab === "groups");
              const badgeCount =
                tab.key === "chats" ? unreadCounters.totalUnread : 0;

              return (
                <Pressable
                  key={tab.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  onPress={() => setActiveTab(tab.key)}
                  style={[
                    styles.tabItem,
                    selected && { backgroundColor: palette.accentSoft },
                  ]}
                >
                  <View style={styles.tabIconWrap}>
                    <Text
                      style={[
                        styles.tabGlyph,
                        {
                          color: selected ? palette.accent : palette.textMuted,
                        },
                      ]}
                    >
                      {tab.glyph}
                    </Text>
                    {badgeCount > 0 ? (
                      <View
                        style={[
                          styles.tabBadge,
                          { backgroundColor: palette.accentBg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.tabBadgeText,
                            { color: palette.accentFg },
                          ]}
                        >
                          {badgeCount > 99 ? "99+" : badgeCount}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.tabLabel,
                      {
                        color: selected ? palette.accent : palette.textMuted,
                        fontWeight: selected ? "800" : "600",
                      },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NativeErrorBoundary>
        <MobileWorkspaceProvider>
          <NativeAppRouter />
        </MobileWorkspaceProvider>
      </NativeErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeRoot: {
    flex: 1,
  },
  offlineBanner: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderBottomWidth: 1,
  },
  offlineText: {
    fontSize: 11.5,
    fontWeight: "700",
    textAlign: "center",
  },
  toastBar: {
    position: "absolute",
    top: 14,
    left: 16,
    right: 16,
    zIndex: 50,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  toastText: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  bootLabel: {
    marginTop: 12,
    fontSize: 13,
  },
  errorHeading: {
    marginTop: 16,
    fontSize: 19,
    fontWeight: "800",
    textAlign: "center",
  },
  errorBody: {
    marginTop: 8,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 18,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  retryBtnText: {
    fontWeight: "800",
    fontSize: 13.5,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderBottomWidth: 1,
  },
  brandPress: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  brandName: {
    fontSize: 13.5,
    fontWeight: "800",
    letterSpacing: 2.2,
  },
  verBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
  },
  topActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  topPill: {
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 5.5,
  },
  avatarPill: {
    borderRadius: 999,
    padding: 1,
  },
  iconPill: {
    width: 31,
    height: 31,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 6,
    gap: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    borderRadius: 12,
    gap: 2,
  },
  tabIconWrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  tabGlyph: {
    fontSize: 15,
  },
  tabBadge: {
    position: "absolute",
    top: -5,
    right: -14,
    borderRadius: 999,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBadgeText: {
    fontSize: 9.5,
    fontWeight: "800",
  },
  tabLabel: {
    fontSize: 10.5,
  },
});
