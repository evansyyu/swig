import { View } from 'react-native';

import { INTERVAL_OPTIONS } from '@/constants/hydration';
import { radius, spacing, useColors } from '@/theme';
import { formatInterval } from '@/utils/format';

import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { ThemedText } from './themed-text';

export type IntervalPickerProps = { value: number; onChange: (minutes: number) => void };

/** Android/web: the reference radio rows. */
export function IntervalPicker({ value, onChange }: IntervalPickerProps) {
  const colors = useColors();
  return (
    <View style={{ gap: spacing.md }} accessibilityRole="radiogroup">
      {INTERVAL_OPTIONS.map((minutes) => {
        const selected = minutes === value;
        const fg = selected ? colors.onAccent : colors.text;
        return (
          <PressableScale
            key={minutes}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(minutes)}
            style={{
              minHeight: 60,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.lg,
              paddingHorizontal: spacing.xl,
              borderRadius: radius.full,
              backgroundColor: selected ? colors.accent : colors.surface,
              borderWidth: 1,
              borderColor: selected ? colors.accent : colors.border,
            }}
          >
            <ThemedText variant="body" style={{ flex: 1, color: fg }}>
              {formatInterval(minutes)}
            </ThemedText>
            <Icon
              ios={selected ? 'checkmark.circle' : 'circle'}
              android={selected ? 'check_circle' : 'radio_button_unchecked'}
              size={24}
              color={selected ? colors.onAccent : colors.border}
            />
          </PressableScale>
        );
      })}
    </View>
  );
}
