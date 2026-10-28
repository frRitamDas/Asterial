import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildApkFilename,
  compareSemver,
  computeReleaseVersionCode,
  isUpdateAvailable,
  parseSemver,
} from "./semver";
import {
  extractReleaseAssets,
  sanitizePublicAnonKey,
} from "./githubRelease";

describe("ASTERIAL v1.3.0 release versioning, security guards & update comparison", () => {
  it("parses standard and v-prefixed semantic versions", () => {
    assert.deepEqual(parseSemver("1.3.0"), { major: 1, minor: 3, patch: 0 });
    assert.deepEqual(parseSemver("v1.3.1-rc1"), {
      major: 1,
      minor: 3,
      patch: 1,
    });
    assert.equal(parseSemver("invalid"), null);
  });

  it("compares semantic versions accurately", () => {
    assert.equal(compareSemver("1.3.0", "1.2.0"), 1);
    assert.equal(compareSemver("v1.3.0", "1.3.0"), 0);
    assert.equal(compareSemver("1.2.9", "1.3.0"), -1);
    assert.equal(compareSemver("2.0.0", "1.9.9"), 1);
  });

  it("detects updates across both semver and monotonic versionCode", () => {
    assert.equal(
      isUpdateAvailable({
        currentVersion: "1.2.0",
        latestVersion: "1.3.0",
      }),
      true
    );
    assert.equal(
      isUpdateAvailable({
        currentVersion: "1.3.0",
        currentVersionCode: 13001,
        latestVersion: "1.3.0",
        latestVersionCode: 13004,
      }),
      true
    );
    assert.equal(
      isUpdateAvailable({
        currentVersion: "1.3.0",
        currentVersionCode: 13004,
        latestVersion: "1.3.0",
        latestVersionCode: 13004,
      }),
      false
    );
  });

  it("generates monotonic Android version codes and identifiable APK filenames", () => {
    assert.equal(computeReleaseVersionCode(13000, null), 13000);
    assert.equal(computeReleaseVersionCode(13000, 7), 13007);
    assert.equal(
      buildApkFilename("1.3.0", "release"),
      "asterial-android-1.3.0.apk"
    );
    assert.equal(
      buildApkFilename("v1.3.0", "debug"),
      "asterial-android-1.3.0-debug.apk"
    );
  });

  it("blocks service_role and sb_secret_ keys from ever passing sanitizePublicAnonKey", () => {
    const anonPayload = Buffer.from(JSON.stringify({ role: "anon" })).toString(
      "base64url"
    );
    const servicePayload = Buffer.from(
      JSON.stringify({ role: "service_role" })
    ).toString("base64url");

    const anonJwt = `eyJhbGciOiJIUzI1NiJ9.${anonPayload}.sig`;
    const serviceJwt = `eyJhbGciOiJIUzI1NiJ9.${servicePayload}.sig`;

    assert.equal(sanitizePublicAnonKey(anonJwt), anonJwt);
    assert.equal(sanitizePublicAnonKey(serviceJwt), "");
    assert.equal(sanitizePublicAnonKey("sb_secret_123456789"), "");
  });

  it("extracts verified APK & checksum assets and distinguishes debug vs production signing", () => {
    const debugRel = extractReleaseAssets({
      tag_name: "v1.3.0",
      html_url: "https://github.com/frRitamDas/Asterial/releases/tag/v1.3.0",
      body: "Signing status: Debug-signed installable APK (no production keystore secret configured)",
      assets: [
        {
          name: "asterial-android-1.3.0.apk",
          browser_download_url:
            "https://github.com/frRitamDas/Asterial/releases/download/v1.3.0/asterial-android-1.3.0.apk",
          size: 42_000_000,
        },
        {
          name: "asterial-android-1.3.0.apk.sha256",
          browser_download_url:
            "https://github.com/frRitamDas/Asterial/releases/download/v1.3.0/asterial-android-1.3.0.apk.sha256",
          size: 98,
        },
      ],
    });
    assert.ok(debugRel);
    assert.equal(debugRel.signingStatus, "debug-signed");
    assert.equal(debugRel.apkAsset?.name, "asterial-android-1.3.0.apk");
    assert.equal(
      debugRel.checksumAsset?.name,
      "asterial-android-1.3.0.apk.sha256"
    );
  });
});
