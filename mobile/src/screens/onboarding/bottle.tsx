import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Card } from '@/components/card';
import { HeroArt } from '@/components/hero-art';
import { PrimaryButton } from '@/components/primary-button';
import { StepLayout } from '@/components/screen-scroll';
import { StatusDot } from '@/components/status-dot';
import { StepProgress } from '@/components/step-progress';
import { TextButton } from '@/components/text-button';
import { ThemedText } from '@/components/themed-text';
import { saveEmptyBottle } from '@/data/actions';
import { ApiError } from '@/data/api';
import { useAppState } from '@/data/store';
import { useScaleLive } from '@/hooks/use-scale-live';
import { radius, spacing, useColors } from '@/theme';

/**
 * Weigh the empty bottle on the Balance. Used in onboarding and, as a modal, from
 * Settings. Saving also makes this account the Balance's owner on the server.
 */
export function BottleSetup({ context }: { context: 'onboarding' | 'settings' }) {
  const colors = useColors();
  const { live, error: liveError } = useScaleLive();
  const username = useAppState((s) => s.profile?.username ?? '');
  const streak = useAppState((s) => s.status?.streak ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connected = !!live?.connected;
  const grams = connected ? live?.grams : null;
  const stable = connected && !!live?.stable;

  const finish = () => (context === 'onboarding' ? router.push('/done') : router.back());

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveEmptyBottle();
      finish();
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === 'no_stable_reading'
          ? 'Hold on: put the empty bottle on the Balance and keep it still for a few seconds.'
          : e instanceof ApiError
            ? e.message
            : "Couldn't save. Try again."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <StepLayout
      footer={
        <>
          <PrimaryButton title="Save empty weight" onPress={save} loading={saving} disabled={!stable} />
          <TextButton title={context === 'onboarding' ? 'Skip for now' : 'Cancel'} onPress={finish} />
        </>
      }
    >
      {context === 'onboarding' && <StepProgress step={1} total={2} />}
      <View style={{ gap: spacing.sm }}>
        <ThemedText variant="largeTitle" accessibilityRole="header">
          First, an empty bottle.
        </ThemedText>
        <ThemedText variant="body" tone="secondary">
          Place an EMPTY bottle or cup on your Water Bottle Balance, with its usual lid.
        </ThemedText>
      </View>

      <HeroArt level={0} />

      <Card style={{ gap: spacing.sm }}>
        <StatusDot on={connected} label={connected ? 'Balance connected' : live ? 'Balance offline' : 'Looking for your Balance…'} />
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs }}>
            {live === null && !liveError ? (
              <ActivityIndicator color={colors.accent} style={{ height: 64 }} />
            ) : (
              <ThemedText variant="display" accessibilityLabel={grams != null ? `${Math.round(grams)} grams` : 'No reading'}>
                {grams != null ? Math.max(0, Math.round(grams)) : '—'}
              </ThemedText>
            )}
            <ThemedText variant="title2">g</ThemedText>
          </View>
          {connected && (
            <View
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
                borderRadius: radius.full,
                backgroundColor: stable ? colors.surfaceTint : colors.peach,
              }}
            >
              <ThemedText variant="caption" tone={stable ? 'accent' : 'onPeach'}>
                {stable ? '● Stable' : '● Settling…'}
              </ThemedText>
            </View>
          )}
        </View>
        <ThemedText variant="subhead" tone="secondary">
          Live empty-bottle weight
        </ThemedText>
      </Card>

      <View style={{ gap: spacing.sm }}>
        <ThemedText variant="footnote" tone="secondary">
          Keep your phone online and the Balance on Wi-Fi. Leave the bottle still while it&apos;s weighed.
        </ThemedText>
        {(error ?? liveError) && (
          <ThemedText variant="subhead" tone="danger" selectable accessibilityLiveRegion="polite">
            {error ?? liveError}
          </ThemedText>
        )}
        {context === 'onboarding' && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <ThemedText variant="subhead" tone="secondary">
              {username} · current streak
            </ThemedText>
            <ThemedText variant="headline">
              {streak} {streak === 1 ? 'day' : 'days'}
            </ThemedText>
          </View>
        )}
      </View>
    </StepLayout>
  );
}
