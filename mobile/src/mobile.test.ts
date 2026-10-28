import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ASTERIAL_BRAND,
  canActorRemoveGroupMember,
  computeOutgoingDeliveryState,
  loginSchema,
  parseAuthDeepLink,
  passwordUpdateSchema,
  signupSchema,
  validateUploadMetadataAndHeader,
} from "@asterial/core";
import { createClientUuid } from "./lib/uuid";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, "..");

describe("ASTERIAL v1.3.0 React Native mobile suite", () => {
  it("reports synchronized v1.3.0 brand & Android package metadata", () => {
    assert.equal(ASTERIAL_BRAND.name, "ASTERIAL");
    assert.equal(ASTERIAL_BRAND.version, "1.3.0");
    assert.equal(ASTERIAL_BRAND.semver, "1.3.0");
    assert.equal(ASTERIAL_BRAND.versionCode, 13000);
    assert.equal(ASTERIAL_BRAND.androidPackageId, "com.xhuracan.asterial");
    assert.equal(ASTERIAL_BRAND.developer, "Ritam Das");
    assert.equal(ASTERIAL_BRAND.attribution, "By X Huracan");
  });

  it("generates collision-free RFC-4122 v4 UUIDs for optimistic message client_id deduplication", () => {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    const seen = new Set<string>();
    for (let i = 0; i < 100; i += 1) {
      const id = createClientUuid();
      assert.match(id, uuidRegex);
      assert.equal(seen.has(id), false);
      seen.add(id);
    }
  });

  it("enforces zero WebView / Capacitor wrapper dependencies in mobile/", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(mobileRoot, "package.json"), "utf8")
    ) as {
      version: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    assert.equal(pkg.version, "1.3.0");

    const allDeps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };
    assert.equal("react-native-webview" in allDeps, false);
    assert.equal(
      Object.keys(allDeps).some((k) => k.startsWith("@capacitor/")),
      false
    );
  });

  it("validates native authentication schemas and deep-link callbacks", () => {
    assert.equal(
      loginSchema.safeParse({
        email: "ritam@example.com",
        password: "Password123",
      }).success,
      true
    );
    assert.equal(
      signupSchema.safeParse({
        email: "ritam@example.com",
        password: "Password123",
        displayName: "Ritam Das",
        username: "ritam_das",
      }).success,
      true
    );
    assert.equal(
      passwordUpdateSchema.safeParse({
        password: "StrongPass9",
        confirmPassword: "MismatchPass9",
      }).success,
      false
    );

    const recoveryLink = parseAuthDeepLink(
      "asterial://auth/callback?code=abc12345&type=recovery"
    );
    assert.equal(recoveryLink.recognized, true);
    if (recoveryLink.recognized && recoveryLink.intent === "pkce_code") {
      assert.equal(recoveryLink.isRecovery, true);
    }
  });

  it("validates binary attachment headers and blocks disguised executables or oversized uploads", () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e]);
    const validPdf = validateUploadMetadataAndHeader({
      fileName: "architecture.pdf",
      byteSize: 120_000,
      declaredMime: "application/pdf",
      headerBytes: pdfBytes,
      kind: "attachment",
    });
    assert.equal(validPdf.ok, true);

    const elfBytes = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x02]);
    const blockedElf = validateUploadMetadataAndHeader({
      fileName: "payload.pdf",
      byteSize: 4096,
      declaredMime: "application/pdf",
      headerBytes: elfBytes,
      kind: "attachment",
    });
    assert.equal(blockedElf.ok, false);

    const oversizedAvatar = validateUploadMetadataAndHeader({
      fileName: "huge.png",
      byteSize: 8 * 1024 * 1024,
      declaredMime: "image/png",
      headerBytes: new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]),
      kind: "avatar",
    });
    assert.equal(oversizedAvatar.ok, false);
  });

  it("enforces mutual read-receipt privacy and group moderation permissions", () => {
    assert.equal(
      computeOutgoingDeliveryState({
        receipts: [
          {
            message_id: "m1",
            user_id: "peer",
            conversation_id: "c1",
            delivered_at: "2026-10-28T04:00:00Z",
            read_at: "2026-10-28T04:01:00Z",
          },
        ],
        senderId: "me",
        viewerReadReceiptsEnabled: false,
      }),
      "delivered"
    );
    assert.equal(canActorRemoveGroupMember("owner", "admin", false), true);
    assert.equal(canActorRemoveGroupMember("admin", "owner", false), false);
  });
});
