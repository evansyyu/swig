import { View } from 'react-native';

import { Card } from '@/components/card';
import { PressableScale } from '@/components/pressable-scale';
import { ScreenScroll } from '@/components/screen-scroll';
import { TextButton } from '@/components/text-button';
import { ThemedText } from '@/components/themed-text';
import { setClockOffset, shiftClock, useClockOffset } from '@/data/clock';
import { useAppState } from '@/data/store';
import { radius, spacing, useColors } from '@/theme';
import { formatTime, formatWeekdayDate } from '@/utils/format';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const JUMPS = [
  { label: '−1 day', ms: -DAY },
  { label: '−1 hour', ms: -HOUR },
  { label: '+1 hour', ms: HOUR },
  { label: '+1 day', ms: DAY },
] as const;

/** "+1 d 3 h", "−2 h", "None" */
export function formatOffset(ms: number) {
  if (!ms) return 'None';
  const hours = Math.round(Math.abs(ms) / HOUR);
  const days = Math.floor(hours / 24);
  const parts = [days && `${days} d`, hours % 24 && `${hours % 24} h`].filter(Boolean);
  return `${ms < 0 ? '−' : '+'}${parts.join(' ')}`;
}

/** Dev builds only (opened from Settings): tools for testing the app. */
export function DevPanel() {
  const colors = useColors();
  const offset = useClockOffset();
  const now = useAppState((s) => s.now);
  const appTime = new Date(now);

  return (
    <ScreenScroll>
      <View style={{ gap: spacing.sm }}>
        <ThemedText variant="eyebrow" tone="accent">
          Clock
        </ThemedText>
        <Card style={{ gap: spacing.md }}>
          <Row label="App time" value={`${formatWeekdayDate(appTime)}, ${formatTime(appTime.toISOString())}`} />
          <Row label="Offset" value={formatOffset(offset)} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {JUMPS.map(({ label, ms }) => (
              <PressableScale
                key={label}
                accessibilityRole="button"
                onPress={() => shiftClock(ms)}
                style={{
                  flexBasis: '47%',
                  flexGrow: 1,
                  alignItems: 'center',
                  paddingVertical: spacing.md,
                  borderRadius: radius.full,
                  backgroundColor: colors.surfaceTint,
                }}
              >
                <ThemedText variant="headline" tone="accent">
                  {label}
                </ThemedText>
              </PressableScale>
            ))}
          </View>
          {offset !== 0 && <TextButton title="Back to real time" onPress={() => setClockOffset(0)} />}
        </Card>
        <ThemedText variant="footnote" tone="secondary">
          Shifts what the app shows and schedules (today, pace, the morning prompt, reminders) without changing the
          phone&apos;s clock. Sips are still logged at the real time, and the server keeps its own clock. The offset
          stays until you reset it, even across reloads.
        </ThemedText>
      </View>
    </ScreenScroll>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
      <ThemedText variant="body" tone="secondary">
        {label}
      </ThemedText>
      <ThemedText variant="headline" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </ThemedText>
    </View>
  );
}
