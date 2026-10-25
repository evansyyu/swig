import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Card } from '@/components/card';
import { StatusDot } from '@/components/status-dot';
import { ThemedText } from '@/components/themed-text';
import { useAppState } from '@/data/store';
import { spacing } from '@/theme';
import { formatMl, formatTime } from '@/utils/format';

/** Balance connection, water left in the bottle, and when the speaker nudges next. */
export function BalanceCard() {
  const owner = useAppState((s) => s.profile?.scale_owner ?? false);
  const scale = useAppState((s) => s.status?.scale ?? null);
  const nextReminder = useAppState((s) => s.status?.next_reminder_at ?? null);
  const live = useAppState((s) => s.live);

  if (!owner) {
    return (
      <Link href="/reweigh" asChild>
        <Pressable accessibilityRole="button">
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ flex: 1, gap: spacing.xxs }}>
              <StatusDot on={false} label="No Balance connected" />
              <ThemedText variant="subhead" tone="secondary">
                Weigh your empty bottle to track sips automatically.
              </ThemedText>
            </View>
            <ThemedText variant="callout" tone="accent" style={{ fontWeight: '700' }}>
              Set up
            </ThemedText>
          </Card>
        </Pressable>
      </Link>
    );
  }

  const connected = !!scale?.connected;
  const bottle =
    scale?.water_ml == null
      ? 'Waiting for your bottle'
      : scale.needs_refill
        ? `Bottle almost empty · ${formatMl(scale.water_ml)} ml · refill soon`
        : `${formatMl(scale.water_ml)} ml in your bottle`;

  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <StatusDot on={connected} label={connected ? 'Balance connected' : 'Balance offline'} />
        <ThemedText variant="subhead" tone="secondary">
          {connected ? bottle : live ? 'Check it’s on and near your phone, with Bluetooth on' : 'Last known state'}
        </ThemedText>
      </View>
      {nextReminder && (
        <View style={{ alignItems: 'flex-end' }}>
          <ThemedText variant="footnote" tone="secondary">
            Next reminder
          </ThemedText>
          <ThemedText variant="title2">{formatTime(nextReminder)}</ThemedText>
        </View>
      )}
    </Card>
  );
}
