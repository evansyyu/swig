export { palettes, useColors, type Palette } from './colors';
export { type, type TypeVariant } from './typography';

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Screen edge padding, used by every screen. */
export const gutter = 24;

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  full: 9999,
} as const;

export const shadows = {
  card: '0 1px 2px rgba(30, 49, 86, 0.04)',
  raised: '0 6px 16px rgba(30, 49, 86, 0.08)',
} as const;

export const motion = {
  fast: 150,
  base: 250,
  slow: 600,
  spring: { damping: 18, stiffness: 160, mass: 1 },
} as const;
