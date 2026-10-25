import { type StyleProp, View, type ViewProps, type ViewStyle } from 'react-native';

import { type Palette, radius, shadows, spacing, useColors } from '@/theme';

const toneSurface = {
  surface: 'surface',
  tint: 'surfaceTint',
  sky: 'surfaceSky',
  peach: 'peach',
} as const satisfies Record<string, keyof Palette>;

export type CardProps = ViewProps & {
  tone?: keyof typeof toneSurface;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Card({ tone = 'surface', padded = true, style, ...props }: CardProps) {
  const colors = useColors();
  return (
    <View
      style={[
        {
          backgroundColor: colors[toneSurface[tone]],
          borderRadius: radius.lg,
          borderCurve: 'continuous',
          // Only white cards need an edge against the tinted page; tinted cards read on their own.
          borderWidth: tone === 'surface' ? 1 : 0,
          borderColor: colors.border,
          boxShadow: tone === 'surface' ? shadows.card : undefined,
          padding: padded ? spacing.xl : 0,
          gap: spacing.md,
        },
        style,
      ]}
      {...props}
    />
  );
}
