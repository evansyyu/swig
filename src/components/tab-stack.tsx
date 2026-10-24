import { Stack } from 'expo-router';
import type { ReactNode } from 'react';

import { useColors } from '@/theme';

const isIOS = process.env.EXPO_OS === 'ios';

/**
 * A tab's native stack. iOS: transparent large title per the HIG (the screen omits its
 * own heading). Android: no app bar; the screen draws the reference heading itself.
 */
export function TabStack({ screen, title, headerRight }: { screen: string; title: string; headerRight?: () => ReactNode }) {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        headerShown: isIOS,
        headerTransparent: true,
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
        headerLargeStyle: { backgroundColor: 'transparent' },
        headerLargeTitleEnabled: true,
        headerBlurEffect: 'none',
        headerTintColor: colors.accent,
        headerTitleStyle: { color: colors.text },
        headerLargeTitleStyle: { color: colors.text },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name={screen} options={{ title, headerRight }} />
    </Stack>
  );
}
