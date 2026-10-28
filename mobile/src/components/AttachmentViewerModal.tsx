import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatBytes,
  type AttachmentRow,
  type ThemePalette,
} from "@asterial/core";
import { getCachedSignedUrl, resolvePrivateSignedUrl } from "../lib/storage";

export function AttachmentViewerModal({
  visible,
  attachment,
  supabase,
  palette,
  onClose,
}: {
  visible: boolean;
  attachment: AttachmentRow | null;
  supabase: SupabaseClient | null;
  palette: ThemePalette;
  onClose: () => void;
}) {
  const [resolvedState, setResolvedState] = useState<{
    path: string;
    url: string | null;
  } | null>(null);
  const [openErr, setOpenErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!visible || !supabase || !attachment?.storage_path) {
      return () => {
        active = false;
      };
    }

    const targetPath = attachment.storage_path;
    if (getCachedSignedUrl("chat-attachments", targetPath)) {
      return () => {
        active = false;
      };
    }

    void resolvePrivateSignedUrl(supabase, "chat-attachments", targetPath).then(
      (url) => {
        if (active) {
          setResolvedState({ path: targetPath, url });
        }
      }
    );

    return () => {
      active = false;
    };
  }, [attachment?.storage_path, supabase, visible]);

  if (!attachment) return null;

  const cachedUrl = getCachedSignedUrl(
    "chat-attachments",
    attachment.storage_path
  );
  const signedUrl =
    cachedUrl ||
    (resolvedState?.path === attachment.storage_path
      ? resolvedState.url
      : undefined);

  const loading = signedUrl === undefined;
  const isImage = attachment.mime_type.startsWith("image/");

  const handleOpenExternal = async () => {
    if (!signedUrl) return;
    setOpenErr(null);
    try {
      await Linking.openURL(signedUrl);
    } catch {
      setOpenErr("Unable to open external viewer for this attachment.");
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.topBar}>
          <View style={styles.metaCol}>
            <Text
              numberOfLines={1}
              style={[styles.fileName, { color: "#F5F7FA" }]}
            >
              {attachment.file_name}
            </Text>
            <Text style={styles.fileMeta}>
              {attachment.mime_type} · {formatBytes(attachment.byte_size)}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            accessibilityLabel="Close attachment preview"
            style={styles.closePill}
          >
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>

        <View style={styles.bodyArea}>
          {loading ? (
            <ActivityIndicator color={palette.accent} size="large" />
          ) : !signedUrl ? (
            <Text style={[styles.errorLabel, { color: palette.danger }]}>
              Private signed URL expired or access was revoked.
            </Text>
          ) : isImage ? (
            <Image
              alt={attachment.file_name}
              source={{ uri: signedUrl }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          ) : (
            <View
              style={[
                styles.docCard,
                {
                  backgroundColor: palette.bgSurface,
                  borderColor: palette.borderSubtle,
                },
              ]}
            >
              <Text style={[styles.docIcon, { color: palette.accent }]}>
                DOC
              </Text>
              <Text style={[styles.docTitle, { color: palette.textPrimary }]}>
                {attachment.file_name}
              </Text>
              <Text style={[styles.docSub, { color: palette.textSecondary }]}>
                {formatBytes(attachment.byte_size)} · Private signed link ready
              </Text>
            </View>
          )}
        </View>

        {openErr ? (
          <Text style={[styles.errorLabel, { color: palette.danger }]}>
            {openErr}
          </Text>
        ) : null}

        {signedUrl ? (
          <View style={styles.bottomBar}>
            <Pressable
              onPress={() => void handleOpenExternal()}
              style={[styles.openBtn, { backgroundColor: palette.accent }]}
            >
              <Text style={[styles.openBtnText, { color: palette.accentFg }]}>
                {isImage ? "Open / Save Full Image" : "Open Document"}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(5, 6, 9, 0.96)",
    paddingHorizontal: 16,
    paddingVertical: 28,
    justifyContent: "space-between",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  metaCol: {
    flex: 1,
  },
  fileName: {
    fontSize: 15,
    fontWeight: "700",
  },
  fileMeta: {
    marginTop: 2,
    fontSize: 11.5,
    color: "#9AA1B2",
  },
  closePill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  closeText: {
    color: "#F5F7FA",
    fontSize: 12.5,
    fontWeight: "700",
  },
  bodyArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 14,
  },
  fullImage: {
    width: "100%",
    height: "100%",
  },
  docCard: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
  },
  docIcon: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 2,
  },
  docTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  docSub: {
    marginTop: 4,
    fontSize: 12.5,
  },
  errorLabel: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  bottomBar: {
    paddingTop: 8,
  },
  openBtn: {
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
  },
  openBtnText: {
    color: "#0B0C10",
    fontSize: 13.5,
    fontWeight: "800",
  },
});
