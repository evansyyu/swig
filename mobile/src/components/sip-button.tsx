import { View } from 'react-native';

import { DEFAULT_SIP, SIP_AMOUNTS } from '@/constants/hydration';
import { radius, spacing, useColors } from '@/theme';

import { PressableScale } from './pressable-scale';
import { ThemedText } from './themed-text';

export type SipButtonProps = { onLog: (ml: number) => void };

/** Android/web: quick-add chips for a sip logged without the Balance. */
export function SipButton({ onLog }: SipButtonProps) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.sm }}>
      {SIP_AMOUNTS.map((ml) => (
        <PressableScale
          key={ml}
          accessibilityRole="button"
          accessibilityLabel={`Log ${ml} milliliters`}
          onPress={() => onLog(ml)}
          hitSlop={4}
          style={{
            paddingHorizontal: spacing.lg,
            minHeight: 40,
            justifyContent: 'center',
            borderRadius: radius.full,
            backgroundColor: ml === DEFAULT_SIP ? colors.surfaceTint : 'transparent',
            borderWidth: 1,
            borderColor: ml === DEFAULT_SIP ? colors.surfaceTint : colors.border,
          }}
        >
          <ThemedText variant="callout" tone="accent">
            + {ml} ml
          </ThemedText>
        </PressableScale>
      ))}
    </View>
  );
}
