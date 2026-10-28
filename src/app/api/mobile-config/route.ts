import { NextResponse } from "next/server";
import { ASTERIAL_BRAND } from "@/lib/constants/brand";
import { sanitizePublicAnonKey } from "@/lib/version/githubRelease";

/**
 * Public read-only bootstrap endpoint for standalone ASTERIAL React Native Android builds.
 * Emits ONLY public NEXT_PUBLIC_SUPABASE_URL and role=anon NEXT_PUBLIC_SUPABASE_ANON_KEY.
 * Never reads or exposes SUPABASE_SERVICE_ROLE_KEY or server secrets.
 */
export async function GET() {
  const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const safeAnonKey = sanitizePublicAnonKey(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  return NextResponse.json(
    {
      product: ASTERIAL_BRAND.name,
      version: ASTERIAL_BRAND.version,
      semver: ASTERIAL_BRAND.semver,
      versionCode: ASTERIAL_BRAND.versionCode,
      androidPackageId: ASTERIAL_BRAND.androidPackageId,
      productionUrl: ASTERIAL_BRAND.productionUrl,
      supabaseUrl: /^https:\/\//i.test(rawUrl) ? rawUrl : "",
      supabaseAnonKey: safeAnonKey,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
      },
    }
  );
}
