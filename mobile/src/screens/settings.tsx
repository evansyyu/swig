import { router, Stack } from 'expo-router';
import { Alert, Pressable } from 'react-native';

import { SettingsForm } from '@/components/settings-form';
import { ThemedText } from '@/components/themed-text';
import { updateSettings } from '@/data/actions';
import { logOut } from '@/data/session';
import { useClockOffset } from '@/data/clock';
import { getState, useAppState } from '@/data/store';
import { requestSync } from '@/data/sync';
import type { Settings as SettingsValues } from '@/data/types';
import { chooseApps, isAppBlockingSupported, useAppLockState } from '@/lib/app-blocker';
import { formatOffset } from '@/screens/dev';

export function Settings() {
  const profile = useAppState((s) => s.profile);
  const phase = useAppState((s) => s.sync.phase);
  const pending = useAppState((s) => s.outbox.length);
  const lastSyncedAt = useAppState((s) => s.sync.lastSyncedAt);
  const lockState = useAppLockState();
  const clockOffset = useClockOffset();
  if (!profile) return null;

  const onChange = async (patch: Partial<SettingsValues>) => {
    const start = patch.start_hour ?? profile.start_hour;
    const end = patch.end_hour ?? profile.end_hour;
    if (end <= start) {
      Alert.alert('Check your hours', 'Your day needs to end after it starts.');
      return;
    }
    // Turning the lock on needs something to lock: pick apps first.
    if (patch.lock_enabled && lockState.selectedCount === 0) {
      const count = await chooseApps();
      if (!count) return;
    }
    updateSettings(patch);
  };

  const confirmLogOut = () => {
    const unsynced = getState().outbox.length;
    Alert.alert(
      'Log out of Sip?',
      unsynced
        ? `${unsynced} change${unsynced === 1 ? " hasn't" : "s haven't"} synced yet and will be lost.`
        : 'Your history stays safe in your account.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log out', style: 'destructive', onPress: () => void logOut() },
      ]
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          // iOS: a native bar button (a glass close button on iOS 26). Bar buttons have no
          // control size, so the close glyph stands in for a larger "Done". Android keeps the text.
          unstable_headerRightItems: () => [
            { type: 'button', label: 'Done', icon: { type: 'sfSymbol', name: 'xmark' }, onPress: () => router.back() },
          ],
          headerRight: () => (
            <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={10}>
              <ThemedText variant="headline" tone="accent">
                Done
              </ThemedText>
            </Pressable>
          ),
        }}
      />
      <SettingsForm
        settings={profile}
        onChange={(patch) => void onChange(patch)}
        lock={{ supported: isAppBlockingSupported, state: lockState, onChooseApps: () => void chooseApps() }}
        bottle={{
          emptyG: profile.empty_g,
          scaleOwner: profile.scale_owner,
          onReweigh: () => router.push('/reweigh'),
          onCalibrate: () => router.push('/calibrate'),
        }}
        sync={{ phase, pending, lastSyncedAt, onSyncNow: () => void requestSync() }}
        username={profile.username}
        dev={__DEV__ ? { clock: formatOffset(clockOffset), onOpen: () => router.push('/dev') } : undefined}
        onLogOut={confirmLogOut}
      />
    </>
  );
}
