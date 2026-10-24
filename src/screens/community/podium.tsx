import { memo } from 'react';
import { View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import type { LeaderboardEntry } from '@/data/types';
import { radius, spacing, useColors } from '@/theme';

/** Top three by current streak. */
export const Podium = memo(function Podium({ top }: { top: readonly LeaderboardEntry[] }) {
  const colors = useColors();
  return (
    <Card tone="tint" style={{ gap: spacing.lg, padding: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.sm }}>
        <ThemedText variant="eyebrow" tone="accent">
          Daily-goal streaks
        </ThemedText>
        <Icon ios="trophy" android="emoji_events" size={22} color={colors.accent} />
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {top.map((entry, i) => (
          <View
            key={entry.username}
            accessible
            accessibilityLabel={`Rank ${entry.rank}, ${entry.username}, ${entry.streak} day streak`}
            style={{
              flex: 1,
              alignItems: 'center',
              gap: spacing.xs,
              paddingVertical: spacing.lg,
              paddingHorizontal: spacing.xs,
              borderRadius: radius.md,
              borderCurve: 'continuous',
              backgroundColor: i === 0 ? colors.surfaceSky : colors.surface,
            }}
          >
            <ThemedText variant="footnote" tone="secondary">
              #{entry.rank}
            </ThemedText>
            <Avatar username={entry.username} size={46} tone="surface" />
            <ThemedText variant="subhead" numberOfLines={1} style={{ fontWeight: '600' }}>
              {entry.username}
            </ThemedText>
            <ThemedText variant="stat">{entry.streak}</ThemedText>
            <ThemedText variant="footnote" tone="secondary">
              day streak
            </ThemedText>
          </View>
        ))}
      </View>
    </Card>
  );
});
