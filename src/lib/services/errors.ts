export class ServiceError extends Error {
  public readonly code: string;
  public readonly retryable: boolean;

  constructor(message: string, code = "service_error", retryable = false) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    this.retryable = retryable;
  }
}

export function normalizeServiceError(
  err: unknown,
  fallbackMessage = "Unable to complete request right now."
): ServiceError {
  if (err instanceof ServiceError) return err;

  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "object" && err !== null && "message" in err
        ? String((err as { message?: unknown }).message ?? "")
        : typeof err === "string"
          ? err
          : "";

  const lower = raw.toLowerCase();

  if (
    lower.includes("network request failed") ||
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("load failed") ||
    lower.includes("timed out")
  ) {
    return new ServiceError(
      "Network connection interrupted. Check your internet connection and try again.",
      "network_error",
      true
    );
  }

  if (
    lower.includes("jwt expired") ||
    lower.includes("invalid refresh token") ||
    lower.includes("authentication required")
  ) {
    return new ServiceError(
      "Your session has expired. Please sign in again.",
      "session_expired",
      false
    );
  }

  if (lower.includes("rate limit") || lower.includes("too many")) {
    return new ServiceError(
      "Too many actions in a short window. Please wait a moment and retry.",
      "rate_limited",
      true
    );
  }

  if (
    lower.includes("permission denied") ||
    lower.includes("row-level security") ||
    lower.includes("access denied")
  ) {
    return new ServiceError(
      raw || "You do not have permission to perform this action.",
      "forbidden",
      false
    );
  }

  return new ServiceError(raw.trim() || fallbackMessage, "service_error", false);
}
