import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { IntakeLog } from '@/components/intake-log';
import { ScreenScroll } from '@/components/screen-scroll';
import { SettingsButton } from '@/components/settings-button';
import { SyncPill } from '@/components/sync-pill';
import { ThemedText } from '@/components/themed-text';
import { markBaselineSeen, undoIntake } from '@/data/actions';
import { localDay } from '@/data/pace';
import { getState, useAppState } from '@/data/store';
import { requestSync } from '@/data/sync';
import { spacing, useColors } from '@/theme';
import { displayName, formatWeekdayDate, parseDay } from '@/utils/format';

import { BalanceCard } from './balance-card';
import { HydrationCard } from './hydration-card';
import { SpeakerCard } from './speaker-card';

const isIOS = process.env.EXPO_OS === 'ios';

export function Today() {
  const username = useAppState((s) => s.profile?.username ?? '');
  const day = useAppState((s) => localDay(new Date(s.now))); // re-renders the date at midnight
  const [refreshing, setRefreshing] = useState(false);
  useMorningBaselinePrompt();

  const refresh = async () => {
    setRefreshing(true);
    await requestSync();
    setRefreshing(false);
  };

  return (
    <ScreenScroll safeTop={!isIOS} refreshing={refreshing} onRefresh={refresh}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <ThemedText variant="eyebrow" tone="accent">
            {formatWeekdayDate(parseDay(day))}
          </ThemedText>
          <ThemedText variant={isIOS ? 'title2' : 'title'} accessibilityRole={isIOS ? undefined : 'header'}>
            Your daily flow, {displayName(username)}
          </ThemedText>
        </View>
        {!isIOS && <SettingsButton size={48} />}
      </View>
      <SyncPill />
      <LockBanner />
      <HydrationCard />
      <SpeakerCard />
      <BalanceCard />
      <LogCard />
    </ScreenScroll>
  );
}

function LockBanner() {
  const colors = useColors();
  const locked = useAppState((s) => !!(s.status?.should_lock && s.profile?.lock_enabled));
  if (!locked) return null;
  return (
    <Card tone="peach" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }} accessibilityLiveRegion="polite">
      <Icon ios="lock.fill" android="lock" size={22} color={colors.onPeach} />
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <ThemedText variant="headline" tone="onPeach">
          Comfort apps are paused
        </ThemedText>
        <ThemedText variant="subhead" tone="onPeach">
          You&apos;ve fallen behind your pace. One drink unlocks them.
        </ThemedText>
      </View>
    </Card>
  );
}

function LogCard() {
  const intakes = useAppState((s) => s.todayIntakes);
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <ThemedText variant="title2" style={{ fontSize: 20 }}>
          Little sips, adding up
        </ThemedText>
        <ThemedText variant="subhead" tone="secondary">
          Today
        </ThemedText>
      </View>
      {intakes.length ? (
        <IntakeLog intakes={intakes} onUndo={undoIntake} />
      ) : (
        <ThemedText variant="subhead" tone="secondary">
          No sips yet today. Set your full bottle on the Balance, or log one above.
        </ThemedText>
      )}
    </Card>
  );
}

/**
 * Once a day, the first time Today is focused with the Balance online and no baseline
 * yet, show the "fill up" sheet (reference screen 07).
 */
function useMorningBaselinePrompt() {
  useFocusEffect(
    useCallback(() => {
      const s = getState();
      const today = localDay();
      const hasBaseline = s.todayIntakes.some((i) => i.kind === 'baseline');
      if (s.profile?.scale_owner && s.status?.scale?.connected && !hasBaseline && s.baselineSeenDay !== today) {
        markBaselineSeen();
        router.push('/baseline');
      }
    }, [])
  );
}
