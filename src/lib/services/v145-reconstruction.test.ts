import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ACCENT_PRESETS,
  CHAT_WALLPAPER_OPTIONS,
  MAX_ATTACHMENT_BYTES,
  MAX_SOCIAL_MEDIA_BYTES,
  THEME_PALETTES,
  closeOrbitUpsertSchema,
  forwardMessageSchema,
  formatPresenceStatus,
  isUserOnline,
  momentCreateSchema,
  postBodySchema,
  postCommentSchema,
  resolveAppearanceTheme,
  validateUploadMetadataAndHeader,
} from "@asterial/core";
import { ServiceError, normalizeServiceError } from "./errors";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

function walkNonTestSourceFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name === "node_modules" ||
      entry.name === ".next" ||
      entry.name === "dist"
    ) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkNonTestSourceFiles(full));
    } else if (
      /\.(ts|tsx)$/.test(entry.name) &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".test.tsx")
    ) {
      results.push(full);
    }
  }
  return results;
}

describe("ASTERIAL v1.4.5 reconstruction architecture, security & service contracts", () => {
  it("resolves Obsidian, Light, and System appearance tokens plus selective accents & wallpapers", () => {
    assert.equal(resolveAppearanceTheme("obsidian", false), "obsidian");
    assert.equal(resolveAppearanceTheme("alabaster", false), "alabaster");
    assert.equal(resolveAppearanceTheme("system", false), "obsidian");
    assert.equal(resolveAppearanceTheme("system", true), "alabaster");

    assert.equal(THEME_PALETTES.obsidian.bgCanvas, "#090A0D");
    assert.equal(THEME_PALETTES.obsidian.bgSurface, "#101217");
    assert.equal(THEME_PALETTES.obsidian.bgElevated, "#171A21");
    assert.ok(Object.keys(ACCENT_PRESETS).includes("indigo"));
    assert.ok(Object.keys(ACCENT_PRESETS).includes("cobalt"));
    assert.ok(
      CHAT_WALLPAPER_OPTIONS.some((opt) => opt.id === "constellation")
    );
  });

  it("validates Close Orbit, Orbit-scoped Moments/Feed, threaded comment replies, and message forwarding", () => {
    const validOrbit = closeOrbitUpsertSchema.safeParse({
      contactId: "11111111-1111-4111-8111-111111111111",
      tier: "inner",
      note: "Core collaborator",
    });
    assert.equal(validOrbit.success, true);

    const invalidOrbitTier = closeOrbitUpsertSchema.safeParse({
      contactId: "11111111-1111-4111-8111-111111111111",
      tier: "invalid",
    });
    assert.equal(invalidOrbitTier.success, false);

    const orbitMoment = momentCreateSchema.safeParse({
      caption: "Private shipping update",
      backgroundTone: "obsidian",
      audience: "orbit",
      durationHours: 24,
    });
    assert.equal(orbitMoment.success, true);

    const orbitPost = postBodySchema.safeParse({
      body: "Close Orbit milestone",
      visibility: "orbit",
    });
    assert.equal(orbitPost.success, true);

    const replyComment = postCommentSchema.safeParse({
      body: "Threaded reply to parent comment",
      parentCommentId: "22222222-2222-4222-8222-222222222222",
    });
    assert.equal(replyComment.success, true);

    const validForward = forwardMessageSchema.safeParse({
      sourceMessageId: "33333333-3333-4333-8333-333333333333",
      targetConversationIds: [
        "44444444-4444-4444-8444-444444444444",
        "55555555-5555-4555-8555-555555555555",
      ],
    });
    assert.equal(validForward.success, true);

    const emptyForward = forwardMessageSchema.safeParse({
      sourceMessageId: "33333333-3333-4333-8333-333333333333",
      targetConversationIds: [],
    });
    assert.equal(emptyForward.success, false);
  });

  it("validates 25 MB video, audio/voice-note, and image magic bytes while blocking spoofed executables", () => {
    assert.equal(MAX_ATTACHMENT_BYTES, 26_214_400);
    assert.equal(MAX_SOCIAL_MEDIA_BYTES, 26_214_400);

    // Valid MP4 header: [00 00 00 18 66 74 79 70 69 73 6f 6d] ("....ftypisom")
    const mp4Header = new Uint8Array([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
      0x00, 0x00, 0x02, 0x00,
    ]);
    const validMp4 = validateUploadMetadataAndHeader({
      fileName: "demo.mp4",
      declaredMime: "video/mp4",
      byteSize: 12 * 1024 * 1024,
      headerBytes: mp4Header,
      kind: "social-media",
    });
    assert.equal(validMp4.ok, true);

    // Valid WebM voice note / video EBML header: [1A 45 DF A3 ...]
    const webmHeader = new Uint8Array([
      0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81,
      0x01, 0x42, 0xf2, 0x81,
    ]);
    const validWebm = validateUploadMetadataAndHeader({
      fileName: "voice-note.webm",
      declaredMime: "audio/webm",
      byteSize: 240_000,
      headerBytes: webmHeader,
      kind: "attachment",
    });
    assert.equal(validWebm.ok, true);

    // Reject disguised Windows PE executable ("MZ...") claiming to be video/mp4
    const exeDisguised = new Uint8Array([
      0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00,
      0xff, 0xff, 0x00, 0x00,
    ]);
    const spoofRes = validateUploadMetadataAndHeader({
      fileName: "clip.mp4",
      declaredMime: "video/mp4",
      byteSize: 1024,
      headerBytes: exeDisguised,
      kind: "social-media",
    });
    assert.equal(spoofRes.ok, false);

    // Reject >25 MB payload
    const oversizeRes = validateUploadMetadataAndHeader({
      fileName: "huge.mp4",
      declaredMime: "video/mp4",
      byteSize: 27 * 1024 * 1024,
      headerBytes: mp4Header,
      kind: "attachment",
    });
    assert.equal(oversizeRes.ok, false);
    if (!oversizeRes.ok) {
      assert.match(oversizeRes.error, /25 MB/i);
    }
  });

  it("normalizes service errors honestly without suppressing network or RLS failures", () => {
    const netErr = normalizeServiceError(
      new TypeError("Network request failed")
    );
    assert.ok(netErr instanceof ServiceError);
    assert.equal(netErr.code, "network_error");
    assert.equal(netErr.retryable, true);
    assert.match(netErr.message, /network/i);

    const rlsErr = normalizeServiceError({
      code: "42501",
      message: "Only group owners or admins can pin messages.",
    });
    assert.ok(rlsErr instanceof ServiceError);
    assert.equal(rlsErr.retryable, false);
    assert.match(rlsErr.message, /pin messages/i);
  });

  it("computes privacy-aware online and last-seen indicators accurately", () => {
    const recentIso = new Date(Date.now() - 15_000).toISOString();
    const staleIso = new Date(Date.now() - 3600_000).toISOString();
    assert.equal(isUserOnline(recentIso, false), true);
    assert.equal(isUserOnline(staleIso, false), false);
    assert.equal(isUserOnline(null, true), true);
    assert.equal(formatPresenceStatus(null, false), "Offline");
    assert.equal(formatPresenceStatus(recentIso, false), "Online");
  });

  it("enforces SQL RLS invariants in v1.4.5 migration and zero secret-key leaks in client code", () => {
    const migPath = path.join(
      repoRoot,
      "supabase/migrations/20261029045914_v1_4_5_reconstruction_close_orbits_pins_media_and_search.sql"
    );
    const sql = fs.readFileSync(migPath, "utf8");

    assert.match(
      sql,
      /ALTER TABLE public\.close_orbits ENABLE ROW LEVEL SECURITY/i
    );
    assert.match(sql, /owner_id = auth\.uid\(\)/i);
    assert.match(sql, /asterial\.trusted_rpc/i);
    assert.match(sql, /CREATE OR REPLACE FUNCTION public\.toggle_message_pin/i);
    assert.match(
      sql,
      /CREATE OR REPLACE FUNCTION public\.forward_message_to_conversations/i
    );
    assert.match(sql, /CREATE OR REPLACE FUNCTION public\.search_moments/i);

    const clientDirs = [
      path.join(repoRoot, "src/components"),
      path.join(repoRoot, "src/app/app"),
      path.join(repoRoot, "src/lib/services"),
      path.join(repoRoot, "mobile/src"),
    ];
    for (const dir of clientDirs) {
      for (const file of walkNonTestSourceFiles(dir)) {
        const content = fs.readFileSync(file, "utf8");
        assert.equal(
          content.includes("SUPABASE_SERVICE_ROLE_KEY"),
          false,
          `Client file must not reference SUPABASE_SERVICE_ROLE_KEY: ${file}`
        );
      }
    }
  });
});
