import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatBytes,
  formatDateDivider,
  formatLastSeen,
  formatMessageTimestamp,
  formatShortTime,
  getInitials,
  sanitizeStorageFileName,
} from "./format";
import { ASTERIAL_BRAND } from "../constants/brand";

describe("ASTERIAL format utilities & brand constants", () => {
  it("exposes official centralized brand & version metadata from version.json", () => {
    assert.equal(ASTERIAL_BRAND.name, "ASTERIAL");
    assert.equal(ASTERIAL_BRAND.version, "1.4.2");
    assert.equal(ASTERIAL_BRAND.semver, "1.4.2");
    assert.equal(ASTERIAL_BRAND.versionCode, 14200);
    assert.equal(ASTERIAL_BRAND.androidPackageId, "com.xhuracan.asterial");
    assert.equal(ASTERIAL_BRAND.developer, "Ritam Das");
    assert.equal(ASTERIAL_BRAND.attribution, "By X Huracan");
  });

  it("extracts initials cleanly from single and multi-word names", () => {
    assert.equal(getInitials("Ritam Das"), "RD");
    assert.equal(getInitials("asterial"), "AS");
    assert.equal(getInitials("   "), "AS");
  });

  it("formats byte sizes and sanitizes storage filenames accurately", () => {
    assert.equal(formatBytes(512), "512 B");
    assert.equal(formatBytes(2048), "2.0 KB");
    assert.equal(formatBytes(5 * 1024 * 1024), "5.0 MB");
    assert.equal(sanitizeStorageFileName("../../evil name!.png"), "evil_name_.png");
  });

  it("formats relative timestamps and last-seen indicators safely", () => {
    const nowIso = new Date().toISOString();
    assert.equal(formatDateDivider(nowIso), "Today");
    assert.equal(formatLastSeen(nowIso), "Last seen just now");
    assert.equal(formatLastSeen(null), "Offline");
    assert.ok(formatShortTime(nowIso).length > 0);
    assert.ok(formatMessageTimestamp(nowIso).length > 0);
  });
});
