import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getMobileRuntimeConfig } from '../config/env';
import { ASTERIAL_BRAND, THEME_PALETTES, RADII, SPACING } from '../theme/tokens';
import { loginSchema } from '@asterial/core';

describe('ASTERIAL React Native mobile foundation', () => {
  it('shares @asterial/core brand identity, theme tokens, and validation schemas', () => {
    assert.equal(ASTERIAL_BRAND.name, 'ASTERIAL');
    assert.equal(ASTERIAL_BRAND.androidPackageId, 'com.xhuracan.asterial');
    assert.equal(THEME_PALETTES.obsidian.bgVoid, '#050507');
    assert.ok(SPACING.lg > 0);
    assert.ok(RADII.xl > 0);

    const validLogin = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'password123',
    });
    assert.equal(validLogin.success, true);
  });

  it('exposes typed runtime configuration without leaking service role credentials', () => {
    const cfg = getMobileRuntimeConfig();
    assert.equal(typeof cfg.supabaseUrl, 'string');
    assert.equal(typeof cfg.supabaseAnonKey, 'string');
    assert.equal(typeof cfg.isSupabaseConfigured, 'boolean');
    assert.equal('serviceRoleKey' in cfg, false);
  });
});
