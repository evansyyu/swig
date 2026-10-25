import { useMemo } from 'react';
import { View } from 'react-native';

import { Card } from '@/components/card';
import { ScreenScroll } from '@/components/screen-scroll';
import { SyncPill } from '@/components/sync-pill';
import { ThemedText } from '@/components/themed-text';
import { WeeklyChart } from '@/components/weekly-chart';
import { localDay } from '@/data/pace';
import { useAppState } from '@/data/store';
import type { DayLog } from '@/data/types';
import { spacing } from '@/theme';
import { formatShortDate, parseDay } from '@/utils/format';
import type { WeekBar } from '@/utils/intake';

import { MonthCalendar } from './calendar';

const isIOS = process.env.EXPO_OS === 'ios';
const WEEKDAY = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
const WINDOW = 30;

function addDays(day: string, n: number) {
  const date = parseDay(day);
  date.setDate(date.getDate() + n);
  return localDay(date);
}

function weekBars(days: Readonly<Record<string, DayLog>>, today: string): WeekBar[] {
  const start = addDays(today, -parseDay(today).getDay()); // Sunday
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(start, i);
    const log = days[day];
    const state: WeekBar['state'] = day > today ? 'future' : log?.met ? 'met' : day === today ? 'today' : 'partial';
    return { day, label: WEEKDAY.format(parseDay(day)), ml: log?.consumed_ml ?? 0, state };
  });
}

export function Progress() {
  const days = useAppState((s) => s.days);
  const today = useAppState((s) => s.status?.day ?? localDay(new Date(s.now)));
  const goal = useAppState((s) => s.profile?.goal_ml ?? 2000);
  const streak = useAppState((s) => s.status?.streak ?? 0);
  const best = useAppState((s) => s.status?.best_streak ?? 0);
  const createdAt = useAppState((s) => s.profile?.created_at ?? null);

  const firstDay = createdAt ? localDay(new Date(createdAt)) : today;
  const windowStart = addDays(today, -(WINDOW - 1));
  const tracked = Math.max(1, Math.min(WINDOW, Math.round((parseDay(today).getTime() - parseDay(firstDay).getTime()) / 86_400_000) + 1));

  const stats = useMemo(() => {
    const met = Object.values(days).filter((d) => d.met && d.day >= windowStart && d.day <= today).length;
    return { met, rate: Math.round((met / tracked) * 100) };
  }, [days, windowStart, today, tracked]);
  const bars = useMemo(() => weekBars(days, today), [days, today]);

  return (
    <ScreenScroll safeTop={!isIOS}>
      <View style={{ gap: spacing.xs }}>
        {!isIOS && (
          <ThemedText variant="title" accessibilityRole="header">
            Your progress
          </ThemedText>
        )}
        <ThemedText variant="subhead" tone="secondary">
          Last {WINDOW} days · {formatShortDate(parseDay(windowStart))}–{formatShortDate(parseDay(today))}
        </ThemedText>
      </View>
      <SyncPill />

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <StatTile value={`${streak} ${streak === 1 ? 'day' : 'days'}`} label="Current streak" highlight />
        <StatTile value={`${best} ${best === 1 ? 'day' : 'days'}`} label="Best streak · all time" />
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <StatTile value={`${stats.met} / ${tracked}`} label="Daily goals met" />
        <StatTile value={`${stats.rate}%`} label="Completion rate" />
      </View>

      <Card style={{ gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <ThemedText variant="title2" style={{ fontSize: 20 }} accessibilityRole="header">
            This week
          </ThemedText>
          <ThemedText variant="subhead" tone="secondary">
            {formatShortDate(parseDay(bars[0].day))}–{formatShortDate(parseDay(bars[6].day))} · liters
          </ThemedText>
        </View>
        <WeeklyChart bars={bars} goalMl={goal} />
      </Card>

      <MonthCalendar days={days} today={today} firstDay={firstDay} />

      <ThemedText variant="subhead" tone="secondary">
        Meet your daily goal to build your streak. A missed day resets it to 0. Today is still in progress.
      </ThemedText>
    </ScreenScroll>
  );
}

function StatTile({ value, label, highlight }: { value: string; label: string; highlight?: boolean }) {
  return (
    <Card tone={highlight ? 'peach' : 'surface'} style={{ flex: 1, gap: spacing.xxs, paddingVertical: spacing.lg, paddingHorizontal: spacing.lg }}>
      <ThemedText variant="stat" tone={highlight ? 'onPeach' : 'primary'} adjustsFontSizeToFit numberOfLines={1}>
        {value}
      </ThemedText>
      <ThemedText variant="subhead" tone={highlight ? 'onPeach' : 'secondary'}>
        {label}
      </ThemedText>
    </Card>
  );
}
