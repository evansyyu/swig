import { memo, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { localDay } from '@/data/pace';
import type { DayLog } from '@/data/types';
import { radius, spacing, useColors } from '@/theme';
import { formatMonthYear } from '@/utils/format';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

type Cell = { key: string; date: number; state: 'met' | 'missed' | 'today' | 'idle' } | { key: string; date: null };

function buildMonth(year: number, month: number, days: Readonly<Record<string, DayLog>>, today: string, firstDay: string): Cell[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // Monday-first
  const count = new Date(year, month + 1, 0).getDate();
  const cells: Cell[] = Array.from({ length: lead }, (_, i) => ({ key: `lead-${i}`, date: null }));
  for (let d = 1; d <= count; d++) {
    const key = localDay(new Date(year, month, d));
    const state =
      key === today ? 'today' : days[key]?.met ? 'met' : key < today && key >= firstDay ? 'missed' : 'idle';
    cells.push({ key, date: d, state });
  }
  while (cells.length % 7) cells.push({ key: `trail-${cells.length}`, date: null });
  return cells;
}

/** Month view: filled = goal met, outlined = missed, peach = today. */
export const MonthCalendar = memo(function MonthCalendar({
  days,
  today,
  firstDay,
}: {
  days: Readonly<Record<string, DayLog>>;
  today: string;
  /** The account's first day; earlier days are neither met nor missed. */
  firstDay: string;
}) {
  const colors = useColors();
  const [cursor, setCursor] = useState(() => {
    const [y, m] = today.split('-').map(Number);
    return { year: y, month: m - 1 };
  });
  const cells = useMemo(() => buildMonth(cursor.year, cursor.month, days, today, firstDay), [cursor, days, today, firstDay]);
  const atCurrentMonth = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}` >= today.slice(0, 7);
  const shift = (delta: number) =>
    setCursor(({ year, month }) => {
      const date = new Date(year, month + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });

  const rows: Cell[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <Card style={{ gap: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <ThemedText variant="title2" style={{ flex: 1, fontSize: 20 }} accessibilityRole="header">
          {formatMonthYear(new Date(cursor.year, cursor.month, 1))}
        </ThemedText>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous month" hitSlop={12} onPress={() => shift(-1)} style={{ padding: spacing.xs }}>
          <Icon ios="chevron.left" android="chevron_left" size={20} color={colors.accent} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          accessibilityState={{ disabled: atCurrentMonth }}
          disabled={atCurrentMonth}
          hitSlop={12}
          onPress={() => shift(1)}
          style={{ padding: spacing.xs, marginLeft: spacing.md, opacity: atCurrentMonth ? 0.3 : 1 }}
        >
          <Icon ios="chevron.right" android="chevron_right" size={20} color={colors.accent} />
        </Pressable>
      </View>

      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row' }}>
          {WEEKDAYS.map((d, i) => (
            <ThemedText key={i} variant="subhead" tone="secondary" style={{ flex: 1, textAlign: 'center' }}>
              {d}
            </ThemedText>
          ))}
        </View>
        {rows.map((row, r) => (
          <View key={r} style={{ flexDirection: 'row' }}>
            {row.map((cell) => (
              <View key={cell.key} style={{ flex: 1, alignItems: 'center' }}>
                {cell.date !== null && (
                  <View
                    accessible
                    accessibilityLabel={`${cell.date}, ${cell.state === 'met' ? 'goal met' : cell.state === 'missed' ? 'missed' : cell.state === 'today' ? 'today' : ''}`}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: radius.full,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: cell.state === 'met' ? colors.accent : cell.state === 'today' ? colors.peach : 'transparent',
                      borderWidth: cell.state === 'missed' || cell.state === 'today' ? 1 : 0,
                      borderColor: cell.state === 'today' ? colors.onPeach : colors.border,
                    }}
                  >
                    <ThemedText
                      variant="callout"
                      tone={cell.state === 'met' ? 'onAccent' : cell.state === 'idle' ? 'secondary' : 'primary'}
                      style={{ fontVariant: ['tabular-nums'], fontWeight: cell.state === 'today' ? '800' : '500' }}
                    >
                      {cell.date}
                    </ThemedText>
                  </View>
                )}
              </View>
            ))}
          </View>
        ))}
      </View>
    </Card>
  );
});
