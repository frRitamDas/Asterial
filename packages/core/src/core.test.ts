import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ASTERIAL_BRAND,
  THEME_PALETTES,
  canActorRemoveGroupMember,
  canManageGroupSettings,
  compareSemver,
  computeOutgoingDeliveryState,
  detectBinaryMimeSignature,
  filterConversationSummaries,
  groupReactionsByEmoji,
  parseAuthDeepLink,
  postBodySchema,
  sortConversationSummaries,
  validateReleaseTagParity,
  validateUploadMetadataAndHeader,
  type ConversationSummary,
} from "./index";

describe("@asterial/core shared cross-platform domain package (v1.3.0)", () => {
  it("exposes shared v1.3.0 brand metadata and all four appearance theme palettes", () => {
    assert.equal(ASTERIAL_BRAND.name, "ASTERIAL");
    assert.equal(ASTERIAL_BRAND.version, "1.3.0");
    assert.equal(ASTERIAL_BRAND.semver, "1.3.0");
    assert.equal(ASTERIAL_BRAND.versionCode, 13000);
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

  it("parses trusted native Android auth & recovery deep links and rejects untrusted origins", () => {
    const pkce = parseAuthDeepLink(
      "asterial://auth/callback?code=pkce_code_12345&type=recovery"
    );
    assert.equal(pkce.recognized, true);
    if (pkce.recognized && pkce.intent === "pkce_code") {
      assert.equal(pkce.code, "pkce_code_12345");
      assert.equal(pkce.isRecovery, true);
    }

    const otp = parseAuthDeepLink(
      "https://asterial.vercel.app/auth/callback?token_hash=th_999&type=signup"
    );
    assert.equal(otp.recognized, true);
    if (otp.recognized && otp.intent === "otp_token_hash") {
      assert.equal(otp.tokenHash, "th_999");
      assert.equal(otp.otpType, "signup");
      assert.equal(otp.isRecovery, false);
    }

    const untrusted = parseAuthDeepLink(
      "https://evil.example.com/auth/callback?code=steal_me"
    );
    assert.equal(untrusted.recognized, false);
  });

  it("enforces mutual read-receipt privacy and group role hierarchy", () => {
    const receipts = [
      {
        message_id: "m1",
        user_id: "peer-1",
        conversation_id: "c1",
        delivered_at: "2026-10-28T04:00:00Z",
        read_at: "2026-10-28T04:01:00Z",
      },
    ];

    assert.equal(
      computeOutgoingDeliveryState({
        receipts,
        senderId: "me",
        viewerReadReceiptsEnabled: true,
      }),
      "read"
    );
    assert.equal(
      computeOutgoingDeliveryState({
        receipts,
        senderId: "me",
        viewerReadReceiptsEnabled: false,
      }),
      "delivered"
    );

    assert.equal(canManageGroupSettings("owner"), true);
    assert.equal(canManageGroupSettings("admin"), true);
    assert.equal(canManageGroupSettings("member"), false);
    assert.equal(canActorRemoveGroupMember("admin", "member", false), true);
    assert.equal(canActorRemoveGroupMember("admin", "admin", false), false);
    assert.equal(canActorRemoveGroupMember("admin", "owner", false), false);
    assert.equal(canActorRemoveGroupMember("owner", "admin", false), true);
  });

  it("sorts, filters, aggregates reactions, and validates release tag parity", () => {
    const makeItem = (
      id: string,
      opts: {
        type: "direct" | "group";
        pinned?: boolean;
        archived?: boolean;
        unread?: number;
        lastAt: string;
        title: string;
      }
    ): ConversationSummary => ({
      conversation: {
        id,
        type: opts.type,
        direct_pair_key: opts.type === "direct" ? "a:b" : null,
        name: opts.type === "group" ? opts.title : null,
        description: "",
        avatar_url: null,
        created_by: "u1",
        last_message_id: null,
        last_message_preview: "Preview text",
        last_message_at: opts.lastAt,
        created_at: opts.lastAt,
        updated_at: opts.lastAt,
      },
      membership: {
        conversation_id: id,
        user_id: "u1",
        role: "member",
        pinned: Boolean(opts.pinned),
        pinned_at: opts.pinned ? opts.lastAt : null,
        is_muted: false,
        archived: Boolean(opts.archived),
        archived_at: null,
        last_read_message_id: null,
        last_read_at: opts.lastAt,
        unread_count: opts.unread ?? 0,
        joined_at: opts.lastAt,
        left_at: null,
      },
      peerProfile: null,
      peerLastSeenAt: null,
      memberCount: 2,
      displayTitle: opts.title,
      displaySubtitle: "@peer",
      displayAvatarPath: null,
    });

    const sorted = sortConversationSummaries([
      makeItem("older-pinned", {
        type: "direct",
        pinned: true,
        lastAt: "2026-10-28T01:00:00Z",
        title: "Pinned Peer",
      }),
      makeItem("newer-unpinned", {
        type: "group",
        unread: 3,
        lastAt: "2026-10-28T03:00:00Z",
        title: "Core Team",
      }),
    ]);
    assert.equal(sorted[0]?.conversation.id, "older-pinned");

    const unreadOnly = filterConversationSummaries(sorted, "unread", "");
    assert.equal(unreadOnly.length, 1);
    assert.equal(unreadOnly[0]?.conversation.id, "newer-unpinned");

    const grouped = groupReactionsByEmoji(
      [
        {
          message_id: "m1",
          conversation_id: "c1",
          user_id: "u1",
          emoji: "✦",
          created_at: "2026-10-28T03:00:00Z",
        },
        {
          message_id: "m1",
          conversation_id: "c1",
          user_id: "u2",
          emoji: "✦",
          created_at: "2026-10-28T03:01:00Z",
        },
      ],
      "u1"
    );
    assert.equal(grouped[0]?.count, 2);
    assert.equal(grouped[0]?.reactedByMe, true);

    assert.equal(validateReleaseTagParity("refs/tags/v1.3.0", "1.3.0").ok, true);
    assert.equal(validateReleaseTagParity("v1.2.0", "1.3.0").ok, false);
    assert.equal(compareSemver("1.3.0", "1.2.0"), 1);

    const parsed = postBodySchema.safeParse({
      body: "Hello from ASTERIAL native Android",
      visibility: "followers",
    });
    assert.equal(parsed.success, true);
  });
});
