import { memo } from 'react';
import { View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import type { LeaderboardEntry } from '@/data/types';
import { gutter, radius, spacing, useColors } from '@/theme';

/** One leaderboard row. Rows stack into a single rounded card via `position`. */
export const LeaderRow = memo(function LeaderRow({
  entry,
  position,
}: {
  entry: LeaderboardEntry;
  position: 'first' | 'middle' | 'last' | 'only';
}) {
  const colors = useColors();
  const top = position === 'first' || position === 'only';
  const bottom = position === 'last' || position === 'only';
  return (
    <View
      accessible
      accessibilityLabel={`Rank ${entry.rank}, ${entry.username}${entry.is_me ? ', you' : ''}, ${entry.streak} day streak`}
      style={{
        marginHorizontal: gutter,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.lg,
        paddingHorizontal: spacing.xl,
        paddingTop: top ? spacing.lg : spacing.sm,
        paddingBottom: bottom ? spacing.lg : spacing.sm,
        backgroundColor: entry.is_me ? colors.surfaceSky : colors.surface,
        borderColor: colors.border,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderTopWidth: top ? 1 : 0,
        borderBottomWidth: bottom ? 1 : 0,
        borderTopLeftRadius: top ? radius.lg : 0,
        borderTopRightRadius: top ? radius.lg : 0,
        borderBottomLeftRadius: bottom ? radius.lg : 0,
        borderBottomRightRadius: bottom ? radius.lg : 0,
      }}
    >
      <ThemedText variant="callout" tone="secondary" style={{ width: 28, fontVariant: ['tabular-nums'] }}>
        {entry.rank}
      </ThemedText>
      <Avatar username={entry.username} size={44} tone={entry.is_me ? 'surface' : 'tint'} />
      <View style={{ flex: 1 }}>
        <ThemedText variant="headline" style={{ fontSize: 18 }} numberOfLines={1}>
          {entry.username}
        </ThemedText>
        {entry.is_me && (
          <ThemedText variant="footnote" tone="secondary">
            You{entry.streak === 0 ? ' · a fresh start today' : ''}
          </ThemedText>
        )}
      </View>
      <ThemedText variant="number" style={{ fontSize: 20 }}>
        {entry.streak}
        <ThemedText variant="footnote" tone="secondary">
          {' '}
          {entry.streak === 1 ? 'day' : 'days'}
        </ThemedText>
      </ThemedText>
    </View>
  );
});
