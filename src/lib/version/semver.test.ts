import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildApkFilename,
  compareSemver,
  computeReleaseVersionCode,
  isUpdateAvailable,
  parseSemver,
} from "./semver";

describe("ASTERIAL release versioning & update comparison", () => {
  it("parses standard and v-prefixed semantic versions", () => {
    assert.deepEqual(parseSemver("1.2.0"), { major: 1, minor: 2, patch: 0 });
    assert.deepEqual(parseSemver("v1.2.3-rc1"), {
      major: 1,
      minor: 2,
      patch: 3,
    });
    assert.equal(parseSemver("invalid"), null);
  });

  it("compares semantic versions accurately", () => {
    assert.equal(compareSemver("1.2.0", "1.1.0"), 1);
    assert.equal(compareSemver("v1.2.0", "1.2.0"), 0);
    assert.equal(compareSemver("1.1.9", "1.2.0"), -1);
    assert.equal(compareSemver("2.0.0", "1.9.9"), 1);
  });

  it("detects updates across both semver and monotonic versionCode", () => {
    assert.equal(
      isUpdateAvailable({
        currentVersion: "1.1.0",
        latestVersion: "1.2.0",
      }),
      true
    );
    assert.equal(
      isUpdateAvailable({
        currentVersion: "1.2.0",
        currentVersionCode: 12001,
        latestVersion: "1.2.0",
        latestVersionCode: 12004,
      }),
      true
    );
    assert.equal(
      isUpdateAvailable({
        currentVersion: "1.2.0",
        currentVersionCode: 12004,
        latestVersion: "1.2.0",
        latestVersionCode: 12004,
      }),
      false
    );
  });

  it("generates monotonic Android version codes and identifiable APK filenames", () => {
    assert.equal(computeReleaseVersionCode(12000, null), 12000);
    assert.equal(computeReleaseVersionCode(12000, 7), 12007);
    assert.equal(buildApkFilename("1.2.0", "release"), "asterial-android-1.2.0.apk");
    assert.equal(
      buildApkFilename("v1.2.0", "debug"),
      "asterial-android-1.2.0-debug.apk"
    );
  });
});
