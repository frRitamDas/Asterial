import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ASTERIAL_BRAND } from "@asterial/core";
import { GENERATED_MOBILE_ENV } from "../config/runtimeEnv.generated";

const CACHED_PUBLIC_CONFIG_KEY = "@asterial/public-supabase-config-v1";

export interface PublicSupabaseRuntimeConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  source: "build-env" | "cached-remote" | "live-remote";
}

let activeConfig: PublicSupabaseRuntimeConfig | null =
  GENERATED_MOBILE_ENV.supabaseUrl && GENERATED_MOBILE_ENV.supabaseAnonKey
    ? {
        supabaseUrl: GENERATED_MOBILE_ENV.supabaseUrl,
        supabaseAnonKey: GENERATED_MOBILE_ENV.supabaseAnonKey,
        source: "build-env",
      }
    : null;

let mobileClient: SupabaseClient | null = null;
let appStateListenerBound = false;

function ensureAppStateRefresh(client: SupabaseClient): void {
  if (appStateListenerBound) return;
  appStateListenerBound = true;
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      client.auth.startAutoRefresh();
    } else {
      client.auth.stopAutoRefresh();
    }
  });
}

function buildSupabaseClient(
  cfg: PublicSupabaseRuntimeConfig
): SupabaseClient {
  const client = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  ensureAppStateRefresh(client);
  return client;
}

export function getActiveSupabaseConfig(): PublicSupabaseRuntimeConfig | null {
  return activeConfig;
}

export function getMobileSupabaseClient(): SupabaseClient | null {
  if (mobileClient) return mobileClient;
  if (!activeConfig) return null;
  mobileClient = buildSupabaseClient(activeConfig);
  return mobileClient;
}

/**
 * Ensures the standalone APK connects to live Supabase either via build-time
 * public env vars or via ASTERIAL's public `/api/mobile-config` bootstrap endpoint
 * (which exposes only public URL + role=anon key and is cached in AsyncStorage).
 */
export async function ensureMobileSupabaseClient(): Promise<SupabaseClient | null> {
  const existing = getMobileSupabaseClient();
  if (existing) return existing;

  try {
    const cachedRaw = await AsyncStorage.getItem(CACHED_PUBLIC_CONFIG_KEY);
    if (cachedRaw) {
      const parsed = JSON.parse(cachedRaw) as {
        supabaseUrl?: string;
        supabaseAnonKey?: string;
      };
      if (parsed.supabaseUrl && parsed.supabaseAnonKey) {
        activeConfig = {
          supabaseUrl: parsed.supabaseUrl,
          supabaseAnonKey: parsed.supabaseAnonKey,
          source: "cached-remote",
        };
        mobileClient = buildSupabaseClient(activeConfig);
        return mobileClient;
      }
    }
  } catch {
    // Ignore corrupted cache entry and fetch fresh public config
  }

  try {
    const baseUrl =
      GENERATED_MOBILE_ENV.appWebUrl || ASTERIAL_BRAND.productionUrl;
    const res = await fetch(`${baseUrl}/api/mobile-config`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      supabaseUrl?: string;
      supabaseAnonKey?: string;
    };
    const url = (data.supabaseUrl || "").trim();
    const anonKey = (data.supabaseAnonKey || "").trim();
    if (!url || !anonKey || /^sb_secret_/i.test(anonKey)) {
      return null;
    }

    activeConfig = {
      supabaseUrl: url,
      supabaseAnonKey: anonKey,
      source: "live-remote",
    };
    await AsyncStorage.setItem(
      CACHED_PUBLIC_CONFIG_KEY,
      JSON.stringify({ supabaseUrl: url, supabaseAnonKey: anonKey })
    );
    mobileClient = buildSupabaseClient(activeConfig);
    return mobileClient;
  } catch {
    return null;
  }
}
