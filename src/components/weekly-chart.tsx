import { memo } from 'react';
import { View } from 'react-native';

import { radius, spacing, useColors } from '@/theme';
import { formatLiters } from '@/utils/format';
import { barColor, type WeekBar } from '@/utils/intake';

import { ThemedText } from './themed-text';

export type WeeklyChartProps = { bars: readonly WeekBar[]; goalMl: number };

const CHART_HEIGHT = 120;

/** Android/web: the reference bars, value on top and weekday below. */
export const WeeklyChart = memo(function WeeklyChart({ bars, goalMl }: WeeklyChartProps) {
  const colors = useColors();
  const max = Math.max(goalMl * 1.15, ...bars.map((b) => b.ml));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, height: CHART_HEIGHT + 44 }}>
      {bars.map((bar) => (
        <View
          key={bar.day}
          style={{ flex: 1, alignItems: 'center', gap: spacing.xs }}
          accessible
          accessibilityLabel={`${bar.label}: ${formatLiters(bar.ml)} liters`}
        >
          {bar.state !== 'future' && (
            <ThemedText variant="caption" tone="tertiary" style={{ fontVariant: ['tabular-nums'] }}>
              {formatLiters(bar.ml)}
            </ThemedText>
          )}
          <View
            style={{
              width: '100%',
              height: bar.state === 'future' ? 0 : Math.max(12, (bar.ml / max) * CHART_HEIGHT),
              borderRadius: radius.md,
              borderCurve: 'continuous',
              backgroundColor: barColor(bar.state, colors),
            }}
          />
          <ThemedText variant="caption" tone="secondary">
            {bar.label.charAt(0)}
          </ThemedText>
        </View>
      ))}
    </View>
  );
});
