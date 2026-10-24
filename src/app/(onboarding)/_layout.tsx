import { Stack } from 'expo-router';

import { type, useColors } from '@/theme';

export const unstable_settings = { anchor: 'goal' };

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
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { ...type.eyebrow, fontSize: 13, color: colors.accent },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="goal" options={{ title: 'YOUR RHYTHM · 1 OF 2' }} />
      <Stack.Screen name="interval" options={{ title: 'YOUR RHYTHM · 2 OF 2' }} />
      <Stack.Screen name="apps" options={{ title: 'APP LOCK' }} />
      <Stack.Screen name="bottle" options={{ title: 'BOTTLE SETUP · 1 OF 2' }} />
      <Stack.Screen name="done" options={{ title: 'BOTTLE SETUP · 2 OF 2', headerBackVisible: false, gestureEnabled: false }} />
    </Stack>
  );
}
