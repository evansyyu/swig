import { View } from 'react-native';

import { radius, spacing, useColors } from '@/theme';

/** Segmented progress bar in the onboarding header ("1 of 2"). */
export function StepProgress({ step, total, width }: { step: number; total: number; width?: number }) {
  const colors = useColors();
  return (
    <View
      style={{ flexDirection: 'row', gap: spacing.sm, width }}
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${step} of ${total}`}
    >
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 5,
            borderRadius: radius.full,
            backgroundColor: i < step ? colors.accent : colors.track,
          }}
        />
      ))}
    </View>
  );
}
