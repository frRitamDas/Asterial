"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { StatusBar, Style as StatusBarStyle } from "@capacitor/status-bar";
import { Keyboard } from "@capacitor/keyboard";
import { Share } from "@capacitor/share";
import { Browser } from "@capacitor/browser";
import { sanitizeRedirectPath } from "@/lib/validation/schemas";
import { ASTERIAL_BRAND } from "@/lib/constants/brand";

export interface NativeAppInfo {
  isNative: boolean;
  platform: "android" | "ios" | "web";
  nativeVersion: string | null;
  nativeBuildCode: number | null;
  nativePackageId: string | null;
}

interface NativePlatformContextValue extends NativeAppInfo {
  shareContent: (opts: {
    title: string;
    text?: string;
    url?: string;
  }) => Promise<boolean>;
  openExternalUrl: (url: string) => Promise<void>;
  syncNativeThemeBar: (theme: string) => Promise<void>;
}

const NativePlatformContext = createContext<NativePlatformContextValue>({
  isNative: false,
  platform: "web",
  nativeVersion: null,
  nativeBuildCode: null,
  nativePackageId: null,
  shareContent: async () => false,
  openExternalUrl: async () => {},
  syncNativeThemeBar: async () => {},
});

export function NativePlatformProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [appInfo, setAppInfo] = useState<NativeAppInfo>(() => {
    const isNative =
      typeof window !== "undefined" && Capacitor.isNativePlatform();
    const rawPlat =
      typeof window !== "undefined" ? Capacitor.getPlatform() : "web";
    const platform =
      rawPlat === "android" || rawPlat === "ios" ? rawPlat : "web";
    return {
      isNative,
      platform,
      nativeVersion: null,
      nativeBuildCode: null,
      nativePackageId: null,
    };
  });

  const syncNativeThemeBar = useCallback(async (theme: string) => {
    if (typeof window === "undefined" || !Capacitor.isNativePlatform()) return;
    try {
      const isLight = theme === "alabaster";
      const bgHex =
        theme === "pitch"
          ? "#000000"
          : theme === "graphite"
            ? "#0c0c11"
            : isLight
              ? "#f1f2f6"
              : "#050507";
      await StatusBar.setOverlaysWebView({ overlay: false });
      await StatusBar.setBackgroundColor({ color: bgHex });
      await StatusBar.setStyle({
        style: isLight ? StatusBarStyle.Light : StatusBarStyle.Dark,
      });
    } catch {
      // Ignore if status bar plugin is unavailable in browser
    }
  }, []);

  // Initialize native metadata, status bar, keyboard resize mode, and deep-link listener
  useEffect(() => {
    if (typeof window === "undefined" || !Capacitor.isNativePlatform()) {
      return;
    }

    let disposed = false;

    void CapApp.getInfo()
      .then((info) => {
        if (disposed) return;
        const parsedBuild = Number.parseInt(info.build, 10);
        setAppInfo({
          isNative: true,
          platform:
            Capacitor.getPlatform() === "android" ? "android" : "web",
          nativeVersion: info.version || ASTERIAL_BRAND.semver,
          nativeBuildCode: Number.isFinite(parsedBuild) ? parsedBuild : null,
          nativePackageId: info.id || ASTERIAL_BRAND.androidPackageId,
        });
      })
      .catch(() => {});

    const currentTheme =
      document.documentElement.getAttribute("data-theme") || "obsidian";
    void syncNativeThemeBar(currentTheme);

    void Keyboard.setScroll({ isDisabled: false }).catch(() => {});

    const urlListenerPromise = CapApp.addListener("appUrlOpen", (event) => {
      try {
        const parsed = new URL(event.url);
        let candidatePath = parsed.pathname + parsed.search;

        // Support asterial://app/chats/123 custom scheme where host is "app"
        if (parsed.protocol === "asterial:") {
          candidatePath = `/${parsed.host}${parsed.pathname}${parsed.search}`;
        }

        const safePath = sanitizeRedirectPath(candidatePath, "/app/chats");
        router.push(safePath);
      } catch {
        // Ignore malformed deep link URLs
      }
    });

    return () => {
      disposed = true;
      void urlListenerPromise.then((h) => h.remove());
    };
  }, [router, syncNativeThemeBar]);

  // Observe data-theme attribute mutations so StatusBar always matches user appearance
  useEffect(() => {
    if (typeof window === "undefined" || !Capacitor.isNativePlatform()) {
      return;
    }
    const observer = new MutationObserver(() => {
      const theme =
        document.documentElement.getAttribute("data-theme") || "obsidian";
      void syncNativeThemeBar(theme);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, [syncNativeThemeBar]);

  // Android Hardware / Gesture Back Button handling
  useEffect(() => {
    if (typeof window === "undefined" || !Capacitor.isNativePlatform()) {
      return;
    }

    const backPromise = CapApp.addListener("backButton", ({ canGoBack }) => {
      // 1. Dismiss any open modal/dialog first via Escape event
      const openDialog = document.querySelector('[role="dialog"][aria-modal="true"]');
      if (openDialog) {
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
        );
        return;
      }

      // 2. From an active chat thread or secondary workspace tab, return cleanly to /app/chats
      if (pathname.startsWith("/app/chats/") && pathname !== "/app/chats") {
        router.push("/app/chats");
        return;
      }

      if (
        pathname.startsWith("/app/") &&
        pathname !== "/app/chats"
      ) {
        router.push("/app/chats");
        return;
      }

      // 3. At root entry points, minimize/exit cleanly instead of looping auth redirects
      if (
        pathname === "/app/chats" ||
        pathname === "/" ||
        pathname === "/login"
      ) {
        void CapApp.minimizeApp().catch(() => {
          void CapApp.exitApp();
        });
        return;
      }

      if (canGoBack) {
        window.history.back();
      } else {
        void CapApp.minimizeApp().catch(() => {});
      }
    });

    return () => {
      void backPromise.then((h) => h.remove());
    };
  }, [pathname, router]);

  const shareContent = useCallback(
    async (opts: { title: string; text?: string; url?: string }) => {
      try {
        if (Capacitor.isNativePlatform()) {
          await Share.share({
            title: opts.title,
            text: opts.text,
            url: opts.url,
            dialogTitle: opts.title,
          });
          return true;
        }
        if (typeof navigator !== "undefined" && navigator.share) {
          await navigator.share(opts);
          return true;
        }
        if (opts.url && typeof navigator !== "undefined" && navigator.clipboard) {
          await navigator.clipboard.writeText(opts.url);
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    []
  );

  const openExternalUrl = useCallback(async (url: string) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return;
      }
      if (Capacitor.isNativePlatform()) {
        await Browser.open({ url: parsed.toString() });
      } else {
        window.open(parsed.toString(), "_blank", "noopener,noreferrer");
      }
    } catch {
      // Ignore invalid external URLs
    }
  }, []);

  const contextValue = useMemo<NativePlatformContextValue>(
    () => ({
      ...appInfo,
      shareContent,
      openExternalUrl,
      syncNativeThemeBar,
    }),
    [appInfo, openExternalUrl, shareContent, syncNativeThemeBar]
  );

  return (
    <NativePlatformContext.Provider value={contextValue}>
      {children}
    </NativePlatformContext.Provider>
  );
}

export function useNativePlatform() {
  return useContext(NativePlatformContext);
}
