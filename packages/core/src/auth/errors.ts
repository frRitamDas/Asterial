/**
 * Shared Authentication Diagnostics & Public Endpoint Validation
 * Used across both Next.js Web and React Native Android.
 */

export type AuthFailureCategory =
  | "invalid_credentials"
  | "unverified_email"
  | "user_already_exists"
  | "rate_limited"
  | "session_expired"
  | "offline"
  | "network_unreachable"
  | "configuration_error"
  | "validation_error"
  | "server_error";

export interface ClassifiedAuthError {
  category: AuthFailureCategory;
  userMessage: string;
  retryable: boolean;
}

const DISALLOWED_SUPABASE_HOSTS = new Set([
  "placeholder.supabase.co",
  "your-project-ref.supabase.co",
  "example.com",
  "example.supabase.co",
  "localhost",
  "127.0.0.1",
  "10.0.2.2",
  "0.0.0.0",
]);

/**
 * Validates that a candidate Supabase URL is a genuine, non-placeholder HTTPS endpoint.
 */
export function isValidPublicSupabaseUrl(rawUrl: string | undefined | null): boolean {
  if (!rawUrl || typeof rawUrl !== "string") return false;
  const trimmed = rawUrl.trim();
  if (!trimmed.startsWith("https://")) return false;

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    if (!host || !host.includes(".")) return false;
    if (DISALLOWED_SUPABASE_HOSTS.has(host)) return false;
    if (
      host.includes("placeholder") ||
      host.includes("your-project") ||
      host.endsWith(".local") ||
      host.endsWith(".invalid")
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function decodeBase64UrlSegment(segment: string): string | null {
  try {
    const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "="
    );
    if (typeof globalThis.atob === "function") {
      return globalThis.atob(padded);
    }
    if (typeof Buffer !== "undefined") {
      return Buffer.from(padded, "base64").toString("utf8");
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Validates that a candidate Supabase client key is a real public anon or
 * sb_publishable_* key — rejecting placeholders, sb_secret_*, and service_role JWTs.
 */
export function isValidPublicSupabaseAnonKey(
  rawKey: string | undefined | null
): boolean {
  if (!rawKey || typeof rawKey !== "string") return false;
  const trimmed = rawKey.trim();
  if (trimmed.length < 24) return false;

  const lower = trimmed.toLowerCase();
  if (
    lower.includes("placeholder") ||
    lower.includes("your-anon-key") ||
    lower.startsWith("sb_secret_")
  ) {
    return false;
  }

  if (trimmed.startsWith("sb_publishable_")) {
    return trimmed.length >= 30;
  }

  const parts = trimmed.split(".");
  if (parts.length === 3 && parts[1]) {
    const json = decodeBase64UrlSegment(parts[1]);
    if (!json) return false;
    try {
      const payload = JSON.parse(json) as { role?: string };
      if (payload.role && payload.role !== "anon") {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

export function isValidPublicSupabaseConfig(
  url: string | undefined | null,
  anonKey: string | undefined | null
): boolean {
  return isValidPublicSupabaseUrl(url) && isValidPublicSupabaseAnonKey(anonKey);
}

/**
 * Maps raw Supabase / fetch / network errors into actionable, safe user messages
 * that never leak tokens, keys, or internal SQL traces.
 */
export function classifyAuthError(
  err: unknown,
  isDeviceOnline = true
): ClassifiedAuthError {
  if (!isDeviceOnline) {
    return {
      category: "offline",
      userMessage:
        "You appear to be offline. Connect to Wi-Fi or mobile data and try again.",
      retryable: true,
    };
  }

  const rawMessage =
    err instanceof Error
      ? err.message
      : typeof err === "object" &&
          err !== null &&
          "message" in err &&
          typeof (err as { message?: unknown }).message === "string"
        ? (err as { message: string }).message
        : String(err ?? "");

  const status =
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    typeof (err as { status?: unknown }).status === "number"
      ? (err as { status: number }).status
      : undefined;

  const lower = rawMessage.toLowerCase();

  if (
    lower.includes("invalid login credentials") ||
    lower.includes("invalid email or password") ||
    lower.includes("invalid_credentials")
  ) {
    return {
      category: "invalid_credentials",
      userMessage:
        "Incorrect email address or password. Check your credentials or reset your password.",
      retryable: false,
    };
  }

  if (lower.includes("email not confirmed")) {
    return {
      category: "unverified_email",
      userMessage:
        "Please confirm your email address first using the link sent to your inbox.",
      retryable: false,
    };
  }

  if (
    lower.includes("user already registered") ||
    lower.includes("already been registered") ||
    lower.includes("email address is already")
  ) {
    return {
      category: "user_already_exists",
      userMessage:
        "An account with this email address already exists. Sign in or reset your password.",
      retryable: false,
    };
  }

  if (
    lower.includes("invalid refresh token") ||
    lower.includes("refresh token not found") ||
    lower.includes("jwt expired") ||
    lower.includes("session_not_found")
  ) {
    return {
      category: "session_expired",
      userMessage:
        "Your session has expired. Please sign in again to continue.",
      retryable: false,
    };
  }

  if (
    status === 429 ||
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("over_email_send_rate_limit") ||
    lower.includes("for security purposes, you can only request this")
  ) {
    return {
      category: "rate_limited",
      userMessage:
        "Too many authentication attempts in a short window. Please wait a minute and try again.",
      retryable: true,
    };
  }

  if (
    lower.includes("invalid api key") ||
    lower.includes("apikey") ||
    lower.includes("workspace connection unavailable") ||
    lower.includes("misconfigured")
  ) {
    return {
      category: "configuration_error",
      userMessage:
        "Authentication service configuration could not be verified. Tap Retry Connection and try again.",
      retryable: true,
    };
  }

  if (
    status === 0 ||
    lower.includes("network request failed") ||
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("unable to resolve host") ||
    lower.includes("timed out") ||
    lower.includes("timeout") ||
    lower.includes("aborted") ||
    lower.includes("ssl") ||
    lower.includes("tls") ||
    lower.includes("socket")
  ) {
    return {
      category: "network_unreachable",
      userMessage:
        "Unable to reach ASTERIAL authentication servers. Check your internet, DNS, or VPN connection and try again.",
      retryable: true,
    };
  }

  if (status && status >= 500) {
    return {
      category: "server_error",
      userMessage:
        "ASTERIAL authentication service is temporarily unavailable. Please retry in a moment.",
      retryable: true,
    };
  }

  if (
    lower.includes("username") ||
    lower.includes("password") ||
    lower.includes("valid email")
  ) {
    return {
      category: "validation_error",
      userMessage: rawMessage.slice(0, 180),
      retryable: false,
    };
  }

  return {
    category: "server_error",
    userMessage:
      "Could not complete authentication right now. Please try again.",
    retryable: true,
  };
}
