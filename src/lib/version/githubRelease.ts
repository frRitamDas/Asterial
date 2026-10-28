import { ASTERIAL_BRAND } from "@/lib/constants/brand";
import { buildApkFilename } from "@/lib/version/semver";

export interface GitHubReleaseAssetSummary {
  name: string;
  browser_download_url: string;
  size: number;
  content_type?: string;
}

export interface GitHubReleaseApiPayload {
  tag_name: string;
  name?: string | null;
  html_url: string;
  body?: string | null;
  draft?: boolean;
  prerelease?: boolean;
  published_at?: string | null;
  assets?: GitHubReleaseAssetSummary[];
}

export interface ResolvedReleaseInfo {
  product: string;
  version: string;
  semver: string;
  versionCode: number;
  channel: string;
  developer: string;
  attribution: string;
  androidPackageId: string;
  productionUrl: string;
  githubRepo: string;
  githubReleasesUrl: string;
  expectedTag: string;
  apkFileName: string;
  apkDownloadUrl: string;
  tagReleasePublished: boolean;
  verifiedApkDownloadUrl: string | null;
  verifiedChecksumUrl: string | null;
  verifiedApkSizeBytes: number | null;
  verifiedReleaseHtmlUrl: string | null;
  verifiedPublishedAt: string | null;
  signingStatus: "production-keystore" | "debug-signed" | "pending-release";
  latestPublishedTag: string | null;
  latestPublishedUrl: string | null;
  latestPublishedApkUrl: string | null;
  releaseDate: string;
  releaseNotes: readonly string[];
}

/**
 * Ensures only a public Supabase anon/publishable key can ever be exposed by
 * /api/mobile-config. Rejects service_role JWTs and sb_secret_ keys.
 */
export function sanitizePublicAnonKey(rawKey: string | undefined | null): string {
  const trimmed = (rawKey || "").trim();
  if (!trimmed) return "";
  if (/^sb_secret_/i.test(trimmed)) return "";

  const parts = trimmed.split(".");
  if (parts.length === 3 && parts[1]) {
    try {
      const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const json = Buffer.from(normalized, "base64").toString("utf8");
      const payload = JSON.parse(json) as { role?: string };
      if (payload.role && payload.role !== "anon") {
        return "";
      }
    } catch {
      return "";
    }
  }
  return trimmed;
}

export function extractReleaseAssets(
  release: GitHubReleaseApiPayload | null
): {
  apkAsset: GitHubReleaseAssetSummary | null;
  checksumAsset: GitHubReleaseAssetSummary | null;
  signingStatus: "production-keystore" | "debug-signed";
} | null {
  if (!release || release.draft) return null;
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const apkAsset =
    assets.find((a) => a.name.toLowerCase().endsWith(".apk")) || null;
  const checksumAsset =
    assets.find((a) => a.name.toLowerCase().endsWith(".sha256")) || null;

  const bodyText = (release.body || "").toLowerCase();
  const signingStatus: "production-keystore" | "debug-signed" =
    bodyText.includes("production keystore") &&
    !bodyText.includes("debug-signed")
      ? "production-keystore"
      : "debug-signed";

  return { apkAsset, checksumAsset, signingStatus };
}

async function fetchGitHubJson(
  url: string
): Promise<GitHubReleaseApiPayload | null> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": `ASTERIAL/${ASTERIAL_BRAND.semver}`,
      },
      next: { revalidate: 120 },
    });
    if (!res.ok) return null;
    return (await res.json()) as GitHubReleaseApiPayload;
  } catch {
    return null;
  }
}

export async function resolveAsterialReleaseInfo(): Promise<ResolvedReleaseInfo> {
  const expectedTag = `v${ASTERIAL_BRAND.semver}`;
  const apkFileName = buildApkFilename(ASTERIAL_BRAND.semver, "release");
  const githubReleasesUrl = `https://github.com/${ASTERIAL_BRAND.githubRepo}/releases`;

  const [exactTagRelease, latestRelease] = await Promise.all([
    fetchGitHubJson(
      `https://api.github.com/repos/${ASTERIAL_BRAND.githubRepo}/releases/tags/${expectedTag}`
    ),
    fetchGitHubJson(
      `https://api.github.com/repos/${ASTERIAL_BRAND.githubRepo}/releases/latest`
    ),
  ]);

  const exactAssets = extractReleaseAssets(exactTagRelease);
  const latestAssets = extractReleaseAssets(latestRelease);

  const verifiedApkDownloadUrl =
    exactAssets?.apkAsset?.browser_download_url || null;
  const verifiedChecksumUrl =
    exactAssets?.checksumAsset?.browser_download_url || null;

  return {
    product: ASTERIAL_BRAND.name,
    version: ASTERIAL_BRAND.version,
    semver: ASTERIAL_BRAND.semver,
    versionCode: ASTERIAL_BRAND.versionCode,
    channel: ASTERIAL_BRAND.channel,
    developer: ASTERIAL_BRAND.developer,
    attribution: ASTERIAL_BRAND.attribution,
    androidPackageId: ASTERIAL_BRAND.androidPackageId,
    productionUrl: ASTERIAL_BRAND.productionUrl,
    githubRepo: ASTERIAL_BRAND.githubRepo,
    githubReleasesUrl,
    expectedTag,
    apkFileName: exactAssets?.apkAsset?.name || apkFileName,
    apkDownloadUrl: verifiedApkDownloadUrl || githubReleasesUrl,
    tagReleasePublished: Boolean(exactTagRelease && !exactTagRelease.draft),
    verifiedApkDownloadUrl,
    verifiedChecksumUrl,
    verifiedApkSizeBytes: exactAssets?.apkAsset?.size ?? null,
    verifiedReleaseHtmlUrl:
      exactTagRelease && !exactTagRelease.draft
        ? exactTagRelease.html_url
        : null,
    verifiedPublishedAt: exactTagRelease?.published_at ?? null,
    signingStatus: exactAssets ? exactAssets.signingStatus : "pending-release",
    latestPublishedTag:
      latestRelease && !latestRelease.draft ? latestRelease.tag_name : null,
    latestPublishedUrl:
      latestRelease && !latestRelease.draft ? latestRelease.html_url : null,
    latestPublishedApkUrl:
      latestAssets?.apkAsset?.browser_download_url || null,
    releaseDate: ASTERIAL_BRAND.releaseDate,
    releaseNotes: ASTERIAL_BRAND.releaseNotes,
  };
}
