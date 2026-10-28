import {
  ASTERIAL_BRAND,
  isValidPublicSupabaseConfig,
  isValidPublicSupabaseUrl,
} from "@asterial/core";
import { GENERATED_MOBILE_ENV } from "./runtimeEnv.generated";

const validGeneratedConfig = isValidPublicSupabaseConfig(
  GENERATED_MOBILE_ENV.supabaseUrl,
  GENERATED_MOBILE_ENV.supabaseAnonKey
);

/**
 * Validated runtime configuration for the React Native Android client.
 * Rejects placeholder hosts, localhost/10.0.2.2 loopbacks, and non-anon keys.
 */
export const MOBILE_ENV = {
  supabaseUrl: validGeneratedConfig
    ? GENERATED_MOBILE_ENV.supabaseUrl.trim().replace(/\/+$/, "")
    : "",
  supabaseAnonKey: validGeneratedConfig
    ? GENERATED_MOBILE_ENV.supabaseAnonKey.trim()
    : "",
  appWebUrl: isValidPublicSupabaseUrl(GENERATED_MOBILE_ENV.appWebUrl)
    ? GENERATED_MOBILE_ENV.appWebUrl.trim().replace(/\/+$/, "")
    : ASTERIAL_BRAND.productionUrl,
  deepLinkScheme: "asterial",
  authCallbackRedirectUrl: "asterial://auth/callback",
} as const;

export function isMobileSupabaseConfigured(): boolean {
  return isValidPublicSupabaseConfig(
    MOBILE_ENV.supabaseUrl,
    MOBILE_ENV.supabaseAnonKey
  );
}

export function getMobileRuntimeConfig() {
  return {
    ...MOBILE_ENV,
    isSupabaseConfigured: isMobileSupabaseConfigured(),
  };
}
