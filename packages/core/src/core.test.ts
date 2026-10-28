import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ASTERIAL_BRAND,
  THEME_PALETTES,
  compareSemver,
  detectBinaryMimeSignature,
  postBodySchema,
  validateUploadMetadataAndHeader,
} from "./index";

describe("@asterial/core shared cross-platform domain package", () => {
  it("exposes shared brand metadata and all four appearance theme palettes", () => {
    assert.equal(ASTERIAL_BRAND.name, "ASTERIAL");
    assert.equal(ASTERIAL_BRAND.developer, "Ritam Das");
    assert.equal(ASTERIAL_BRAND.attribution, "By X Huracan");
    assert.equal(ASTERIAL_BRAND.androidPackageId, "com.xhuracan.asterial");

    assert.equal(THEME_PALETTES.obsidian.isDark, true);
    assert.equal(THEME_PALETTES.pitch.bgVoid, "#000000");
    assert.equal(THEME_PALETTES.graphite.isDark, true);
    assert.equal(THEME_PALETTES.alabaster.isDark, false);
  });

  it("validates upload headers across Web & React Native without DOM File dependency", () => {
    const pngBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    assert.equal(detectBinaryMimeSignature(pngBytes), "image/png");

    const okResult = validateUploadMetadataAndHeader({
      fileName: "avatar.png",
      byteSize: 2048,
      declaredMime: "image/png",
      headerBytes: pngBytes,
      kind: "avatar",
    });
    assert.equal(okResult.ok, true);

    const exeBytes = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);
    const badResult = validateUploadMetadataAndHeader({
      fileName: "disguised.png",
      byteSize: 2048,
      declaredMime: "image/png",
      headerBytes: exeBytes,
      kind: "attachment",
    });
    assert.equal(badResult.ok, false);
  });

  it("validates shared social post schemas and semver ordering", () => {
    const parsed = postBodySchema.safeParse({
      body: "Hello from ASTERIAL native Android",
      visibility: "followers",
    });
    assert.equal(parsed.success, true);
    assert.equal(compareSemver("1.3.0", "1.2.0"), 1);
  });
});
