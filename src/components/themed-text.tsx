import { Text, type TextProps } from 'react-native';

import { type Palette, type, type TypeVariant, useColors } from '@/theme';

type Tone = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'onAccent' | 'onPeach' | 'danger';

const toneColor: Record<Tone, keyof Palette> = {
  primary: 'text',
  secondary: 'textSecondary',
  tertiary: 'textTertiary',
  accent: 'accent',
  onAccent: 'onAccent',
  onPeach: 'onPeach',
  danger: 'danger',
};

export type ThemedTextProps = TextProps & { variant?: TypeVariant; tone?: Tone };

export function ThemedText({ variant = 'body', tone = 'primary', style, ...props }: ThemedTextProps) {
  const colors = useColors();
  return <Text style={[type[variant], { color: colors[toneColor[tone]] }, style]} {...props} />;
}
