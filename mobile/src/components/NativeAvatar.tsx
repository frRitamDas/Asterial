import React, { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getInitials, type ThemePalette } from "@asterial/core";
import { getCachedSignedUrl, resolvePrivateSignedUrl } from "../lib/storage";

export function NativeAvatar({
  supabase,
  storagePath,
  label,
  palette,
  size = 44,
  isOnline,
  isGroup = false,
}: {
  supabase: SupabaseClient | null;
  storagePath: string | null | undefined;
  label: string;
  palette: ThemePalette;
  size?: number;
  isOnline?: boolean;
  isGroup?: boolean;
}) {
  const [resolvedState, setResolvedState] = useState<{
    path: string;
    url: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    if (!supabase || !storagePath) {
      return () => {
        active = false;
      };
    }

    if (getCachedSignedUrl("avatars", storagePath)) {
      return () => {
        active = false;
      };
    }

    void resolvePrivateSignedUrl(supabase, "avatars", storagePath).then(
      (signed) => {
        if (active && signed) {
          setResolvedState({ path: storagePath, url: signed });
        }
      }
    );

    return () => {
      active = false;
    };
  }, [storagePath, supabase]);

  const activeUrl = storagePath
    ? getCachedSignedUrl("avatars", storagePath) ||
      (resolvedState?.path === storagePath ? resolvedState.url : null)
    : null;

  const radius = isGroup ? Math.round(size * 0.3) : Math.round(size / 2);

  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.avatarFrame,
          {
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: isGroup ? palette.accentSoft : palette.bgElevated,
            borderColor: isGroup ? `${palette.accent}45` : palette.borderSubtle,
          },
        ]}
      >
        {activeUrl ? (
          <Image
            alt={label}
            source={{ uri: activeUrl }}
            style={{
              width: size - 2,
              height: size - 2,
              borderRadius: radius,
            }}
            resizeMode="cover"
          />
        ) : (
          <Text
            style={[
              styles.initials,
              {
                color: isGroup ? palette.accent : palette.textPrimary,
                fontSize: Math.max(12, Math.round(size * 0.34)),
              },
            ]}
          >
            {getInitials(label)}
          </Text>
        )}
      </View>

      {typeof isOnline === "boolean" && !isGroup ? (
        <View
          style={[
            styles.presenceDot,
            {
              backgroundColor: isOnline ? palette.success : palette.textMuted,
              borderColor: palette.bgVoid,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  avatarFrame: {
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  initials: {
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  presenceDot: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
});
