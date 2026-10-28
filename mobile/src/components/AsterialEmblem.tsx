import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ASTERIAL_BRAND, type ThemePalette } from "@asterial/core";

export function AsterialEmblem({
  palette,
  size = 44,
}: {
  palette: ThemePalette;
  size?: number;
}) {
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${ASTERIAL_BRAND.name} emblem`}
      style={[
        styles.emblemBox,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.3),
          borderColor: `${palette.accent}55`,
          backgroundColor: palette.bgSurface,
        },
      ]}
    >
      <View
        style={[
          styles.innerRing,
          {
            width: Math.round(size * 0.62),
            height: Math.round(size * 0.62),
            borderRadius: Math.round(size * 0.31),
            borderColor: `${palette.accent}70`,
          },
        ]}
      />
      <Text
        style={[
          styles.glyph,
          {
            color: palette.accent,
            fontSize: Math.round(size * 0.44),
          },
        ]}
      >
        ✦
      </Text>
    </View>
  );
}

export function BrandLockup({
  palette,
  subtitle,
  compact = false,
}: {
  palette: ThemePalette;
  subtitle?: string;
  compact?: boolean;
}) {
  return (
    <View style={styles.lockupRow}>
      <AsterialEmblem palette={palette} size={compact ? 36 : 46} />
      <View style={styles.lockupTextCol}>
        <View style={styles.titleRow}>
          <Text
            style={[
              styles.brandName,
              {
                color: palette.textPrimary,
                fontSize: compact ? 16 : 19,
              },
            ]}
          >
            {ASTERIAL_BRAND.name}
          </Text>
          <View
            style={[
              styles.versionPill,
              {
                backgroundColor: palette.accentSoft,
                borderColor: `${palette.accent}45`,
              },
            ]}
          >
            <Text style={[styles.versionText, { color: palette.accent }]}>
              v{ASTERIAL_BRAND.version}
            </Text>
          </View>
        </View>
        <Text
          numberOfLines={1}
          style={[styles.subText, { color: palette.textMuted }]}
        >
          {subtitle || ASTERIAL_BRAND.attribution}
        </Text>
      </View>
    </View>
  );
}

export function StatusBanners({
  palette,
  isOnline,
  toast,
  onDismissToast,
}: {
  palette: ThemePalette;
  isOnline: boolean;
  toast: { kind: "info" | "success" | "error"; text: string } | null;
  onDismissToast: () => void;
}) {
  return (
    <>
      {!isOnline ? (
        <View
          accessibilityLiveRegion="polite"
          style={[
            styles.offlineBar,
            {
              backgroundColor: `${palette.danger}22`,
              borderBottomColor: `${palette.danger}55`,
            },
          ]}
        >
          <Text style={[styles.offlineText, { color: palette.textPrimary }]}>
            Offline — reconnecting automatically when network returns
          </Text>
        </View>
      ) : null}

      {toast ? (
        <Pressable
          onPress={onDismissToast}
          accessibilityRole="alert"
          style={[
            styles.toastBar,
            {
              backgroundColor: palette.bgElevated,
              borderColor:
                toast.kind === "error"
                  ? palette.danger
                  : toast.kind === "success"
                  ? palette.success
                  : palette.accent,
            },
          ]}
        >
          <View
            style={[
              styles.toastDot,
              {
                backgroundColor:
                  toast.kind === "error"
                    ? palette.danger
                    : toast.kind === "success"
                    ? palette.success
                    : palette.accent,
              },
            ]}
          />
          <Text
            numberOfLines={2}
            style={[styles.toastText, { color: palette.textPrimary }]}
          >
            {toast.text}
          </Text>
        </Pressable>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  emblemBox: {
    borderWidth: 1.4,
    alignItems: "center",
    justifyContent: "center",
  },
  innerRing: {
    position: "absolute",
    borderWidth: 1,
  },
  glyph: {
    fontWeight: "800",
  },
  lockupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  lockupTextCol: {
    flexShrink: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  brandName: {
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  versionPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1.5,
  },
  versionText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  subText: {
    marginTop: 1,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  offlineBar: {
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
    alignItems: "center",
  },
  offlineText: {
    fontSize: 12,
    fontWeight: "600",
  },
  toastBar: {
    marginHorizontal: 14,
    marginTop: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  toastDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  toastText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "600",
  },
});
