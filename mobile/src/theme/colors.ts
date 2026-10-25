import { useColorScheme } from 'react-native';

/**
 * Brand palette from the reference swatch (navy, steel, lavender, sky, peach).
 * Plain hex strings so the same values work in RN styles, SVG, Reanimated and
 * SwiftUI/Compose props. Dark mode is derived from the navy end of the swatch.
 */
const light = {
  background: '#F3F7FC',
  surface: '#FFFFFF',
  surfaceSky: '#D1E0EE', // hero art, "you" row, goal halo
  surfaceTint: '#DEE9F5', // info cards, selected tab, chips
  border: '#D7DFE8',
  separator: '#E4EAF1',
  text: '#1C263A',
  textSecondary: '#687286',
  textTertiary: '#949CA8',
  accent: '#536992', // primary buttons, ring, labels
  accentPressed: '#46597D',
  onAccent: '#FFFFFF',
  accentMuted: '#A9B4C8', // partial days, disabled accent
  navy: '#1E3156',
  peach: '#FBE2D2',
  onPeach: '#6B4636',
  peachStrong: '#F4B9A6',
  track: '#E3ECF6',
  danger: '#B4423A',
} as const;

export type Palette = { [K in keyof typeof light]: string };

const dark: Palette = {
  background: '#0F1A2E',
  surface: '#18253F',
  surfaceSky: '#24395E',
  surfaceTint: '#1F3152',
  border: '#2C3D5C',
  separator: '#24334F',
  text: '#EEF3FA',
  textSecondary: '#A5B5D2',
  textTertiary: '#7D8BA6',
  accent: '#7E9BC8',
  accentPressed: '#6A86B3',
  onAccent: '#0F1A2E',
  accentMuted: '#4A5F84',
  navy: '#1E3156',
  peach: '#3B2E35',
  onPeach: '#FDD6CD',
  peachStrong: '#F4B9A6',
  track: '#22324F',
  danger: '#F08A80',
};

export const palettes = { light, dark } as const;

export function useColors(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}
