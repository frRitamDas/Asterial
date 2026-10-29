import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ASTERIAL_BRAND, THEME_PALETTES } from "@asterial/core";
import {
  clearSignedUrlCache,
  getSignedUrlCacheCount,
} from "../supabase/storage";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

describe("ASTERIAL v1.6.0 Complete Product Redesign & Reconstruction suite", () => {
  it("synchronizes v1.6.0 metadata, developer attribution, and dark-first semantic palette", () => {
    assert.equal(ASTERIAL_BRAND.name, "ASTERIAL");
    assert.equal(ASTERIAL_BRAND.version, "1.6.0");
    assert.equal(ASTERIAL_BRAND.semver, "1.6.0");
    assert.equal(ASTERIAL_BRAND.versionCode, 16000);
    assert.equal(ASTERIAL_BRAND.developer, "Ritam Das");
    assert.equal(ASTERIAL_BRAND.attribution, "By X Huracan");
    assert.equal(ASTERIAL_BRAND.androidPackageId, "com.xhuracan.asterial");

    assert.equal(THEME_PALETTES.obsidian.bgCanvas, "#090A0D");
    assert.equal(THEME_PALETTES.obsidian.bgSurface, "#101217");
    assert.equal(THEME_PALETTES.obsidian.bgElevated, "#171A21");
    assert.equal(THEME_PALETTES.obsidian.accent, "#7778F6");
    assert.equal(THEME_PALETTES.obsidian.textPrimary, "#F5F6FA");
    assert.equal(THEME_PALETTES.obsidian.textSecondary, "#A0A5B3");
    assert.equal(THEME_PALETTES.obsidian.textMuted, "#747B8B");
    assert.equal(THEME_PALETTES.obsidian.borderSubtle, "#272B35");
    assert.equal(THEME_PALETTES.alabaster.isDark, false);
  });

  it("ships all required v1.6.0 onboarding, auth, messaging, community, and multi-page settings routes", () => {
    const expectedRoutes = [
      "src/app/welcome/page.tsx",
      "src/app/login/page.tsx",
      "src/app/signup/page.tsx",
      "src/app/forgot-password/page.tsx",
      "src/app/reset-password/page.tsx",
      "src/app/onboarding/page.tsx",
      "src/app/app/chats/page.tsx",
      "src/app/app/chats/[id]/page.tsx",
      "src/app/app/groups/page.tsx",
      "src/app/app/orbits/page.tsx",
      "src/app/app/moments/page.tsx",
      "src/app/app/feed/page.tsx",
      "src/app/app/people/page.tsx",
      "src/app/app/contacts/page.tsx",
      "src/app/app/settings/layout.tsx",
      "src/app/app/settings/page.tsx",
      "src/app/app/settings/profile/page.tsx",
      "src/app/app/settings/appearance/page.tsx",
      "src/app/app/settings/notifications/page.tsx",
      "src/app/app/settings/privacy/page.tsx",
      "src/app/app/settings/security/page.tsx",
      "src/app/app/settings/chat/page.tsx",
      "src/app/app/settings/storage/page.tsx",
      "src/app/app/settings/about/page.tsx",
    ];

    for (const relPath of expectedRoutes) {
      assert.equal(
        fs.existsSync(path.join(repoRoot, relPath)),
        true,
        `Expected v1.6.0 route file to exist: ${relPath}`
      );
    }
  });

  it("confines version badges to Settings -> About and keeps main workspace shell free of version clutter", () => {
    const shellSource = fs.readFileSync(
      path.join(repoRoot, "src/components/workspace/WorkspaceShell.tsx"),
      "utf8"
    );
    const sidebarSource = fs.readFileSync(
      path.join(repoRoot, "src/components/workspace/ConversationSidebar.tsx"),
      "utf8"
    );
    const aboutSource = fs.readFileSync(
      path.join(repoRoot, "src/app/app/settings/about/page.tsx"),
      "utf8"
    );

    assert.equal(shellSource.includes("showVersion"), false);
    assert.equal(sidebarSource.includes("showVersion"), false);
    assert.equal(aboutSource.includes("showVersion"), true);
  });

  it("enforces v1.6.0 additive SQL migration invariants for privacy, archive behavior, and storage summary", () => {
    const migPath = path.join(
      repoRoot,
      "supabase/migrations/20261029073441_v1_6_0_settings_privacy_archive_and_storage_summary.sql"
    );
    const sql = fs.readFileSync(migPath, "utf8");

    assert.match(sql, /moments_default_audience/i);
    assert.match(sql, /group_invite_permission/i);
    assert.match(sql, /discoverable_by_search/i);
    assert.match(sql, /enter_to_send/i);
    assert.match(sql, /show_link_previews/i);
    assert.match(sql, /media_auto_download/i);
    assert.match(sql, /keep_chats_archived/i);
    assert.match(
      sql,
      /CREATE OR REPLACE FUNCTION public\.can_add_user_to_group/i
    );
    assert.match(
      sql,
      /CREATE OR REPLACE FUNCTION public\.get_my_storage_summary/i
    );
    assert.equal(/DROP\s+TABLE/i.test(sql), false);
    assert.equal(/TRUNCATE\s+/i.test(sql), false);
  });

  it("exposes clearable local signed-URL cache helpers without mutating server storage", () => {
    assert.equal(typeof getSignedUrlCacheCount(), "number");
    const removed = clearSignedUrlCache();
    assert.equal(typeof removed, "number");
    assert.equal(getSignedUrlCacheCount(), 0);
  });
});
