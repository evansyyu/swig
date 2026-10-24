import { View } from 'react-native';

import { GOAL_OPTIONS } from '@/constants/hydration';
import { radius, spacing, useColors } from '@/theme';
import { formatLiters } from '@/utils/format';

import { PressableScale } from './pressable-scale';
import { ThemedText } from './themed-text';

export type GoalPickerProps = { value: number; onChange: (ml: number) => void };

/** Android/web: the reference chip grid. */
export function GoalPicker({ value, onChange }: GoalPickerProps) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }} accessibilityRole="radiogroup">
      {GOAL_OPTIONS.map((ml) => {
        const selected = ml === value;
        return (
          <PressableScale
            key={ml}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${formatLiters(ml)} liters`}
            onPress={() => onChange(ml)}
            style={{
              width: '22%',
              flexGrow: 1,
              maxWidth: '23.5%',
              height: 52,
              borderRadius: radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? colors.accent : colors.surface,
              borderWidth: 1,
              borderColor: selected ? colors.accent : colors.border,
            }}
          >
            <ThemedText variant="callout" tone={selected ? 'onAccent' : 'primary'}>
              {formatLiters(ml)}
            </ThemedText>
          </PressableScale>
        );
      })}
    </View>
  );
}
