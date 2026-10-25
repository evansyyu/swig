import { router } from 'expo-router';
import { View } from 'react-native';

import { Card } from '@/components/card';
import { HeroArt } from '@/components/hero-art';
import { Icon } from '@/components/icon';
import { PrimaryButton } from '@/components/primary-button';
import { StepLayout } from '@/components/screen-scroll';
import { StatusDot } from '@/components/status-dot';
import { TextButton } from '@/components/text-button';
import { ThemedText } from '@/components/themed-text';
import { markBaselineSeen } from '@/data/actions';
import { appDate } from '@/data/clock';
import { useAppState } from '@/data/store';
import { requestSync } from '@/data/sync';
import { useScaleLive } from '@/hooks/use-scale-live';
import { spacing, useColors } from '@/theme';
import { formatLongDate, formatMl } from '@/utils/format';

/**
 * Morning sheet (reference 07): put the full bottle on the Balance. The server records
 * the first settled weight of the day as the baseline by itself; this screen shows it.
 */
export function Baseline() {
  const colors = useColors();
  const { live, error } = useScaleLive();
  const emptyG = useAppState((s) => s.profile?.empty_g ?? null);
  const connected = !!live?.connected;
  const stable = connected && !!live?.stable;
  const total = stable ? live?.stable_g ?? null : null;
  const water = total != null && emptyG != null ? Math.max(0, total - emptyG) : null;

  const close = () => {
    markBaselineSeen();
    void requestSync();
    router.back();
  };

  return (
    <StepLayout
      footer={
        <>
          <PrimaryButton title={stable ? 'Record starting weight' : 'Waiting for a steady bottle…'} onPress={close} disabled={!stable} />
          <TextButton title="Not now" onPress={close} />
        </>
      }
    >
      <View style={{ gap: spacing.sm, paddingTop: spacing.lg }}>
        <ThemedText variant="eyebrow" tone="accent">
          {formatLongDate(appDate())}
        </ThemedText>
        <ThemedText variant="largeTitle" accessibilityRole="header">
          Fill up.{'\n'}Find your starting point.
        </ThemedText>
        <ThemedText variant="body" tone="secondary">
          Each morning, place your FULL bottle on the Balance before your first sip.
        </ThemedText>
      </View>

      <HeroArt level={water != null && emptyG != null ? 0.8 : 0.6} drop />

      <Card style={{ gap: spacing.md }}>
        <StatusDot on={connected} label={connected ? 'Balance connected' : 'Balance offline'} />
        <Row label="Saved empty bottle" value={emptyG != null ? `${Math.round(emptyG)} g` : '—'} />
        <Row label={stable ? 'Measured total · stable' : 'Measured total'} value={total != null ? `${Math.round(total)} g` : '—'} />
        <View style={{ height: 1, backgroundColor: colors.separator }} />
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <ThemedText variant="headline">Starting water</ThemedText>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs }}>
            <ThemedText variant="display" tone="accent" style={{ fontSize: 48 }}>
              {water != null ? formatMl(water) : '—'}
            </ThemedText>
            <ThemedText variant="headline" tone="accent">
              ml
            </ThemedText>
          </View>
        </View>
      </Card>

      <Card tone="tint" style={{ flexDirection: 'row', gap: spacing.md }}>
        <Icon ios="info.circle" android="info" size={20} color={colors.accent} />
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <ThemedText variant="headline">A starting point, not a sip</ThemedText>
          <ThemedText variant="subhead" tone="secondary">
            No intake is counted yet. Drink, then put your bottle back to track each sip.
          </ThemedText>
        </View>
      </Card>

      {error && (
        <ThemedText variant="subhead" tone="danger" selectable>
          {error}
        </ThemedText>
      )}
      <ThemedText variant="footnote" tone="secondary" style={{ textAlign: 'center' }}>
        A heavier return is an automatic refill. Added water joins what&apos;s left in your bottle, without counting a
        drink.
      </ThemedText>
    </StepLayout>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <ThemedText variant="body" tone="secondary">
        {label}
      </ThemedText>
      <ThemedText variant="headline" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </ThemedText>
    </View>
  );
}
