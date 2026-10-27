import { NextResponse } from "next/server";
import { ASTERIAL_BRAND } from "@/lib/constants/brand";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      product: ASTERIAL_BRAND.name,
      version: ASTERIAL_BRAND.version,
      semver: ASTERIAL_BRAND.semver,
      versionCode: ASTERIAL_BRAND.versionCode,
      androidPackageId: ASTERIAL_BRAND.androidPackageId,
      commitSha:
        process.env.VERCEL_GIT_COMMIT_SHA ||
        process.env.NEXT_PUBLIC_GIT_SHA ||
        null,
      developer: ASTERIAL_BRAND.developer,
      attribution: ASTERIAL_BRAND.attribution,
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
