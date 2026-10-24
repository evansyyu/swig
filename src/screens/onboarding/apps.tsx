import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { PrimaryButton } from '@/components/primary-button';
import { StepLayout } from '@/components/screen-scroll';
import { TextButton } from '@/components/text-button';
import { ThemedText } from '@/components/themed-text';
import { updateSettings } from '@/data/actions';
import { chooseApps, useAppLockState } from '@/lib/app-blocker';
import { radius, spacing, useColors } from '@/theme';

const POINTS = [
  { ios: 'hand.raised', android: 'front_hand', text: 'Only when you\u2019re critically behind, never on a good day.' },
  { ios: 'drop', android: 'water_drop', text: 'One drink on the Balance unlocks them right away.' },
  { ios: 'lock.shield', android: 'shield', text: 'Apple\u2019s Screen Time keeps your app choices private on this phone.' },
] as const;

/** iOS only (Screen Time). Android skips this step from the interval screen. */
export function AppsStep() {
  const colors = useColors();
  const lock = useAppLockState();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picked = lock.selectedCount > 0;

  const pick = async () => {
    setBusy(true);
    setError(null);
    try {
      const count = await chooseApps();
      if (count === null && lock.authorization === 'denied') {
        setError('Screen Time access is off. You can turn it on later in Settings › Screen Time.');
      }
    } catch {
      setError("Couldn't open the app picker. Try again from Settings later.");
    } finally {
      setBusy(false);
    }
  };

  const next = (enable: boolean) => {
    updateSettings({ lock_enabled: enable });
    router.push('/bottle');
  };

  return (
    <StepLayout
      footer={
        <>
          {picked ? (
            <PrimaryButton title="Turn on app lock" onPress={() => next(true)} />
          ) : (
            <PrimaryButton title="Choose apps" onPress={pick} loading={busy} arrow={false} />
          )}
          <TextButton title={picked ? 'Not now' : 'Skip for now'} onPress={() => next(false)} />
        </>
      }
    >
      <View style={{ gap: spacing.sm }}>
        <ThemedText variant="largeTitle" accessibilityRole="header">
          A little extra motivation.
        </ThemedText>
        <ThemedText variant="body" tone="secondary">
          Fall far behind your pace and Sip pauses the apps you pick, like Instagram or TikTok, until your next sip.
        </ThemedText>
      </View>

      <Card style={{ gap: spacing.lg }}>
        {POINTS.map((row) => (
          <View key={row.text} style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'center' }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.full,
                backgroundColor: colors.surfaceTint,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon ios={row.ios} android={row.android} size={18} color={colors.accent} />
            </View>
            <ThemedText variant="subhead" style={{ flex: 1 }}>
              {row.text}
            </ThemedText>
          </View>
        ))}
      </Card>

      {picked && (
        <Card tone="tint" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg }}>
          <Icon ios="checkmark.circle.fill" android="check_circle" size={22} color={colors.accent} />
          <ThemedText variant="callout" style={{ flex: 1 }}>
            {lock.selectedCount} {lock.selectedCount === 1 ? 'app or category' : 'apps or categories'} selected
          </ThemedText>
          <TextButton title="Change" onPress={pick} disabled={busy} />
        </Card>
      )}

      {error && (
        <ThemedText variant="subhead" tone="danger" selectable>
          {error}
        </ThemedText>
      )}
    </StepLayout>
  );
}
