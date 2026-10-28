import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  ASTERIAL_BRAND,
  isValidPublicSupabaseConfig,
} from "@asterial/core";
import { MOBILE_ENV } from "../config/env";
import { AsterialNative } from "../native/AsterialNative";
import {
  asterialSecureSessionStorage,
  clearPersistedAuthSession,
} from "./secureSessionStorage";

const CACHED_PUBLIC_CONFIG_KEY = "@asterial/public-supabase-config-v2";
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;

export interface PublicSupabaseRuntimeConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  source: "build-env" | "cached-remote" | "live-remote";
}

export interface AuthConnectivityStatus {
  ok: boolean;
  endpointHost: string;
  configSource: PublicSupabaseRuntimeConfig["source"] | "unconfigured";
  statusCode?: number;
  detail?: string;
}

let activeConfig: PublicSupabaseRuntimeConfig | null =
  isValidPublicSupabaseConfig(MOBILE_ENV.supabaseUrl, MOBILE_ENV.supabaseAnonKey)
    ? {
        supabaseUrl: MOBILE_ENV.supabaseUrl,
        supabaseAnonKey: MOBILE_ENV.supabaseAnonKey,
        source: "build-env",
      }
    : null;

let mobileClient: SupabaseClient | null = null;
let appStateListenerBound = false;

function normalizeHeaders(
  headersInit?: RequestInit["headers"]
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headersInit) return out;

  if (typeof Headers !== "undefined" && headersInit instanceof Headers) {
    headersInit.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }

  if (Array.isArray(headersInit)) {
    for (const pair of headersInit) {
      if (pair && pair.length >= 2) {
        out[String(pair[0])] = String(pair[1]);
      }
    }
    return out;
  }

  for (const [k, v] of Object.entries(
    headersInit as Record<string, string | undefined>
  )) {
    if (typeof v === "string") {
      out[k] = v;
    }
  }
  return out;
}

function serializeTextBody(
  body: RequestInit["body"] | null | undefined
): string | null {
  if (body === null || body === undefined) return null;
  if (typeof body === "string") return body;
  if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) {
    return body.toString();
  }
  return null;
}

/**
 * Resilient cross-layer HTTPS fetch for React Native 0.83 Android:
 * 1. Normalizes Request / URL inputs into plain string URLs + plain header maps
 *    so React Native's whatwg-fetch polyfill never mis-serializes Request objects.
 * 2. Enforces a deterministic 15s request timeout.
 * 3. Falls back to Android's native HttpsURLConnection bridge when JS fetch throws
 *    `TypeError: Network request failed` on HTTPS text/JSON requests (such as
 *    Supabase GoTrue /auth/v1/token, /auth/v1/signup, /auth/v1/recover, and PostgREST).
 */
export async function asterialResilientFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  const method = (
    init?.method ||
    (typeof Request !== "undefined" && input instanceof Request
      ? input.method
      : "GET")
  ).toUpperCase();

  const mergedHeaders: Record<string, string> = {
    ...(typeof Request !== "undefined" && input instanceof Request
      ? normalizeHeaders(input.headers)
      : {}),
    ...normalizeHeaders(init?.headers),
  };

  const rawBody = init?.body;
  const textBody = serializeTextBody(rawBody);
  const canUseNativeFallback =
    url.startsWith("https://") &&
    AsterialNative.hasNativeHttpsBridge() &&
    (rawBody === undefined || rawBody === null || textBody !== null);

  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  const externalSignal = init?.signal;
  const onExternalAbort = () => controller?.abort();

  if (externalSignal && controller) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    }
  }

  const timeoutId = controller
    ? setTimeout(() => controller.abort(), DEFAULT_REQUEST_TIMEOUT_MS)
    : null;

  try {
    return await fetch(url, {
      ...init,
      method,
      headers: mergedHeaders,
      signal: controller ? controller.signal : init?.signal,
    });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
    const isNetworkBridgeError =
      msg.includes("network request failed") ||
      msg.includes("failed to fetch") ||
      msg.includes("aborted");

    if (canUseNativeFallback && isNetworkBridgeError && !externalSignal?.aborted) {
      const nativeRes = await AsterialNative.nativeHttpsRequest({
        url,
        method,
        headersJson: JSON.stringify(mergedHeaders),
        body: textBody,
        timeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
      });

      let parsedHeaders: Record<string, string> = {};
      try {
        parsedHeaders = JSON.parse(nativeRes.headersJson) as Record<
          string,
          string
        >;
      } catch {
        parsedHeaders = {};
      }

      return new Response(nativeRes.bodyText, {
        status: nativeRes.status,
        statusText: nativeRes.statusText,
        headers: parsedHeaders,
      });
    }

    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (externalSignal && controller) {
      externalSignal.removeEventListener("abort", onExternalAbort);
    }
  }
}

function ensureAppStateRefresh(client: SupabaseClient): void {
  if (appStateListenerBound) return;
  appStateListenerBound = true;

  AppState.addEventListener("change", (nextState) => {
    if (nextState === "active") {
      client.auth.startAutoRefresh();
    } else {
      client.auth.stopAutoRefresh();
    }
  });
}

function buildClientFromConfig(
  cfg: PublicSupabaseRuntimeConfig
): SupabaseClient {
  const client = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: {
      storage: asterialSecureSessionStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    global: {
      fetch: asterialResilientFetch,
      headers: {
        "x-client-info": `asterial-android/${ASTERIAL_BRAND.semver}`,
      },
    },
  });
  ensureAppStateRefresh(client);
  return client;
}

export function getActiveSupabaseConfig(): PublicSupabaseRuntimeConfig | null {
  return activeConfig;
}

export function getMobileSupabase(): SupabaseClient | null {
  if (mobileClient) return mobileClient;
  if (!activeConfig) return null;
  mobileClient = buildClientFromConfig(activeConfig);
  return mobileClient;
}

/**
 * Resolves the public Supabase URL + anon key for standalone Android APK installs:
 * 1. Verified build-time public config (if valid & non-placeholder)
 * 2. Verified cached remote config in device storage
 * 3. Live HTTPS bootstrap from https://asterial.vercel.app/api/mobile-config
 */
export async function ensureMobileSupabaseClient(options?: {
  forceRemoteRefresh?: boolean;
}): Promise<SupabaseClient | null> {
  if (!options?.forceRemoteRefresh) {
    const existing = getMobileSupabase();
    if (existing) return existing;

    try {
      const cachedRaw = await AsyncStorage.getItem(CACHED_PUBLIC_CONFIG_KEY);
      if (cachedRaw) {
        const parsed = JSON.parse(cachedRaw) as {
          supabaseUrl?: string;
          supabaseAnonKey?: string;
        };
        if (
          isValidPublicSupabaseConfig(parsed.supabaseUrl, parsed.supabaseAnonKey)
        ) {
          activeConfig = {
            supabaseUrl: parsed.supabaseUrl!.trim().replace(/\/+$/, ""),
            supabaseAnonKey: parsed.supabaseAnonKey!.trim(),
            source: "cached-remote",
          };
          mobileClient = buildClientFromConfig(activeConfig);
          return mobileClient;
        }
      }
    } catch {
      // Fall through to live HTTPS fetch
    }
  }

  try {
    const response = await asterialResilientFetch(
      `${MOBILE_ENV.appWebUrl}/api/mobile-config`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );
    if (!response.ok) return getMobileSupabase();

    const payload = (await response.json()) as {
      supabaseUrl?: string;
      supabaseAnonKey?: string;
    };
    if (
      isValidPublicSupabaseConfig(payload.supabaseUrl, payload.supabaseAnonKey)
    ) {
      const cleanUrl = payload.supabaseUrl!.trim().replace(/\/+$/, "");
      const cleanKey = payload.supabaseAnonKey!.trim();
      const configChanged =
        !activeConfig ||
        activeConfig.supabaseUrl !== cleanUrl ||
        activeConfig.supabaseAnonKey !== cleanKey;

      activeConfig = {
        supabaseUrl: cleanUrl,
        supabaseAnonKey: cleanKey,
        source: "live-remote",
      };
      await AsyncStorage.setItem(
        CACHED_PUBLIC_CONFIG_KEY,
        JSON.stringify({
          supabaseUrl: activeConfig.supabaseUrl,
          supabaseAnonKey: activeConfig.supabaseAnonKey,
        })
      );
      if (configChanged || !mobileClient) {
        mobileClient = buildClientFromConfig(activeConfig);
      }
      return mobileClient;
    }
  } catch {
    // Offline or DNS unavailable
  }

  return getMobileSupabase();
}

/**
 * Verifies live HTTPS connectivity against `${supabaseUrl}/auth/v1/health`
 * using the configured public anon key. Safe to display on Auth diagnostics UI.
 */
export async function verifySupabaseAuthConnectivity(): Promise<AuthConnectivityStatus> {
  const client = await ensureMobileSupabaseClient();
  const cfg = getActiveSupabaseConfig();

  if (!client || !cfg) {
    return {
      ok: false,
      endpointHost: "unconfigured",
      configSource: "unconfigured",
      detail:
        "Public Supabase endpoint could not be resolved. Check your internet connection and tap Retry.",
    };
  }

  let endpointHost = "supabase.co";
  try {
    endpointHost = new URL(cfg.supabaseUrl).host;
  } catch {
    endpointHost = "invalid-url";
  }

  try {
    const res = await asterialResilientFetch(
      `${cfg.supabaseUrl}/auth/v1/health`,
      {
        method: "GET",
        headers: {
          apikey: cfg.supabaseAnonKey,
          Accept: "application/json",
        },
      }
    );

    if (res.ok) {
      return {
        ok: true,
        endpointHost,
        configSource: cfg.source,
        statusCode: res.status,
      };
    }

    return {
      ok: false,
      endpointHost,
      configSource: cfg.source,
      statusCode: res.status,
      detail: `Authentication health check returned HTTP ${res.status}.`,
    };
  } catch (err) {
    return {
      ok: false,
      endpointHost,
      configSource: cfg.source,
      detail:
        err instanceof Error
          ? err.message
          : "Unable to establish HTTPS connection to authentication service.",
    };
  }
}

export { clearPersistedAuthSession };
