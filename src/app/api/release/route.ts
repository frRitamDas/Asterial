import { NextResponse } from "next/server";
import { ASTERIAL_BRAND } from "@/lib/constants/brand";
import { buildApkFilename } from "@/lib/version/semver";

export async function GET() {
  const commitSha =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_GIT_SHA ||
    null;

  return NextResponse.json(
    {
      product: ASTERIAL_BRAND.name,
      version: ASTERIAL_BRAND.semver,
      displayVersion: ASTERIAL_BRAND.version,
      versionCode: ASTERIAL_BRAND.versionCode,
      channel: ASTERIAL_BRAND.channel,
      commitSha,
      developer: ASTERIAL_BRAND.developer,
      attribution: ASTERIAL_BRAND.attribution,
      androidPackageId: ASTERIAL_BRAND.androidPackageId,
      productionUrl: ASTERIAL_BRAND.productionUrl,
      releaseDate: ASTERIAL_BRAND.releaseDate,
      releaseNotes: ASTERIAL_BRAND.releaseNotes,
      apkFilename: buildApkFilename(ASTERIAL_BRAND.semver, "release"),
      debugApkFilename: buildApkFilename(ASTERIAL_BRAND.semver, "debug"),
      releasesUrl: ASTERIAL_BRAND.githubReleasesUrl,
      latestReleaseDownloadUrl: `${ASTERIAL_BRAND.githubReleasesUrl}/latest/download/${buildApkFilename(ASTERIAL_BRAND.semver, "release")}`,
      actionsUrl: `${ASTERIAL_BRAND.githubActionsUrl}/workflows/android-release.yml`,
      updatedAt: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    }
  );
}
