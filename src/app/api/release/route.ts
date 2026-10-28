import { NextResponse } from "next/server";
import { resolveAsterialReleaseInfo } from "@/lib/version/githubRelease";

export async function GET() {
  const payload = await resolveAsterialReleaseInfo();
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}
