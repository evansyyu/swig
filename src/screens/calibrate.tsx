import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Card } from '@/components/card';
import { PrimaryButton, type PrimaryButtonProps } from '@/components/primary-button';
import { StepLayout } from '@/components/screen-scroll';
import { StatusDot } from '@/components/status-dot';
import { TextButton } from '@/components/text-button';
import { ThemedText } from '@/components/themed-text';
import { cancelCalibration, confirmScaleEmpty, startCalibration, submitKnownWeight, useScale } from '@/data/scale-ble';
import type { CalibrationStep } from '@/data/types';
import { radius, spacing, type, useColors } from '@/theme';

const copy: Record<CalibrationStep, { title: string; body: string }> = {
  idle: { title: 'Calibrate your Balance.', body: 'You need something with a known weight, like a 500 g pack or a full 1 L bottle.' },
  starting: { title: 'Calibrate your Balance.', body: 'Getting your Balance ready…' },
  empty: { title: 'Clear the Balance.', body: 'Take everything off the Balance, then tap continue.' },
  taring: { title: 'Clear the Balance.', body: 'Zeroing… keep it empty and still.' },
  weight: { title: 'Add your known weight.', body: 'Place it on the Balance and enter exactly what it weighs.' },
  measuring: { title: 'Add your known weight.', body: 'Measuring… keep it still.' },
  done: { title: 'All calibrated.', body: 'Your Balance saved the new calibration. You can take the weight off.' },
  cancelled: { title: 'Calibration cancelled.', body: 'Your Balance kept its previous calibration.' },
};

/** Runs the scale's calibrate() routine over Bluetooth, one prompt at a time. */
export function Calibrate() {
  const colors = useColors();
  const link = useScale((s) => s.link);
  const grams = useScale((s) => s.grams);
  const scaleStep = useScale((s) => s.calibration);
  const linkError = useScale((s) => s.error);
  const [started, setStarted] = useState(false);
  const [known, setKnown] = useState('');
  const [error, setError] = useState<string | null>(null);

  // A result from an earlier visit isn't this one's.
  const step = !started && (scaleStep === 'done' || scaleStep === 'cancelled') ? 'idle' : scaleStep;
  const connected = link === 'connected';
  const knownGrams = Number.parseFloat(known.replace(',', '.'));

  // Leaving mid-calibration lets the scale go back to weighing.
  useEffect(() => cancelCalibration, []);

  const run = (action: () => Promise<void>) => {
    setError(null);
    action().catch((e) => setError(e instanceof Error ? e.message : "Couldn't reach your Balance."));
  };

  const start = () => {
    setStarted(true);
    run(startCalibration);
  };

  const primary = ((): PrimaryButtonProps => {
    switch (step) {
      case 'idle':
      case 'cancelled':
        return { title: step === 'idle' ? 'Start calibration' : 'Try again', onPress: start };
      case 'empty':
        return { title: "It's empty", onPress: () => run(confirmScaleEmpty) };
      case 'weight':
        return { title: 'Calibrate', onPress: () => run(() => submitKnownWeight(knownGrams)), disabled: !(knownGrams > 0) };
      case 'done':
        return { title: 'Done', onPress: () => router.back(), arrow: false };
      default:
        return { title: 'Working', onPress: () => undefined, loading: true };
    }
  })();

  return (
    <StepLayout
      footer={
        <>
          <PrimaryButton {...primary} disabled={primary.disabled || !connected} />
          {step !== 'done' && <TextButton title="Cancel" onPress={() => router.back()} />}
        </>
      }
    >
      <View style={{ gap: spacing.sm, paddingTop: spacing.lg }}>
        <ThemedText variant="largeTitle" accessibilityRole="header">
          {copy[step].title}
        </ThemedText>
        <ThemedText variant="body" tone="secondary" accessibilityLiveRegion="polite">
          {copy[step].body}
        </ThemedText>
      </View>

      <Card style={{ gap: spacing.sm }}>
        <StatusDot
          on={connected}
          label={connected ? 'Balance connected' : link === 'off' ? 'Balance not connected' : 'Looking for your Balance…'}
        />
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs }}>
          <ThemedText variant="display" style={{ fontVariant: ['tabular-nums'] }}>
            {connected && grams != null ? grams.toFixed(1) : '—'}
          </ThemedText>
          <ThemedText variant="title2">g</ThemedText>
        </View>
        <ThemedText variant="subhead" tone="secondary">
          Live reading
        </ThemedText>
      </Card>

      {step === 'weight' && (
        <View style={{ gap: spacing.sm }}>
          <ThemedText variant="headline" nativeID="known-label">
            Known weight (g)
          </ThemedText>
          <TextInput
            accessibilityLabelledBy="known-label"
            value={known}
            onChangeText={setKnown}
            placeholder="500"
            placeholderTextColor={colors.textTertiary}
            keyboardType="decimal-pad"
            autoFocus
            style={{
              ...type.body,
              color: colors.text,
              minHeight: 56,
              paddingHorizontal: spacing.xl,
              backgroundColor: colors.surface,
              borderRadius: radius.full,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          />
        </View>
      )}

      {(error ?? linkError) && (
        <ThemedText variant="subhead" tone="danger" selectable accessibilityLiveRegion="polite">
          {error ?? linkError}
        </ThemedText>
      )}
    </StepLayout>
  );
}
