import { ActivityIndicator, Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing, useColors } from '@/theme';

import { Icon } from './icon';
import { ThemedText } from './themed-text';

export type PrimaryButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Trailing arrow, for buttons that move the flow forward. */
  arrow?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Android/web: the reference's filled pill, with Material ripple feedback. */
export function PrimaryButton({ title, onPress, disabled, loading, arrow = true, style }: PrimaryButtonProps) {
  const colors = useColors();
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      android_ripple={{ color: 'rgba(255,255,255,0.18)', foreground: true }}
      style={({ pressed }) => [
        {
          minHeight: 56,
          borderRadius: radius.full,
          overflow: 'hidden',
          backgroundColor: pressed ? colors.accentPressed : colors.accent,
          opacity: disabled ? 0.55 : 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.xl,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.onAccent} />
      ) : (
        <>
          <ThemedText variant="headline" tone="onAccent" style={{ fontSize: 18 }}>
            {title}
          </ThemedText>
          {arrow && <Icon ios="arrow.right" android="arrow_forward" size={20} color={colors.onAccent} />}
        </>
      )}
    </Pressable>
  );
}
