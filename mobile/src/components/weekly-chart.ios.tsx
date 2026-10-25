import { Host } from '@expo/ui';
import { Chart } from '@expo/ui/swift-ui';
import { memo } from 'react';

import { useColors } from '@/theme';
import { barColor } from '@/utils/intake';

import type { WeeklyChartProps } from './weekly-chart';

/** iOS: Swift Charts bars with a dashed rule at the daily goal. */
export const WeeklyChart = memo(function WeeklyChart({ bars, goalMl }: WeeklyChartProps) {
  const colors = useColors();
  return (
    <Host style={{ height: 180 }} accessibilityLabel="Liters per day this week">
      <Chart
        type="bar"
        animate
        showGrid={false}
        data={bars.map((bar) => ({
          x: bar.label,
          y: bar.state === 'future' ? 0 : Math.round(bar.ml / 10) / 100,
          color: barColor(bar.state, colors),
        }))}
        barStyle={{ cornerRadius: 10, width: 28 }}
        referenceLines={[{ x: 'goal', y: goalMl / 1000, color: colors.peachStrong }]}
        ruleStyle={{ color: colors.peachStrong, lineWidth: 1.5, dashArray: [4, 4] }}
      />
    </Host>
  );
});
