import { GENERATED_MOBILE_ENV } from './runtimeEnv.generated';

export interface MobileRuntimeConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  appWebUrl: string;
  isSupabaseConfigured: boolean;
}

export function getMobileRuntimeConfig(): MobileRuntimeConfig {
  const supabaseUrl = GENERATED_MOBILE_ENV.supabaseUrl.trim();
  const supabaseAnonKey = GENERATED_MOBILE_ENV.supabaseAnonKey.trim();
  const appWebUrl =
    GENERATED_MOBILE_ENV.appWebUrl.trim() || 'https://asterial.vercel.app';

  const isSupabaseConfigured =
    supabaseUrl.startsWith('https://') &&
    !supabaseUrl.includes('your-project-ref') &&
    supabaseAnonKey.length >= 20;

  return {
    supabaseUrl,
    supabaseAnonKey,
    appWebUrl,
    isSupabaseConfigured,
  };
}
