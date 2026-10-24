import { Stack } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { hydrate, resume } from '@/data/session';
import { useAppState } from '@/data/store';
import { useLockEnforcement } from '@/hooks/use-lock-enforcement';
// Importing this module also defines the background task, which must happen at startup.
import { registerBackgroundSync } from '@/lib/background-sync';
import { useColors } from '@/theme';

// Synchronous: the cached session and data are in memory before the first frame,
// so routing never flashes the wrong screen and the app opens offline.
hydrate();
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useColorScheme();
  const colors = useColors();
  const signedIn = useAppState((s) => s.token !== null);
  const onboarded = useAppState((s) => s.onboarded);

  useLockEnforcement();
  useEffect(() => {
    resume();
    void registerBackgroundSync();
    void SplashScreen.hideAsync();
  }, []);

  const navigationTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.accent,
        background: colors.background,
        card: colors.background,
        text: colors.text,
        border: colors.separator,
      },
    };
  }, [scheme, colors]);

  return (
    <ThemeProvider value={navigationTheme}>
      <KeyboardProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
          <Stack.Protected guard={signedIn && !onboarded}>
            <Stack.Screen name="(onboarding)" />
          </Stack.Protected>
          <Stack.Protected guard={signedIn && onboarded}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="settings"
              options={{ presentation: 'modal', headerShown: true, title: 'Settings', headerShadowVisible: false }}
            />
            <Stack.Screen
              name="reweigh"
              options={{ presentation: 'modal', headerShown: true, title: 'Bottle setup', headerShadowVisible: false }}
            />
            <Stack.Screen
              name="baseline"
              options={{
                presentation: 'formSheet',
                sheetGrabberVisible: true,
                sheetAllowedDetents: [1.0],
                contentStyle: { backgroundColor: colors.background },
              }}
            />
          </Stack.Protected>
        </Stack>
      </KeyboardProvider>
    </ThemeProvider>
  );
}
