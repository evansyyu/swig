import { router } from 'expo-router';
import { type ComponentRef, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeroArt } from '@/components/hero-art';
import { Icon } from '@/components/icon';
import { PrimaryButton } from '@/components/primary-button';
import { TextButton } from '@/components/text-button';
import { ThemedText } from '@/components/themed-text';
import { ApiError } from '@/data/api';
import { logIn, signUp } from '@/data/session';
import { gutter, radius, spacing, type, useColors } from '@/theme';

const USERNAME = /^[a-z0-9._-]{3,32}$/i;

const copy = {
  'sign-up': {
    eyebrow: 'A little sip. A better day.',
    title: 'Find your daily flow.',
    subtitle: 'Your bottle and Balance. One gentle hydration habit.',
    cta: 'Create account',
    switchPrefix: 'Already have an account?',
    switchTitle: 'Log in',
    switchTo: '/log-in',
  },
  'log-in': {
    eyebrow: 'Your next sip starts here',
    title: 'Welcome back, water friend.',
    subtitle: 'Log in to reconnect with your daily rhythm.',
    cta: 'Log in',
    switchPrefix: 'New to Sip?',
    switchTitle: 'Sign up',
    switchTo: '/sign-up',
  },
} as const;

export function AuthScreen({ mode }: { mode: 'sign-up' | 'log-in' }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const text = copy[mode];
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usernameValid = USERNAME.test(username.trim());
  const passwordValid = mode === 'log-in' ? password.length > 0 : password.length >= 8;

  const submit = async () => {
    if (busy) return;
    if (!usernameValid) return setError('Usernames are 3–32 letters, numbers, dots, dashes or underscores.');
    if (!passwordValid) return setError('Use at least 8 characters for your password.');
    setBusy(true);
    setError(null);
    try {
      await (mode === 'sign-up' ? signUp(username, password) : logIn(username, password));
      // Routing follows the session: Stack.Protected swaps to onboarding or the tabs.
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  const inputStyle = {
    ...type.body,
    flex: 1,
    color: colors.text,
    paddingHorizontal: spacing.xl,
    minHeight: 56,
  } as const;

  const fieldStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  };

  return (
    <KeyboardAwareScrollView
      bottomOffset={spacing.xl}
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: gutter,
        paddingTop: insets.top + spacing.lg,
        paddingBottom: insets.bottom + spacing.lg,
        gap: spacing.xl,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.full,
            backgroundColor: colors.surfaceTint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon ios="drop" android="water_drop" size={22} color={colors.accent} />
        </View>
        <ThemedText variant="title2" accessibilityRole="header">
          Sip
        </ThemedText>
      </View>

      <HeroArt level={0.35} />

      <View style={{ gap: spacing.sm }}>
        <ThemedText variant="eyebrow" tone="accent">
          {text.eyebrow}
        </ThemedText>
        <ThemedText variant="largeTitle" accessibilityRole="header">
          {text.title}
        </ThemedText>
        <ThemedText variant="body" tone="secondary">
          {text.subtitle}
        </ThemedText>
      </View>

      <View style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.sm }}>
          <ThemedText variant="headline" nativeID="username-label">
            Username
          </ThemedText>
          <View style={fieldStyle}>
            <TextInput
              accessibilityLabelledBy="username-label"
              value={username}
              onChangeText={setUsername}
              placeholder="alex.water"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => passwordRef.current?.focus()}
              style={inputStyle}
            />
          </View>
        </View>

        <View style={{ gap: spacing.sm }}>
          <ThemedText variant="headline" nativeID="password-label">
            Password
          </ThemedText>
          <View style={fieldStyle}>
            <TextInput
              ref={passwordRef}
              accessibilityLabelledBy="password-label"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textTertiary}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
              textContentType={mode === 'sign-up' ? 'newPassword' : 'password'}
              returnKeyType="go"
              onSubmitEditing={submit}
              style={inputStyle}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={8}
              style={{ paddingHorizontal: spacing.xl, minHeight: 56, justifyContent: 'center' }}
            >
              <Icon
                ios={showPassword ? 'eye.slash' : 'eye'}
                android={showPassword ? 'visibility_off' : 'visibility'}
                size={20}
                color={colors.textSecondary}
              />
            </Pressable>
          </View>
          {mode === 'sign-up' && (
            <ThemedText variant="footnote" tone="secondary">
              Use at least 8 characters for a secure start.
            </ThemedText>
          )}
        </View>

        {error && (
          <ThemedText variant="subhead" tone="danger" selectable accessibilityLiveRegion="assertive">
            {error}
          </ThemedText>
        )}
      </View>

      <View style={{ flex: 1 }} />

      <View style={{ gap: spacing.xs }}>
        <PrimaryButton title={text.cta} onPress={submit} loading={busy} disabled={!username || !password} />
        <TextButton prefix={text.switchPrefix} title={text.switchTitle} onPress={() => router.replace(text.switchTo)} />
      </View>
    </KeyboardAwareScrollView>
  );
}
