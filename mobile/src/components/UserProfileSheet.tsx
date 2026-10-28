import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatLastSeen, type ThemePalette } from "@asterial/core";
import { NativeAvatar } from "./NativeAvatar";

export interface InspectableUserProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string;
  status_text: string;
  last_seen_at?: string | null;
}

export function UserProfileSheet({
  visible,
  userProfile,
  currentUserId,
  supabase,
  palette,
  isOnline,
  isBlocked,
  onClose,
  onMessageUser,
  onToggleBlock,
  onOpenReport,
}: {
  visible: boolean;
  userProfile: InspectableUserProfile | null;
  currentUserId: string | null;
  supabase: SupabaseClient | null;
  palette: ThemePalette;
  isOnline: boolean;
  isBlocked: boolean;
  onClose: () => void;
  onMessageUser: (userId: string) => Promise<void>;
  onToggleBlock: (userId: string) => Promise<void>;
  onOpenReport: (userId: string, label: string) => void;
}) {
  const [busyAction, setBusyAction] = useState<"msg" | "block" | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  if (!userProfile) return null;

  const isSelf = currentUserId === userProfile.id;

  const handleMessage = async () => {
    setBusyAction("msg");
    setErrMsg(null);
    try {
      await onMessageUser(userProfile.id);
      onClose();
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "Could not open chat.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleBlock = async () => {
    setBusyAction("block");
    setErrMsg(null);
    try {
      await onToggleBlock(userProfile.id);
    } catch (err) {
      setErrMsg(
        err instanceof Error ? err.message : "Could not update block status."
      );
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: palette.bgSurface,
              borderColor: palette.borderSubtle,
            },
          ]}
        >
          <View style={styles.headerRow}>
            <NativeAvatar
              supabase={supabase}
              storagePath={userProfile.avatar_url}
              label={userProfile.display_name || userProfile.username}
              palette={palette}
              size={64}
              isOnline={isOnline}
            />
            <View style={styles.headerMeta}>
              <Text style={[styles.displayName, { color: palette.textPrimary }]}>
                {userProfile.display_name || userProfile.username}
              </Text>
              <Text style={[styles.handle, { color: palette.accent }]}>
                @{userProfile.username}
              </Text>
              <Text style={[styles.presence, { color: palette.textMuted }]}>
                {isOnline
                  ? "Online now"
                  : formatLastSeen(userProfile.last_seen_at)}
              </Text>
            </View>
          </View>

          {userProfile.status_text ? (
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: palette.bgElevated,
                  borderColor: palette.borderSubtle,
                },
              ]}
            >
              <Text style={[styles.statusText, { color: palette.textPrimary }]}>
                {userProfile.status_text}
              </Text>
            </View>
          ) : null}

          {userProfile.bio ? (
            <Text style={[styles.bioText, { color: palette.textSecondary }]}>
              {userProfile.bio}
            </Text>
          ) : (
            <Text style={[styles.bioText, { color: palette.textMuted }]}>
              No bio added yet.
            </Text>
          )}

          {errMsg ? (
            <Text style={[styles.errText, { color: palette.danger }]}>
              {errMsg}
            </Text>
          ) : null}

          {!isSelf ? (
            <View style={styles.actionsCol}>
              {!isBlocked ? (
                <Pressable
                  onPress={() => void handleMessage()}
                  disabled={busyAction !== null}
                  style={[
                    styles.primaryBtn,
                    { backgroundColor: palette.accent },
                  ]}
                >
                  {busyAction === "msg" ? (
                    <ActivityIndicator color={palette.accentFg} size="small" />
                  ) : (
                    <Text style={[styles.primaryBtnText, { color: palette.accentFg }]}>
                      Send Direct Message
                    </Text>
                  )}
                </Pressable>
              ) : null}

              <View style={styles.secondaryRow}>
                <Pressable
                  onPress={() => void handleBlock()}
                  disabled={busyAction !== null}
                  style={[
                    styles.secondaryBtn,
                    {
                      backgroundColor: palette.bgElevated,
                      borderColor: palette.borderSubtle,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: isBlocked ? palette.accent : palette.danger,
                      fontWeight: "700",
                      fontSize: 13,
                    }}
                  >
                    {busyAction === "block"
                      ? "Updating…"
                      : isBlocked
                      ? "Unblock User"
                      : "Block User"}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    onClose();
                    onOpenReport(
                      userProfile.id,
                      `@${userProfile.username}`
                    );
                  }}
                  style={[
                    styles.secondaryBtn,
                    {
                      backgroundColor: palette.bgElevated,
                      borderColor: palette.borderSubtle,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: palette.textSecondary,
                      fontWeight: "600",
                      fontSize: 13,
                    }}
                  >
                    Report
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <Pressable
            onPress={onClose}
            style={[styles.closeBtn, { borderColor: palette.borderSubtle }]}
          >
            <Text style={{ color: palette.textSecondary, fontWeight: "600" }}>
              Close
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.68)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    padding: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  headerMeta: {
    flex: 1,
  },
  displayName: {
    fontSize: 19,
    fontWeight: "800",
  },
  handle: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: "700",
  },
  presence: {
    marginTop: 3,
    fontSize: 12,
  },
  statusPill: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusText: {
    fontSize: 12.5,
    fontWeight: "600",
  },
  bioText: {
    marginTop: 12,
    fontSize: 13.5,
    lineHeight: 20,
  },
  errText: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: "600",
  },
  actionsCol: {
    marginTop: 16,
    gap: 10,
  },
  primaryBtn: {
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#0B0C10",
    fontWeight: "800",
    fontSize: 14,
  },
  secondaryRow: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: "center",
  },
  closeBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: "center",
  },
});
