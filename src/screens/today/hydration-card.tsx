import { View } from 'react-native';

import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { ProgressRing } from '@/components/progress-ring';
import { SipButton } from '@/components/sip-button';
import { ThemedText } from '@/components/themed-text';
import { logSip } from '@/data/actions';
import { useAppState } from '@/data/store';
import { spacing, useColors } from '@/theme';
import { formatMl } from '@/utils/format';

export function HydrationCard() {
  const colors = useColors();
  const total = useAppState((s) => s.status?.total_ml ?? 0);
  const goal = useAppState((s) => s.status?.goal_ml ?? s.profile?.goal_ml ?? 2000);
  const streak = useAppState((s) => s.status?.streak ?? 0);
  const progress = goal ? total / goal : 0;
  const remaining = Math.max(0, goal - total);

  return (
    <Card style={{ alignItems: 'center', gap: spacing.lg }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch' }}>
        <ThemedText variant="headline">Today&apos;s hydration</ThemedText>
        <ThemedText variant="subhead" tone="secondary">
          {streak}-day streak
        </ThemedText>
      </View>

      <ProgressRing progress={progress}>
        <View style={{ alignItems: 'center', gap: spacing.xxs }} accessible accessibilityLabel={`${formatMl(total)} of ${formatMl(goal)} milliliters`}>
          <Icon ios="drop" android="water_drop" size={22} color={colors.accent} />
          <ThemedText variant="display" selectable>
            {formatMl(total)}
          </ThemedText>
          <ThemedText variant="subhead" tone="secondary">
            of {formatMl(goal)} ml
          </ThemedText>
          <ThemedText variant="subhead" tone="secondary" style={{ fontVariant: ['tabular-nums'] }}>
            {Math.round(progress * 100)}%
          </ThemedText>
        </View>
      </ProgressRing>

      <ThemedText variant="title2" style={{ fontWeight: '600' }}>
        {remaining > 0 ? `${formatMl(remaining)} ml to go` : 'Goal reached. Nicely done.'}
      </ThemedText>
      <SipButton onLog={logSip} />
    </Card>
  );
}
