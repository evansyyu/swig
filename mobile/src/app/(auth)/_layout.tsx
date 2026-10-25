import { Stack } from 'expo-router';

export const unstable_settings = { anchor: 'sign-up' };

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />;
}
