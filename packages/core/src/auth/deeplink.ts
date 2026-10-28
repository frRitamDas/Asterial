export type SupportedOtpType =
  | "signup"
  | "invite"
  | "magiclink"
  | "recovery"
  | "email_change"
  | "email";

export type ParsedAuthDeepLink =
  | {
      recognized: false;
    }
  | {
      recognized: true;
      intent: "error";
      errorMessage: string;
    }
  | {
      recognized: true;
      intent: "pkce_code";
      code: string;
      isRecovery: boolean;
    }
  | {
      recognized: true;
      intent: "otp_token_hash";
      tokenHash: string;
      otpType: SupportedOtpType;
      isRecovery: boolean;
    }
  | {
      recognized: true;
      intent: "session_tokens";
      accessToken: string;
      refreshToken: string;
      isRecovery: boolean;
    };

const ALLOWED_OTP_TYPES = new Set<SupportedOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

function parseParamBlock(raw: string): Map<string, string> {
  const out = new Map<string, string>();
  const cleaned = raw.replace(/^[?#]/, "").trim();
  if (!cleaned) return out;
  for (const part of cleaned.split("&")) {
    if (!part) continue;
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = decodeURIComponent(part.slice(0, eq).replace(/\+/g, " "));
    const val = decodeURIComponent(part.slice(eq + 1).replace(/\+/g, " "));
    if (key) out.set(key, val);
  }
  return out;
}

/**
 * Safely parses incoming Android deep links (`asterial://auth/callback`,
 * `asterial://reset-password`, or `https://asterial.vercel.app/auth/callback`)
 * without logging tokens or accepting untrusted origins.
 */
export function parseAuthDeepLink(
  rawUrl: string | null | undefined
): ParsedAuthDeepLink {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { recognized: false };
  }

  const trimmed = rawUrl.trim();
  const isCustomScheme = /^asterial:\/\//i.test(trimmed);
  const isTrustedHttps =
    /^https:\/\/asterial\.vercel\.app\/(auth\/callback|reset-password)/i.test(
      trimmed
    );

  if (!isCustomScheme && !isTrustedHttps) {
    return { recognized: false };
  }

  const hashIdx = trimmed.indexOf("#");
  const withoutHash = hashIdx >= 0 ? trimmed.slice(0, hashIdx) : trimmed;
  const hashSegment = hashIdx >= 0 ? trimmed.slice(hashIdx + 1) : "";

  const queryIdx = withoutHash.indexOf("?");
  const pathPart = queryIdx >= 0 ? withoutHash.slice(0, queryIdx) : withoutHash;
  const querySegment = queryIdx >= 0 ? withoutHash.slice(queryIdx + 1) : "";

  if (
    isCustomScheme &&
    !/^asterial:\/\/(auth|reset-password)/i.test(pathPart)
  ) {
    return { recognized: false };
  }

  const queryParams = parseParamBlock(querySegment);
  const hashParams = parseParamBlock(hashSegment);

  const getParam = (key: string): string | undefined =>
    queryParams.get(key) ?? hashParams.get(key);

  const errorDesc = getParam("error_description") || getParam("error");
  if (errorDesc) {
    return {
      recognized: true,
      intent: "error",
      errorMessage: errorDesc.slice(0, 240),
    };
  }

  const rawType = (getParam("type") || "").toLowerCase();
  const nextPath = getParam("next") || "";
  const isRecovery =
    rawType === "recovery" ||
    /reset-password/i.test(pathPart) ||
    /mode=update/i.test(nextPath);

  const code = getParam("code");
  if (code && code.length >= 6) {
    return {
      recognized: true,
      intent: "pkce_code",
      code,
      isRecovery,
    };
  }

  const tokenHash = getParam("token_hash");
  if (
    tokenHash &&
    ALLOWED_OTP_TYPES.has(rawType as SupportedOtpType)
  ) {
    return {
      recognized: true,
      intent: "otp_token_hash",
      tokenHash,
      otpType: rawType as SupportedOtpType,
      isRecovery: rawType === "recovery" || isRecovery,
    };
  }

  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");
  if (accessToken && refreshToken) {
    return {
      recognized: true,
      intent: "session_tokens",
      accessToken,
      refreshToken,
      isRecovery,
    };
  }

  return { recognized: false };
}
