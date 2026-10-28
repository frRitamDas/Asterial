import { AppState, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getMobileRuntimeConfig } from '../config/env';

let cachedClient: SupabaseClient | null = null;
let appStateSubscriptionRegistered = false;

/**
 * Shared Supabase client for the dedicated React Native Android application.
 * Persists sessions natively via AsyncStorage and coordinates JWT refresh with
 * Android foreground/background lifecycle events.
 */
export function getMobileSupabaseClient(): SupabaseClient | null {
  if (cachedClient) {
    return cachedClient;
  }

  const config = getMobileRuntimeConfig();
  if (!config.isSupabaseConfigured) {
    return null;
  }

  cachedClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  if (!appStateSubscriptionRegistered) {
    appStateSubscriptionRegistered = true;
    AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (!cachedClient) return;
      if (nextState === 'active') {
        cachedClient.auth.startAutoRefresh();
      } else {
        cachedClient.auth.stopAutoRefresh();
      }
    });
  }

  return cachedClient;
}
