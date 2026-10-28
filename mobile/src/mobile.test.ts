import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ASTERIAL_BRAND,
  canActorRemoveGroupMember,
  classifyAuthError,
  computeOutgoingDeliveryState,
  isValidPublicSupabaseConfig,
  loginSchema,
  momentCreateSchema,
  orbitSchema,
  parseAuthDeepLink,
  passwordUpdateSchema,
  postBodySchema,
  signupSchema,
  validateUploadMetadataAndHeader,
} from "@asterial/core";
import { getMobileRuntimeConfig } from "./config/env";
import { createClientUuid } from "./lib/uuid";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(mobileRoot, "..");

describe("ASTERIAL v1.4.3 React Native mobile suite", () => {
  it("reports synchronized v1.4.3 brand & monotonic Android package metadata", () => {
    assert.equal(ASTERIAL_BRAND.name, "ASTERIAL");
    assert.equal(ASTERIAL_BRAND.version, "1.4.3");
    assert.equal(ASTERIAL_BRAND.semver, "1.4.3");
    assert.equal(ASTERIAL_BRAND.versionCode, 14300);
    assert.ok(ASTERIAL_BRAND.versionCode > 14000);
    assert.equal(ASTERIAL_BRAND.androidPackageId, "com.xhuracan.asterial");
    assert.equal(ASTERIAL_BRAND.developer, "Ritam Das");
    assert.equal(ASTERIAL_BRAND.attribution, "By X Huracan");
  });

  it("prevents placeholder CI env vars from overwriting valid runtimeEnv.generated.ts (Bug #2 regression guard)", () => {
    const generatedPath = path.join(
      mobileRoot,
      "src/config/runtimeEnv.generated.ts"
    );
    const beforeContent = fs.readFileSync(generatedPath, "utf8");

    // Simulate the exact v1.3.0 CI failure condition where placeholder env vars were passed
    execFileSync(
      process.execPath,
      [path.join(repoRoot, "scripts/prepare-mobile-env.mjs")],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.supabase.co",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-anon-placeholder",
        },
      }
    );

    const afterContent = fs.readFileSync(generatedPath, "utf8");
    assert.equal(afterContent.includes("placeholder.supabase.co"), false);
    assert.equal(afterContent.includes("public-anon-placeholder"), false);
    assert.equal(afterContent, beforeContent);

    const cfg = getMobileRuntimeConfig();
    if (cfg.isSupabaseConfigured) {
      assert.equal(
        isValidPublicSupabaseConfig(cfg.supabaseUrl, cfg.supabaseAnonKey),
        true
      );
    }
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

  it("enforces zero WebView / Capacitor wrapper dependencies in mobile/ and ships native Orbits, Moments & Feed screens", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(mobileRoot, "package.json"), "utf8")
    ) as {
      version: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    assert.equal(pkg.version, "1.4.3");

    const allDeps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };
    assert.equal("react-native-webview" in allDeps, false);
    assert.equal(
      Object.keys(allDeps).some((k) => k.startsWith("@capacitor/")),
      false
    );

    for (const screenFile of [
      "AuthScreen.tsx",
      "InboxScreen.tsx",
      "ConversationScreen.tsx",
      "OrbitsScreen.tsx",
      "OrbitRoomScreen.tsx",
      "MomentsScreen.tsx",
      "FeedScreen.tsx",
      "ContactsScreen.tsx",
      "ProfileScreen.tsx",
      "SettingsScreen.tsx",
      "PasswordRecoveryScreen.tsx",
    ]) {
      assert.equal(
        fs.existsSync(path.join(mobileRoot, "src/screens", screenFile)),
        true,
        `Missing native screen ${screenFile}`
      );
    }
  });

  it("validates native authentication, error diagnostics, Orbits, Moments, and Feed schemas", () => {
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

    assert.equal(
      classifyAuthError(new TypeError("Network request failed")).category,
      "network_unreachable"
    );

    assert.equal(
      orbitSchema.safeParse({
        slug: "asterial-core",
        name: "Asterial Core",
        description: "Engineering Orbit",
        visibility: "public",
      }).success,
      true
    );
    assert.equal(
      momentCreateSchema.safeParse({
        caption: "Android v1.4.0 live",
        backgroundTone: "graphite",
        audience: "everyone",
        durationHours: 12,
      }).success,
      true
    );
    assert.equal(
      postBodySchema.safeParse({
        body: "Monochrome overhaul shipped.",
        visibility: "public",
      }).success,
      true
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
