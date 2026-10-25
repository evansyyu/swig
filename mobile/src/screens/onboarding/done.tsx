import { View } from 'react-native';

import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { PrimaryButton } from '@/components/primary-button';
import { StepLayout } from '@/components/screen-scroll';
import { StepProgress } from '@/components/step-progress';
import { ThemedText } from '@/components/themed-text';
import { completeOnboarding } from '@/data/session';
import { useAppState } from '@/data/store';
import { radius, shadows, spacing, useColors } from '@/theme';
import { formatInterval, formatLiters } from '@/utils/format';

export function DoneStep() {
  const colors = useColors();
  const profile = useAppState((s) => s.profile);
  const streak = useAppState((s) => s.status?.streak ?? 0);
  if (!profile) return null;

  const rows = [
    { ios: 'scalemass', android: 'scale', label: 'Empty bottle', value: profile.empty_g != null ? `${Math.round(profile.empty_g)} g saved` : 'Not set yet' },
    { ios: 'drop', android: 'water_drop', label: 'Water goal', value: `${formatLiters(profile.goal_ml)} L / day` },
    { ios: 'bell', android: 'notifications', label: 'Reminder', value: formatInterval(profile.interval_min) },
    { ios: 'sparkles', android: 'auto_awesome', label: 'Current streak', value: `${streak} ${streak === 1 ? 'day' : 'days'}` },
  ] as const;

  return (
    <StepLayout footer={<PrimaryButton title="Start my day" onPress={() => void completeOnboarding()} />}>
      <StepProgress step={2} total={2} />
      <View style={{ alignItems: 'center', paddingVertical: spacing.sm }}>
        <View
          style={{
            width: 168,
            height: 168,
            borderRadius: radius.full,
            backgroundColor: colors.surfaceSky,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: 100,
              height: 100,
              borderRadius: radius.full,
              backgroundColor: colors.surface,
              boxShadow: shadows.raised,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon ios="checkmark" android="check" size={36} color={colors.accent} weight="semibold" />
          </View>
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        <ThemedText variant="eyebrow" tone="accent">
          All set, {profile.username}
        </ThemedText>
        <ThemedText variant="largeTitle" accessibilityRole="header">
          A fresh start, saved.
        </ThemedText>
        <ThemedText variant="body" tone="secondary">
          Your rhythm is saved to your account. Let&apos;s make room for a good habit.
        </ThemedText>
      </View>

      <Card style={{ gap: spacing.md }}>
        <ThemedText variant="eyebrow" tone="accent">
          Your daily rhythm
        </ThemedText>
        {rows.map((row) => (
          <View key={row.label} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Icon ios={row.ios} android={row.android} size={20} color={colors.textSecondary} />
            <ThemedText variant="body" tone="secondary" style={{ flex: 1 }}>
              {row.label}
            </ThemedText>
            <ThemedText variant="headline">{row.value}</ThemedText>
          </View>
        ))}
      </Card>

      <Card tone="peach" style={{ gap: spacing.xxs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Icon ios="sparkles" android="auto_awesome" size={18} color={colors.onPeach} />
          <ThemedText variant="headline" tone="onPeach">
            Small sips. Fresh beginnings.
          </ThemedText>
        </View>
        <ThemedText variant="subhead" tone="onPeach">
          Meet today&apos;s goal to earn your first streak day.
        </ThemedText>
      </Card>
    </StepLayout>
  );
}
