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
import { ASTERIAL_BRAND } from "@asterial/core";
import {
  AsterialEmblem,
  StatusBanners,
} from "./components/AsterialEmblem";
import {
  MobileWorkspaceProvider,
  useMobileWorkspace,
} from "./context/MobileWorkspaceContext";
import { AuthScreen } from "./screens/AuthScreen";
import { ContactsScreen } from "./screens/ContactsScreen";
import { ConversationScreen } from "./screens/ConversationScreen";
import { InboxScreen } from "./screens/InboxScreen";
import { OnboardingScreen } from "./screens/OnboardingScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { SettingsScreen } from "./screens/SettingsScreen";

type MainTabKey = "chats" | "groups" | "contacts" | "profile" | "settings";

const NAV_TABS: { key: MainTabKey; label: string; glyph: string }[] = [
  { key: "chats", label: "Chats", glyph: "✦" },
  { key: "groups", label: "Groups", glyph: "◎" },
  { key: "contacts", label: "Contacts", glyph: "⊕" },
  { key: "profile", label: "Profile", glyph: "◈" },
  { key: "settings", label: "Settings", glyph: "⚙" },
];

function NativeAppRouter() {
  const {
    bootStatus,
    palette,
    conversations,
    isOnline,
    toast,
    dismissToast,
    retryBootstrap,
  } = useMobileWorkspace();

  const [activeTab, setActiveTab] = useState<MainTabKey>("chats");
  const [openConversationId, setOpenConversationId] = useState<string | null>(
    null
  );

  // Android hardware Back button navigation stack
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (openConversationId) {
        setOpenConversationId(null);
        return true;
      }
      if (bootStatus === "ready" && activeTab !== "chats") {
        setActiveTab("chats");
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [activeTab, bootStatus, openConversationId]);

  const unreadStats = useMemo(() => {
    let totalUnread = 0;
    let groupUnread = 0;
    for (const c of conversations) {
      if (c.membership.archived) continue;
      if (c.membership.unread_count > 0) {
        totalUnread += c.membership.unread_count;
        if (c.conversation.type === "group") {
          groupUnread += c.membership.unread_count;
        }
      }
    }
    return { totalUnread, groupUnread };
  }, [conversations]);

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={[styles.safeRoot, { backgroundColor: palette.bgVoid }]}
    >
      <StatusBar
        barStyle={palette.isDark ? "light-content" : "dark-content"}
        backgroundColor={palette.bgVoid}
      />

      <StatusBanners
        palette={palette}
        isOnline={isOnline}
        toast={toast}
        onDismissToast={dismissToast}
      />

      {bootStatus === "booting" ? (
        <View style={styles.centeredScreen}>
          <AsterialEmblem palette={palette} size={58} />
          <Text style={[styles.bootBrand, { color: palette.textPrimary }]}>
            {ASTERIAL_BRAND.name} v{ASTERIAL_BRAND.version}
          </Text>
          <ActivityIndicator
            color={palette.accent}
            size="small"
            style={{ marginTop: 14 }}
          />
        </View>
      ) : bootStatus === "unconfigured" ? (
        <View style={styles.centeredScreen}>
          <AsterialEmblem palette={palette} size={54} />
          <Text style={[styles.bootBrand, { color: palette.textPrimary }]}>
            Connection Required
          </Text>
          <Text style={[styles.unconfigSub, { color: palette.textSecondary }]}>
            Connect to the internet on first launch so {ASTERIAL_BRAND.name} v
            {ASTERIAL_BRAND.version} can initialize your workspace connection.
          </Text>
          <Pressable
            onPress={() => void retryBootstrap()}
            style={[styles.retryBtn, { backgroundColor: palette.accent }]}
          >
            <Text style={[styles.retryBtnText, { color: palette.accentFg }]}>
              Retry Connection
            </Text>
          </Pressable>
        </View>
      ) : bootStatus === "signed_out" ? (
        <AuthScreen />
      ) : bootStatus === "password_recovery" ? (
        <AuthScreen forceRecoveryMode />
      ) : bootStatus === "onboarding" ? (
        <OnboardingScreen />
      ) : openConversationId ? (
        <ConversationScreen
          conversationId={openConversationId}
          onBack={() => setOpenConversationId(null)}
        />
      ) : (
        <View style={styles.mainShell}>
          <View style={styles.screenViewport}>
            {activeTab === "chats" ? (
              <InboxScreen
                mode="all"
                onOpenConversation={(id) => setOpenConversationId(id)}
              />
            ) : activeTab === "groups" ? (
              <InboxScreen
                mode="groups"
                onOpenConversation={(id) => setOpenConversationId(id)}
              />
            ) : activeTab === "contacts" ? (
              <ContactsScreen
                onOpenConversation={(id) => setOpenConversationId(id)}
              />
            ) : activeTab === "profile" ? (
              <ProfileScreen />
            ) : (
              <SettingsScreen />
            )}
          </View>

          <View
            style={[
              styles.bottomNavBar,
              {
                backgroundColor: palette.bgSurface,
                borderTopColor: palette.borderSubtle,
              },
            ]}
          >
            {NAV_TABS.map((tab) => {
              const selected = activeTab === tab.key;
              const badgeCount =
                tab.key === "chats"
                  ? unreadStats.totalUnread
                  : tab.key === "groups"
                  ? unreadStats.groupUnread
                  : 0;

              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  accessibilityLabel={tab.label}
                  style={styles.navTabBtn}
                >
                  <View style={styles.glyphWrap}>
                    <Text
                      style={[
                        styles.navGlyph,
                        {
                          color: selected
                            ? palette.accent
                            : palette.textMuted,
                        },
                      ]}
                    >
                      {tab.glyph}
                    </Text>
                    {badgeCount > 0 ? (
                      <View
                        style={[
                          styles.navBadge,
                          { backgroundColor: palette.accent },
                        ]}
                      >
                        <Text
                          style={[
                            styles.navBadgeText,
                            { color: palette.accentFg },
                          ]}
                        >
                          {badgeCount > 99 ? "99+" : badgeCount}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.navLabel,
                      {
                        color: selected
                          ? palette.textPrimary
                          : palette.textMuted,
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
      <MobileWorkspaceProvider>
        <NativeAppRouter />
      </MobileWorkspaceProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeRoot: {
    flex: 1,
  },
  centeredScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  bootBrand: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  unconfigSub: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 18,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  retryBtnText: {
    fontWeight: "800",
    fontSize: 13.5,
  },
  mainShell: {
    flex: 1,
  },
  screenViewport: {
    flex: 1,
  },
  bottomNavBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingTop: 7,
    paddingBottom: 8,
  },
  navTabBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  glyphWrap: {
    position: "relative",
    paddingHorizontal: 8,
  },
  navGlyph: {
    fontSize: 17,
    fontWeight: "800",
  },
  navBadge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  navBadgeText: {
    fontSize: 9.5,
    fontWeight: "800",
  },
  navLabel: {
    fontSize: 11,
  },
});
