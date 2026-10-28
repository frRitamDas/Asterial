import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getMobileRuntimeConfig } from "../config/env";
import { ASTERIAL_BRAND, THEME_PALETTES, RADII, SPACING } from "../theme/tokens";
import { loginSchema } from "@asterial/core";

describe("ASTERIAL React Native mobile foundation (v1.4.2)", () => {
  it("shares @asterial/core v1.4.2 monochrome tokens, brand identity, and validation schemas", () => {
    assert.equal(ASTERIAL_BRAND.name, "ASTERIAL");
    assert.equal(ASTERIAL_BRAND.version, "1.4.2");
    assert.equal(ASTERIAL_BRAND.androidPackageId, "com.xhuracan.asterial");
    assert.equal(THEME_PALETTES.obsidian.bgVoid, "#050506");
    assert.equal(THEME_PALETTES.pitch.bgVoid, "#000000");
    assert.equal(THEME_PALETTES.alabaster.isDark, false);
    assert.ok(SPACING.lg > 0);
    assert.ok(RADII.xl > 0);

    const validLogin = loginSchema.safeParse({
      email: "user@example.com",
      password: "password123",
    });
    assert.equal(validLogin.success, true);
  });

  it("exposes validated public Supabase configuration without placeholder hosts or service_role secrets", () => {
    const cfg = getMobileRuntimeConfig();
    assert.equal(typeof cfg.supabaseUrl, "string");
    assert.equal(typeof cfg.supabaseAnonKey, "string");
    assert.equal(typeof cfg.isSupabaseConfigured, "boolean");
    assert.equal(cfg.supabaseUrl.includes("placeholder.supabase.co"), false);
    assert.equal(cfg.supabaseAnonKey.includes("public-anon-placeholder"), false);
    assert.equal(cfg.supabaseAnonKey.startsWith("sb_secret_"), false);
    assert.equal("serviceRoleKey" in cfg, false);
  });
});
