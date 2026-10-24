import { View } from 'react-native';

import { useAppState } from '@/data/store';
import { radius, spacing, useColors } from '@/theme';

import { Icon } from './icon';
import { ThemedText } from './themed-text';

/**
 * Quiet sync indicator: hidden when everything is confirmed, otherwise says whether
 * changes are saved on the phone and waiting, or the last sync failed.
 */
export function SyncPill() {
  const colors = useColors();
  const phase = useAppState((s) => s.sync.phase);
  const pending = useAppState((s) => s.outbox.length);
  if (phase !== 'offline' && phase !== 'error' && pending === 0) return null;

  const label =
    phase === 'offline'
      ? pending
        ? `Offline · ${pending} saved on this phone`
        : 'Offline · showing saved data'
      : phase === 'error'
        ? "Couldn't sync · will retry"
        : `Syncing ${pending} change${pending === 1 ? '' : 's'}…`;

  return (
    <View
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs + 2,
        borderRadius: radius.full,
        backgroundColor: phase === 'error' ? colors.peach : colors.surfaceTint,
      }}
    >
      <Icon
        ios={phase === 'offline' ? 'icloud.slash' : phase === 'error' ? 'exclamationmark.icloud' : 'arrow.triangle.2.circlepath'}
        android={phase === 'offline' ? 'cloud_off' : phase === 'error' ? 'sync_problem' : 'sync'}
        size={14}
        color={phase === 'error' ? colors.onPeach : colors.accent}
      />
      <ThemedText variant="caption" tone={phase === 'error' ? 'onPeach' : 'accent'}>
        {label}
      </ThemedText>
    </View>
  );
}
