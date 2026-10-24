import { View } from 'react-native';

import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { useAppState } from '@/data/store';
import type { LastEvent } from '@/data/types';
import { spacing, useColors } from '@/theme';
import { formatMl } from '@/utils/format';

function message(event: LastEvent, remaining: number) {
  const toGo = remaining > 0 ? `${formatMl(remaining)} ml to go` : 'goal reached!';
  switch (event.type) {
    case 'baseline':
      return {
        eyebrow: 'Speaker · Good morning',
        quote: event.detail_ml != null ? `Starting the day with ${formatMl(event.detail_ml)} ml` : 'Starting point saved',
      };
    case 'refill':
      return {
        eyebrow: 'Speaker · Refill',
        quote: event.ml ? `Refilled, and that last ${formatMl(event.ml)} ml counts` : 'Bottle refilled. Keep it up',
      };
    default:
      return {
        eyebrow: `Speaker · Last sip ${formatMl(event.ml)} ml`,
        quote: `You drank ${formatMl(event.ml)} ml, ${toGo}`,
      };
  }
}

/** What the speaker said after the latest event (PRD F9). */
export function SpeakerCard() {
  const colors = useColors();
  const event = useAppState((s) => s.status?.last_event ?? null);
  const remaining = useAppState((s) => (s.status ? s.status.goal_ml - s.status.total_ml : 0));
  if (!event) return null;
  const { eyebrow, quote } = message(event, remaining);

  return (
    <Card tone="peach" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
      <Icon ios="bubble.left" android="chat_bubble" size={26} color={colors.onPeach} />
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <ThemedText variant="eyebrow" tone="onPeach" style={{ fontSize: 11, opacity: 0.8 }}>
          {eyebrow}
        </ThemedText>
        <ThemedText variant="headline" tone="onPeach">
          “{quote}”
        </ThemedText>
      </View>
    </Card>
  );
}
