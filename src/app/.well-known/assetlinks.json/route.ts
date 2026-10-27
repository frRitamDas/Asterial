import { NextResponse } from "next/server";
import { ASTERIAL_BRAND } from "@/lib/constants/brand";

/**
 * Android Digital Asset Links endpoint (/.well-known/assetlinks.json)
 * Enables verified HTTPS Android App Links for com.xhuracan.asterial when
 * ANDROID_APP_SHA256_CERT_FINGERPRINTS is configured with the release keystore's SHA-256 fingerprint(s).
 */
export async function GET() {
  const rawFingerprints =
    process.env.ANDROID_APP_SHA256_CERT_FINGERPRINTS || "";
  const fingerprints = rawFingerprints
    .split(",")
    .map((fp) => fp.trim().toUpperCase())
    .filter((fp) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(fp));

  const statements =
    fingerprints.length > 0
      ? [
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: {
              namespace: "android_app",
              package_name: ASTERIAL_BRAND.androidPackageId,
              sha256_cert_fingerprints: fingerprints,
            },
          },
        ]
      : [];

  return NextResponse.json(statements, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
