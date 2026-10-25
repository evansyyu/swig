import { memo } from 'react';
import { Alert, Pressable, View } from 'react-native';

import type { Intake } from '@/data/types';
import { spacing, useColors } from '@/theme';
import { formatTime } from '@/utils/format';
import { canUndo, describeIntake } from '@/utils/intake';

import { Icon } from './icon';
import { ThemedText } from './themed-text';

export type IntakeLogProps = { intakes: readonly Intake[]; onUndo: (id: string) => void };

/** Android/web: rows with a long-press to remove a wrong entry. */
export const IntakeLog = memo(function IntakeLog({ intakes, onUndo }: IntakeLogProps) {
  const colors = useColors();
  return (
    <View style={{ gap: spacing.xs }}>
      {intakes.map((intake) => {
        const { label, amount } = describeIntake(intake);
        return (
          <Pressable
            key={intake.id}
            disabled={!canUndo(intake)}
            onLongPress={() =>
              Alert.alert('Remove this entry?', `${label}, ${amount}`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => onUndo(intake.id) },
              ])
            }
            android_ripple={{ color: colors.surfaceTint }}
            accessibilityHint={canUndo(intake) ? 'Long press to remove' : undefined}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg, minHeight: 40 }}
          >
            <ThemedText variant="subhead" tone="secondary" style={{ width: 76, fontVariant: ['tabular-nums'] }}>
              {formatTime(intake.at)}
            </ThemedText>
            <ThemedText variant="subhead" style={{ flex: 1 }} numberOfLines={1}>
              {label}
            </ThemedText>
            {intake.pending && <Icon ios="clock" android="schedule" size={14} color={colors.textTertiary} />}
            <ThemedText variant="callout" tone="accent" style={{ fontWeight: '700', fontVariant: ['tabular-nums'] }}>
              {amount}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
});
