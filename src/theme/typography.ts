import { Platform, type TextStyle } from 'react-native';

/**
 * iOS uses SF Pro (system) and SF Pro Rounded for big numerals, per Apple's HIG.
 * Android uses Manrope (embedded by the expo-font plugin with real weights), matching the reference.
 */
const family = Platform.select({ android: 'Manrope', default: undefined });
const numeric = Platform.select({ ios: 'ui-rounded', android: 'Manrope', default: undefined });

export const type = {
  display: { fontFamily: numeric, fontSize: 56, fontWeight: '800', letterSpacing: -1.5, fontVariant: ['tabular-nums'] },
  largeTitle: { fontFamily: family, fontSize: 34, fontWeight: '800', letterSpacing: -0.8, lineHeight: 40 },
  title: { fontFamily: family, fontSize: 28, fontWeight: '800', letterSpacing: -0.6, lineHeight: 34 },
  title2: { fontFamily: family, fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  stat: { fontFamily: numeric, fontSize: 30, fontWeight: '800', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  headline: { fontFamily: family, fontSize: 17, fontWeight: '600' },
  body: { fontFamily: family, fontSize: 17, fontWeight: '400', lineHeight: 24 },
  callout: { fontFamily: family, fontSize: 16, fontWeight: '500' },
  subhead: { fontFamily: family, fontSize: 15, fontWeight: '400', lineHeight: 21 },
  footnote: { fontFamily: family, fontSize: 13, fontWeight: '400', lineHeight: 18 },
  eyebrow: { fontFamily: family, fontSize: 13, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
  caption: { fontFamily: family, fontSize: 12, fontWeight: '500' },
  number: { fontFamily: numeric, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
} as const satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;
