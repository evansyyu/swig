import { Host } from '@expo/ui';
import { Button, Grid, Text } from '@expo/ui/swift-ui';
import { buttonBorderShape, buttonStyle, controlSize, font, foregroundStyle, frame, tint } from '@expo/ui/swift-ui/modifiers';
import * as Haptics from 'expo-haptics';

import { GOAL_OPTIONS } from '@/constants/hydration';
import { useColors } from '@/theme';
import { formatLiters } from '@/utils/format';

import type { GoalPickerProps } from './goal-picker';

const ROWS = [GOAL_OPTIONS.slice(0, 4), GOAL_OPTIONS.slice(4)];

/** iOS: a SwiftUI grid of native capsule buttons; the selection is the prominent one. */
export function GoalPicker({ value, onChange }: GoalPickerProps) {
  const colors = useColors();
  const select = (ml: number) => {
    if (ml === value) return;
    void Haptics.selectionAsync();
    onChange(ml);
  };
  return (
    <Host matchContents={{ vertical: true }}>
      <Grid horizontalSpacing={10} verticalSpacing={10} alignment="leading">
        {ROWS.map((row, i) => (
          <Grid.Row key={i}>
            {row.map((ml) => (
              <Button
                key={ml}
                onPress={() => select(ml)}
                modifiers={[
                  buttonStyle(ml === value ? 'borderedProminent' : 'bordered'),
                  buttonBorderShape('capsule'),
                  controlSize('large'),
                  tint(colors.accent),
                ]}
              >
                <Text
                  modifiers={[
                    font({ size: 17, weight: ml === value ? 'semibold' : 'regular' }),
                    foregroundStyle(ml === value ? colors.onAccent : colors.accent),
                    frame({ maxWidth: 10_000 }),
                  ]}
                >
                  {formatLiters(ml)}
                </Text>
              </Button>
            ))}
          </Grid.Row>
        ))}
      </Grid>
    </Host>
  );
}
