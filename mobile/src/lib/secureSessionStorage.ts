import AsyncStorage from "@react-native-async-storage/async-storage";
import { AsterialNative } from "../native/AsterialNative";

const TRACKED_AUTH_KEYS = new Set<string>();

function isLikelySupabaseAuthKey(key: string): boolean {
  return key.startsWith("sb-") || key.includes("auth-token");
}

/**
 * Validates that a persisted Supabase session payload is well-formed JSON so
 * truncated or corrupted local state never crashes session boot.
 */
function sanitizeSessionValue(key: string, raw: string | null): string | null {
  if (!raw) return null;
  if (!isLikelySupabaseAuthKey(key)) return raw;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

/**
 * Hardware-backed Android KeyStore AES-256-GCM storage adapter for Supabase Auth,
 * with transparent migration from AsyncStorage (v1.3.0) and test-runner fallback.
 */
export const asterialSecureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    TRACKED_AUTH_KEYS.add(key);
    try {
      const secureVal = await AsterialNative.getSecureItem(key);
      if (secureVal !== null) {
        const clean = sanitizeSessionValue(key, secureVal);
        if (clean === null) {
          await AsterialNative.removeSecureItem(key);
        }
        return clean;
      }
    } catch {
      // Fall back to AsyncStorage if native bridge unavailable (e.g., Node unit tests)
    }

    try {
      const legacyVal = await AsyncStorage.getItem(key);
      if (legacyVal !== null) {
        const clean = sanitizeSessionValue(key, legacyVal);
        if (clean === null) {
          await AsyncStorage.removeItem(key);
          return null;
        }
        const migrated = await AsterialNative.setSecureItem(key, clean);
        if (migrated) {
          await AsyncStorage.removeItem(key);
        }
        return clean;
      }
    } catch {
      // ignore
    }

    return null;
  },

  async setItem(key: string, value: string): Promise<void> {
    TRACKED_AUTH_KEYS.add(key);
    try {
      const savedSecure = await AsterialNative.setSecureItem(key, value);
      if (savedSecure) return;
    } catch {
      // Fall back to AsyncStorage in Node unit test environments
    }
    await AsyncStorage.setItem(key, value);
  },

  async removeItem(key: string): Promise<void> {
    TRACKED_AUTH_KEYS.delete(key);
    try {
      await AsterialNative.removeSecureItem(key);
    } catch {
      // ignore
    }
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

export async function clearPersistedAuthSession(): Promise<void> {
  const keys = Array.from(TRACKED_AUTH_KEYS);
  for (const key of keys) {
    await asterialSecureSessionStorage.removeItem(key);
  }
  try {
    await AsterialNative.clearSecureStorage();
  } catch {
    // ignore
  }
  try {
    const allAsyncKeys = await AsyncStorage.getAllKeys();
    const authKeys = allAsyncKeys.filter((k) => isLikelySupabaseAuthKey(k));
    if (authKeys.length > 0) {
      await AsyncStorage.multiRemove(authKeys);
    }
  } catch {
    // ignore
  }
}
