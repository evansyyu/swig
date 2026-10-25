import { Stack } from 'expo-router';
import { View } from 'react-native';

import { StepProgress } from '@/components/step-progress';
import { ThemedText } from '@/components/themed-text';
import { spacing, type, useColors } from '@/theme';

export const unstable_settings = { anchor: 'goal' };

const isIOS = process.env.EXPO_OS === 'ios';

/** The step's eyebrow title with its progress bar under it, so the bar stays put while the step scrolls. */
function withProgress(step: number, total: number) {
  return {
    headerTitle: ({ children }: { children: string }) => (
      <View style={{ alignItems: 'center', gap: spacing.xs }}>
        <ThemedText variant="eyebrow" tone="accent" style={{ fontSize: 13 }} accessibilityRole="header">
          {children}
        </ThemedText>
        <StepProgress step={step} total={total} width={160} />
      </View>
    ),
  };
}

export default function OnboardingLayout() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        headerTitleAlign: 'center',
        headerTintColor: colors.accent,
        // iOS: a transparent bar whose soft scroll edge (iOS 26) fades the content scrolling
        // under it. Android has no edge effect and no automatic insets, so it keeps a solid bar.
        ...(isIOS
          ? { headerTransparent: true, scrollEdgeEffects: { top: 'soft' } }
          : { headerStyle: { backgroundColor: colors.background } }),
        headerTitleStyle: { ...type.eyebrow, fontSize: 13, color: colors.accent },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="goal" options={{ title: 'YOUR RHYTHM · 1 OF 2', ...withProgress(1, 2) }} />
      <Stack.Screen name="interval" options={{ title: 'YOUR RHYTHM · 2 OF 2', ...withProgress(2, 2) }} />
      <Stack.Screen name="apps" options={{ title: 'APP LOCK' }} />
      <Stack.Screen name="bottle" options={{ title: 'BOTTLE SETUP · 1 OF 2', ...withProgress(1, 2) }} />
      <Stack.Screen
        name="done"
        options={{ title: 'BOTTLE SETUP · 2 OF 2', ...withProgress(2, 2), headerBackVisible: false, gestureEnabled: false }}
      />
    </Stack>
  );
}
