import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Card } from '@/components/card';
import { GoalPicker } from '@/components/goal-picker';
import { Icon } from '@/components/icon';
import { PrimaryButton } from '@/components/primary-button';
import { StepLayout } from '@/components/screen-scroll';
import { StepProgress } from '@/components/step-progress';
import { ThemedText } from '@/components/themed-text';
import { DEFAULT_GOAL, GOAL_OPTIONS } from '@/constants/hydration';
import { updateSettings } from '@/data/actions';
import { getState } from '@/data/store';
import { radius, spacing, useColors } from '@/theme';
import { formatLiters } from '@/utils/format';

export function GoalStep() {
  const colors = useColors();
  const [goal, setGoal] = useState(() => {
    const current = getState().profile?.goal_ml ?? DEFAULT_GOAL;
    return (GOAL_OPTIONS as readonly number[]).includes(current) ? current : DEFAULT_GOAL;
  });

  return (
    <StepLayout
      footer={
        <PrimaryButton
          title="Continue"
          onPress={() => {
            updateSettings({ goal_ml: goal });
            router.push('/interval');
          }}
        />
      }
    >
      <StepProgress step={1} total={2} />
      <View style={{ gap: spacing.sm }}>
        <ThemedText variant="largeTitle" accessibilityRole="header">
          A goal that feels like you.
        </ThemedText>
        <ThemedText variant="body" tone="secondary">
          Choose how much water you&apos;d like to drink each day.
        </ThemedText>
      </View>

      <View style={{ alignItems: 'center' }}>
        <View
          style={{
            width: 220,
            height: 220,
            borderRadius: radius.full,
            backgroundColor: colors.surfaceSky,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: 180,
              height: 180,
              borderRadius: radius.full,
              borderWidth: 1,
              borderColor: colors.accentMuted,
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.xxs,
            }}
          >
            <Icon ios="drop" android="water_drop" size={24} color={colors.accent} />
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs }}>
              <ThemedText variant="display" accessibilityLabel={`${formatLiters(goal)} liters every day`}>
                {formatLiters(goal)}
              </ThemedText>
              <ThemedText variant="title2">L</ThemedText>
            </View>
            <ThemedText variant="subhead" tone="secondary">
              every day
            </ThemedText>
          </View>
        </View>
      </View>

      <View style={{ gap: spacing.md }}>
        <ThemedText variant="headline">Daily water goal · liters</ThemedText>
        <GoalPicker value={goal} onChange={setGoal} />
      </View>

      <Card tone="tint" style={{ gap: spacing.xxs, paddingVertical: spacing.lg }}>
        <ThemedText variant="headline">Make it yours, anytime</ThemedText>
        <ThemedText variant="subhead" tone="secondary">
          You can change your goal later in Settings.
        </ThemedText>
      </Card>
    </StepLayout>
  );
}
