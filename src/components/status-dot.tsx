import { View } from 'react-native';

import { radius, spacing, useColors } from '@/theme';

import { ThemedText } from './themed-text';

/** "● Balance connected" */
export function StatusDot({ label, on }: { label: string; on: boolean }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }} accessible accessibilityLabel={label}>
      <View
        style={{ width: 8, height: 8, borderRadius: radius.full, backgroundColor: on ? colors.accent : colors.textTertiary }}
      />
      <ThemedText variant="callout" tone={on ? 'accent' : 'tertiary'}>
        {label}
      </ThemedText>
    </View>
  );
}
