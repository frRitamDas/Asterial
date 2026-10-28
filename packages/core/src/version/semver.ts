export interface ParsedSemver {
  major: number;
  minor: number;
  patch: number;
}

export function parseSemver(raw: string): ParsedSemver | null {
  const cleaned = raw.trim().replace(/^v/i, "").split("-")[0] || "";
  const parts = cleaned.split(".");
  if (parts.length < 2 || parts.length > 3) return null;

  const major = Number(parts[0]);
  const minor = Number(parts[1]);
  const patch = parts.length === 3 ? Number(parts[2]) : 0;

  if (
    !Number.isInteger(major) ||
    !Number.isInteger(minor) ||
    !Number.isInteger(patch) ||
    major < 0 ||
    minor < 0 ||
    patch < 0
  ) {
    return null;
  }

  return { major, minor, patch };
}

export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return 0;

  if (pa.major !== pb.major) return pa.major > pb.major ? 1 : -1;
  if (pa.minor !== pb.minor) return pa.minor > pb.minor ? 1 : -1;
  if (pa.patch !== pb.patch) return pa.patch > pb.patch ? 1 : -1;
  return 0;
}

export function isUpdateAvailable(params: {
  currentVersion: string;
  currentVersionCode?: number;
  latestVersion: string;
  latestVersionCode?: number;
}): boolean {
  const semverCmp = compareSemver(params.latestVersion, params.currentVersion);
  if (semverCmp > 0) return true;
  if (semverCmp < 0) return false;

  if (
    typeof params.latestVersionCode === "number" &&
    typeof params.currentVersionCode === "number" &&
    params.latestVersionCode > params.currentVersionCode
  ) {
    return true;
  }
  return false;
}

export function computeReleaseVersionCode(
  baseVersionCode: number,
  ciRunNumber?: number | null
): number {
  const safeBase = Math.max(1, Math.trunc(baseVersionCode));
  if (
    typeof ciRunNumber === "number" &&
    Number.isFinite(ciRunNumber) &&
    ciRunNumber > 0
  ) {
    return safeBase + Math.trunc(ciRunNumber);
  }
  return safeBase;
}

export function buildApkFilename(
  version: string,
  buildType: "release" | "debug" = "release"
): string {
  const safeVer = version
    .trim()
    .replace(/^v/i, "")
    .replace(/[^0-9A-Za-z._-]/g, "");
  return buildType === "release"
    ? `asterial-android-${safeVer}.apk`
    : `asterial-android-${safeVer}-debug.apk`;
}
