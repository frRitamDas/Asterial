import { NextResponse } from "next/server";
import {
  isValidPublicSupabaseAnonKey,
  isValidPublicSupabaseUrl,
} from "@asterial/core";
import { ASTERIAL_BRAND } from "@/lib/constants/brand";
import { sanitizePublicAnonKey } from "@/lib/version/githubRelease";

/**
 * Public read-only bootstrap endpoint for standalone ASTERIAL React Native Android builds.
 * Emits ONLY verified public NEXT_PUBLIC_SUPABASE_URL and role=anon NEXT_PUBLIC_SUPABASE_ANON_KEY.
 * Rejects placeholder hosts, localhost, and server secrets.
 */
export async function GET() {
  const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const safeAnonKey = sanitizePublicAnonKey(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const validConfig =
    isValidPublicSupabaseUrl(rawUrl) &&
    isValidPublicSupabaseAnonKey(safeAnonKey);

  return NextResponse.json(
    {
      product: ASTERIAL_BRAND.name,
      version: ASTERIAL_BRAND.version,
      semver: ASTERIAL_BRAND.semver,
      versionCode: ASTERIAL_BRAND.versionCode,
      androidPackageId: ASTERIAL_BRAND.androidPackageId,
      productionUrl: ASTERIAL_BRAND.productionUrl,
      supabaseUrl: validConfig ? rawUrl : "",
      supabaseAnonKey: validConfig ? safeAnonKey : "",
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
      },
    }
  );
}
