import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ASTERIAL_BRAND,
  THEME_PALETTES,
  canActorRemoveGroupMember,
  canManageGroupSettings,
  classifyAuthError,
  compareSemver,
  computeOutgoingDeliveryState,
  detectBinaryMimeSignature,
  filterConversationSummaries,
  formatMomentTimeRemaining,
  formatRelativeTime,
  groupReactionsByEmoji,
  isValidPublicSupabaseConfig,
  isValidPublicSupabaseUrl,
  momentCreateSchema,
  orbitChannelCreateSchema,
  orbitCreateSchema,
  messageBodySchema,
  parseAuthDeepLink,
  postBodySchema,
  postCommentSchema,
  reportCreateSchema,
  sortConversationSummaries,
  validateReleaseTagParity,
  validateUploadMetadataAndHeader,
  type ConversationSummary,
} from "./index";

describe("@asterial/core shared cross-platform domain package (v1.4.0)", () => {
  it("exposes shared v1.4.0 brand metadata, honest security notice, and monochrome palettes", () => {
    assert.equal(ASTERIAL_BRAND.name, "ASTERIAL");
    assert.equal(ASTERIAL_BRAND.version, "1.4.0");
    assert.equal(ASTERIAL_BRAND.semver, "1.4.0");
    assert.equal(ASTERIAL_BRAND.versionCode, 14000);
    assert.equal(ASTERIAL_BRAND.developer, "Ritam Das");
    assert.equal(ASTERIAL_BRAND.attribution, "By X Huracan");
    assert.equal(ASTERIAL_BRAND.androidPackageId, "com.xhuracan.asterial");
    assert.equal(/end-to-end encrypted/i.test(ASTERIAL_BRAND.securityNotice), false);

    assert.equal(THEME_PALETTES.obsidian.isDark, true);
    assert.equal(THEME_PALETTES.obsidian.bgVoid, "#050506");
    assert.equal(THEME_PALETTES.pitch.bgVoid, "#000000");
    assert.equal(THEME_PALETTES.graphite.isDark, true);
    assert.equal(THEME_PALETTES.alabaster.isDark, false);
  });

  it("rejects placeholder, loopback, and secret Supabase configs while accepting valid public configs", () => {
    const anonPayload = Buffer.from(JSON.stringify({ role: "anon" })).toString(
      "base64url"
    );
    const servicePayload = Buffer.from(
      JSON.stringify({ role: "service_role" })
    ).toString("base64url");
    const validAnonJwt = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${anonPayload}.valid_signature_sample_123456`;
    const serviceJwt = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${servicePayload}.sig_123456`;

    // Regression guard for v1.3.0 Critical Bug #2 ("Network request failed")
    assert.equal(isValidPublicSupabaseUrl("https://placeholder.supabase.co"), false);
    assert.equal(isValidPublicSupabaseUrl("http://localhost:54321"), false);
    assert.equal(isValidPublicSupabaseUrl("http://10.0.2.2:54321"), false);
    assert.equal(
      isValidPublicSupabaseConfig(
        "https://placeholder.supabase.co",
        "public-anon-placeholder"
      ),
      false
    );
    assert.equal(
      isValidPublicSupabaseConfig(
        "https://abbhynyhqxgllzsjaljo.supabase.co",
        "sb_secret_1234567890123456789012345"
      ),
      false
    );
    assert.equal(
      isValidPublicSupabaseConfig(
        "https://abbhynyhqxgllzsjaljo.supabase.co",
        serviceJwt
      ),
      false
    );

    assert.equal(
      isValidPublicSupabaseConfig(
        "https://abbhynyhqxgllzsjaljo.supabase.co",
        validAnonJwt
      ),
      true
    );
    assert.equal(
      isValidPublicSupabaseConfig(
        "https://abbhynyhqxgllzsjaljo.supabase.co",
        "sb_publishable_f1AEhK7J3GTHUyBAnu7tSQ_i28M3jc5"
      ),
      true
    );
  });

  it("classifies authentication failures accurately across network, credentials, rate limits, and session expiry", () => {
    const netErr = classifyAuthError(new TypeError("Network request failed"));
    assert.equal(netErr.category, "network_unreachable");
    assert.equal(netErr.retryable, true);

    const badCreds = classifyAuthError({
      message: "Invalid login credentials",
      status: 400,
    });
    assert.equal(badCreds.category, "invalid_credentials");
    assert.equal(badCreds.retryable, false);

    const unconfirmed = classifyAuthError({
      message: "Email not confirmed",
      status: 400,
    });
    assert.equal(unconfirmed.category, "unverified_email");

    const rateLimit = classifyAuthError({
      message: "Email rate limit exceeded",
      status: 429,
    });
    assert.equal(rateLimit.category, "rate_limited");
    assert.equal(rateLimit.retryable, true);

    const conflict = classifyAuthError({
      message: "User already registered",
      status: 422,
    });
    assert.equal(conflict.category, "user_already_exists");

    const expired = classifyAuthError({
      message: "Invalid Refresh Token: Refresh Token Not Found",
      status: 400,
    });
    assert.equal(expired.category, "session_expired");
  });

  it("validates upload headers across Web, Chat, and Social Media without DOM File dependency", () => {
    const pngBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    assert.equal(detectBinaryMimeSignature(pngBytes), "image/png");

    const okAvatar = validateUploadMetadataAndHeader({
      fileName: "avatar.png",
      byteSize: 2048,
      declaredMime: "image/png",
      headerBytes: pngBytes,
      kind: "avatar",
    });
    assert.equal(okAvatar.ok, true);

    const okSocial = validateUploadMetadataAndHeader({
      fileName: "moment-photo.png",
      byteSize: 512_000,
      declaredMime: "image/png",
      headerBytes: pngBytes,
      kind: "social-image",
    });
    assert.equal(okSocial.ok, true);

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

  it("validates v1.4.0 Orbits, Moments, Social Feed, and extended Report schemas", () => {
    const validOrbit = orbitCreateSchema.safeParse({
      slug: "asterial-design",
      name: "Asterial Design Systems",
      description: "Monochrome spatial UI & typography.",
      visibility: "public",
    });
    assert.equal(validOrbit.success, true);

    assert.equal(
      orbitChannelCreateSchema.safeParse({
        name: "Design System Updates",
        topic: "Release notes",
      }).success,
      true
    );

    assert.equal(
      messageBodySchema.safeParse("Welcome to #general!").success,
      true
    );

    assert.equal(
      momentCreateSchema.safeParse({
        caption: "Shipping v1.4.0 monochrome architecture",
        backgroundTone: "obsidian",
        audience: "everyone",
        durationHours: 24,
      }).success,
      true
    );

    assert.equal(
      postBodySchema.safeParse({
        body: "Hello from ASTERIAL v1.4.0 Social Feed",
        visibility: "public",
      }).success,
      true
    );

    assert.equal(
      postCommentSchema.safeParse({ body: "Crisp monochrome hierarchy." })
        .success,
      true
    );

    assert.equal(
      reportCreateSchema.safeParse({
        category: "spam",
        details: "Automated bot spam",
      }).success,
      true
    );

    const futureIso = new Date(Date.now() + 2 * 3600 * 1000 + 60_000).toISOString();
    assert.match(formatMomentTimeRemaining(futureIso), /left$/);
    assert.equal(
      formatMomentTimeRemaining(new Date(Date.now() - 5000).toISOString()),
      "Expired"
    );
    assert.equal(formatRelativeTime(new Date().toISOString()), "just now");
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

  it("enforces mutual read-receipt privacy, group role hierarchy, and release tag parity", () => {
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
    assert.equal(filterConversationSummaries(sorted, "unread", "").length, 1);

    const grouped = groupReactionsByEmoji(
      [
        {
          message_id: "m1",
          conversation_id: "c1",
          user_id: "u1",
          emoji: "✦",
          created_at: "2026-10-28T03:00:00Z",
        },
      ],
      "u1"
    );
    assert.equal(grouped[0]?.count, 1);

    assert.equal(validateReleaseTagParity("refs/tags/v1.4.0", "1.4.0").ok, true);
    assert.equal(validateReleaseTagParity("v1.3.0", "1.4.0").ok, false);
    assert.equal(compareSemver("1.4.0", "1.3.0"), 1);
  });
});
