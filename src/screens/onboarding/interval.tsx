import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { IntervalPicker } from '@/components/interval-picker';
import { PrimaryButton } from '@/components/primary-button';
import { StepLayout } from '@/components/screen-scroll';
import { StepProgress } from '@/components/step-progress';
import { ThemedText } from '@/components/themed-text';
import { DEFAULT_INTERVAL, INTERVAL_OPTIONS } from '@/constants/hydration';
import { updateSettings } from '@/data/actions';
import { getState, useAppState } from '@/data/store';
import { isAppBlockingSupported } from '@/lib/app-blocker';
import { radius, spacing, useColors } from '@/theme';
import { formatInterval, formatLiters } from '@/utils/format';

export function IntervalStep() {
  const colors = useColors();
  const goal = useAppState((s) => s.profile?.goal_ml ?? 2000);
  const [interval, setInterval] = useState(() => {
    const current = getState().profile?.interval_min ?? DEFAULT_INTERVAL;
    return (INTERVAL_OPTIONS as readonly number[]).includes(current) ? current : DEFAULT_INTERVAL;
  });

  return (
    <StepLayout
      footer={
        <PrimaryButton
          title={isAppBlockingSupported ? 'Continue' : 'Finish & set up Balance'}
          onPress={() => {
            updateSettings({ interval_min: interval });
            router.push(isAppBlockingSupported ? '/apps' : '/bottle');
          }}
        />
      }
    >
      <StepProgress step={2} total={2} />
      <View style={{ gap: spacing.sm }}>
        <ThemedText variant="largeTitle" accessibilityRole="header">
          A gentle nudge, at your pace.
        </ThemedText>
        <ThemedText variant="body" tone="secondary">
          Your speaker reminds you to pause for a sip when it&apos;s been a while.
        </ThemedText>
      </View>

      <Card tone="sky" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.lg }}>
        <View
          style={{
            width: 64,
            height: 44,
            borderRadius: radius.full,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon ios="mic" android="mic" size={20} color={colors.accent} />
        </View>
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <ThemedText variant="eyebrow" tone="accent" style={{ fontSize: 11 }}>
            A little encouragement
          </ThemedText>
          <ThemedText variant="callout">“Ready for a refreshing little break?”</ThemedText>
        </View>
      </Card>

      <View style={{ gap: spacing.md }}>
        <ThemedText variant="headline">Remind me every</ThemedText>
        <IntervalPicker value={interval} onChange={setInterval} />
      </View>

      <ThemedText variant="subhead" tone="secondary" style={{ textAlign: 'center' }}>
        Your rhythm: {formatLiters(goal)} L daily · {formatInterval(interval).toLowerCase()}.{'\n'}Next, we&apos;ll connect
        your bottle.
      </ThemedText>
    </StepLayout>
  );
}
