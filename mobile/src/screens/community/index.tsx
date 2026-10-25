import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { SyncPill } from '@/components/sync-pill';
import { ThemedText } from '@/components/themed-text';
import { useAppState } from '@/data/store';
import { requestSync } from '@/data/sync';
import type { LeaderboardEntry } from '@/data/types';
import { gutter, spacing, useColors } from '@/theme';

import { LeaderRow } from './leader-row';
import { Podium } from './podium';

const isIOS = process.env.EXPO_OS === 'ios';

export function Community() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const board = useAppState((s) => s.leaderboard);
  const phase = useAppState((s) => s.sync.phase);
  const [refreshing, setRefreshing] = useState(false);

  const top = useMemo(() => board?.entries.slice(0, 3) ?? [], [board]);
  const rest = useMemo(() => board?.entries.slice(3) ?? [], [board]);
  const me = board?.me ?? null;
  const meListed = !!board?.entries.some((e) => e.is_me);

  const renderItem: ListRenderItem<LeaderboardEntry> = useCallback(
    ({ item, index }) => (
      <LeaderRow
        entry={item}
        position={rest.length === 1 ? 'only' : index === 0 ? 'first' : index === rest.length - 1 ? 'last' : 'middle'}
      />
    ),
    [rest.length]
  );

  const refresh = async () => {
    setRefreshing(true);
    await requestSync();
    setRefreshing(false);
  };

  return (
    <FlashList
      data={rest}
      renderItem={renderItem}
      keyExtractor={(item) => item.username}
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: isIOS ? spacing.sm : insets.top + spacing.lg, paddingBottom: spacing.xxxl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} colors={[colors.accent]} />}
      ListHeaderComponent={
        <View style={{ paddingHorizontal: gutter, gap: spacing.lg, paddingBottom: spacing.lg }}>
          <View style={{ gap: spacing.xs }}>
            <ThemedText variant="eyebrow" tone="accent">
              A little better, together
            </ThemedText>
            {!isIOS && (
              <ThemedText variant="title" accessibilityRole="header">
                Steady sippers
              </ThemedText>
            )}
            <ThemedText variant="subhead" tone="secondary">
              The community, ranked by current daily-goal streak. Every day is a fresh chance.
            </ThemedText>
          </View>
          <SyncPill />
          {top.length > 0 && <Podium top={top} />}
          {rest.length > 0 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <ThemedText variant="title2" style={{ fontSize: 20 }} accessibilityRole="header">
                Keeping the rhythm
              </ThemedText>
              <ThemedText variant="subhead" tone="secondary">
                {board?.total ?? 0} members
              </ThemedText>
            </View>
          )}
        </View>
      }
      ListEmptyComponent={
        board ? null : (
          <View style={{ paddingHorizontal: gutter, paddingVertical: spacing.xxl, alignItems: 'center', gap: spacing.md }}>
            {phase === 'offline' || phase === 'error' ? (
              <>
                <Icon ios="icloud.slash" android="cloud_off" size={28} color={colors.textTertiary} />
                <ThemedText variant="subhead" tone="secondary" style={{ textAlign: 'center' }}>
                  The leaderboard loads once you&apos;re online. Pull down to try again.
                </ThemedText>
              </>
            ) : (
              <ActivityIndicator color={colors.accent} />
            )}
          </View>
        )
      }
      ListFooterComponent={
        board ? (
          <View style={{ gap: spacing.lg, paddingTop: spacing.lg }}>
            {me && !meListed && <LeaderRow entry={me} position="only" />}
            <View style={{ paddingHorizontal: gutter }}>
              <Card tone="peach" style={{ gap: spacing.xxs }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Icon ios="person.2" android="groups" size={20} color={colors.onPeach} />
                  <ThemedText variant="headline" tone="onPeach" style={{ flex: 1 }}>
                    {me && me.streak > 0 ? `${me.streak} days and counting` : 'Your next streak starts with today'}
                  </ThemedText>
                </View>
                <ThemedText variant="subhead" tone="onPeach">
                  Meet your goal to add a day. A missed day resets your current streak to 0.
                </ThemedText>
              </Card>
            </View>
          </View>
        ) : null
      }
    />
  );
}
