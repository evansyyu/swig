import { View } from 'react-native';

import { radius, spacing, useColors } from '@/theme';

/** Segmented progress bar under the onboarding header ("1 of 2"). */
export function StepProgress({ step, total }: { step: number; total: number }) {
  const colors = useColors();
  return (
    <View
      style={{ flexDirection: 'row', gap: spacing.sm }}
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
