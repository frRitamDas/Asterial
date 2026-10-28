import React, { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View, type ImageStyle, type StyleProp } from "react-native";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ThemePalette } from "@asterial/core";
import {
  getCachedSignedUrl,
  resolvePrivateSignedUrl,
  type PrivateStorageBucket,
} from "../lib/storage";

export function NativePrivateImage({
  supabase,
  bucket,
  path,
  alt,
  palette,
  style,
}: {
  supabase: SupabaseClient | null;
  bucket: PrivateStorageBucket;
  path: string;
  alt: string;
  palette: ThemePalette;
  style?: StyleProp<ImageStyle>;
}) {
  const cached = getCachedSignedUrl(bucket, path);
  const [resolved, setResolved] = useState<{
    path: string;
    url: string | null;
  } | null>(null);
  const [failedPath, setFailedPath] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!supabase || !path || cached) return;
    resolvePrivateSignedUrl(supabase, bucket, path).then((url) => {
      if (active) {
        setResolved({ path, url });
      }
    });
    return () => {
      active = false;
    };
  }, [bucket, cached, path, supabase]);

  const url =
    cached || (resolved && resolved.path === path ? resolved.url : null);

  if (failedPath === path || (resolved && resolved.path === path && !url)) {
    return (
      <View
        style={[
          styles.fallbackBox,
          {
            backgroundColor: palette.bgElevated,
            borderColor: palette.borderSubtle,
          },
        ]}
      >
        <Text style={[styles.fallbackText, { color: palette.textMuted }]}>
          Media unavailable or expired
        </Text>
      </View>
    );
  }

  if (!url) {
    return (
      <View
        style={[
          styles.skeletonBox,
          {
            backgroundColor: palette.bgElevated,
            borderColor: palette.borderSubtle,
          },
        ]}
      />
    );
  }

  return (
    <Image
      source={{ uri: url }}
      alt={alt}
      onError={() => setFailedPath(path)}
      style={[
        styles.image,
        {
          borderColor: palette.borderSubtle,
          backgroundColor: palette.bgVoid,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  image: {
    width: "100%",
    height: 210,
    borderRadius: 14,
    borderWidth: 1,
    resizeMode: "cover",
  },
  skeletonBox: {
    width: "100%",
    height: 190,
    borderRadius: 14,
    borderWidth: 1,
  },
  fallbackBox: {
    width: "100%",
    paddingVertical: 22,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
