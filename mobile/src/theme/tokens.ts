import {
  ASTERIAL_BRAND,
  THEME_PALETTES,
  type AppearanceTheme,
  type ThemePalette,
} from '@asterial/core';

export { ASTERIAL_BRAND, THEME_PALETTES };
export type { AppearanceTheme, ThemePalette };

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const RADII = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;
