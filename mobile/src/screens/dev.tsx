import { View } from 'react-native';

import { Card } from '@/components/card';
import { PressableScale } from '@/components/pressable-scale';
import { ScreenScroll } from '@/components/screen-scroll';
import { TextButton } from '@/components/text-button';
import { ThemedText } from '@/components/themed-text';
import { logSip } from '@/data/actions';
import { setClockOffset, shiftClock, useClockOffset } from '@/data/clock';
import { useAppState } from '@/data/store';
import { type AppLockState, isAppBlockingSupported, useAppLockState } from '@/lib/app-blocker';
import { useUpcomingReminders } from '@/lib/reminders';
import { radius, spacing, useColors } from '@/theme';
import { formatMl, formatTime, formatWeekdayDate } from '@/utils/format';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const JUMPS = [
  { label: '−1 day', ms: -DAY },
  { label: '−1 hour', ms: -HOUR },
  { label: '+1 hour', ms: HOUR },
  { label: '+1 day', ms: DAY },
] as const;

/** "+1 d 3 h", "−2 h", "None" */
export function formatOffset(ms: number) {
  if (!ms) return 'None';
  const hours = Math.round(Math.abs(ms) / HOUR);
  const days = Math.floor(hours / 24);
  const parts = [days && `${days} d`, hours % 24 && `${hours % 24} h`].filter(Boolean);
  return `${ms < 0 ? '−' : '+'}${parts.join(' ')}`;
}

/** Why the comfort apps are or aren't locked right now, in the order the app checks. */
function lockSummary(shouldLock: boolean, enabled: boolean, lock: AppLockState) {
  if (!isAppBlockingSupported) return 'Not supported here';
  if (!shouldLock) return 'Off: not critically behind';
  if (!enabled) return 'Off: “Lock comfort apps” is off';
  if (lock.authorization !== 'approved') return 'Off: Screen Time not allowed';
  if (!lock.selectedCount) return 'Off: no apps chosen';
  return lock.active ? 'Locked' : 'Locking…';
}

/** Dev builds only (opened from Settings): tools for testing the app. */
export function DevPanel() {
  const colors = useColors();
  const offset = useClockOffset();
  const now = useAppState((s) => s.now);
  const status = useAppState((s) => s.status);
  const profile = useAppState((s) => s.profile);
  const lock = useAppLockState();
  const upcoming = useUpcomingReminders();
  const appTime = new Date(now);
  const next = upcoming.reminders.find((r) => r.at.getTime() > now);

  return (
    <ScreenScroll>
      <View style={{ gap: spacing.sm }}>
        <ThemedText variant="eyebrow" tone="accent">
          Clock
        </ThemedText>
        <Card style={{ gap: spacing.md }}>
          <Row label="App time" value={`${formatWeekdayDate(appTime)}, ${formatTime(appTime.toISOString())}`} />
          <Row label="Offset" value={formatOffset(offset)} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {JUMPS.map(({ label, ms }) => (
              <PressableScale
                key={label}
                accessibilityRole="button"
                onPress={() => shiftClock(ms)}
                style={{
                  flexBasis: '47%',
                  flexGrow: 1,
                  alignItems: 'center',
                  paddingVertical: spacing.md,
                  borderRadius: radius.full,
                  backgroundColor: colors.surfaceTint,
                }}
              >
                <ThemedText variant="headline" tone="accent">
                  {label}
                </ThemedText>
              </PressableScale>
            ))}
          </View>
          {offset !== 0 && <TextButton title="Back to real time" onPress={() => setClockOffset(0)} />}
        </Card>
        <ThemedText variant="footnote" tone="secondary">
          Shifts what the app shows and schedules (today, pace, the morning prompt, reminders) without changing the
          phone&apos;s clock. Sips the Balance detects are still logged at the real time, since the server keeps its
          own clock. The offset stays until you reset it, even across reloads.
        </ThemedText>
      </View>

      <View style={{ gap: spacing.sm }}>
        <ThemedText variant="eyebrow" tone="accent">
          At app time
        </ThemedText>
        <Card style={{ gap: spacing.md }}>
          <Row label="Status" value={status?.status ?? '—'} />
          <Row
            label="Drunk / expected"
            value={status ? `${formatMl(status.total_ml)} / ${formatMl(status.expected_ml)} ml` : '—'}
          />
          <Row
            label="Hours behind"
            value={
              status && profile
                ? (
                    Math.max(0, status.expected_ml - status.total_ml) /
                    (status.goal_ml / (profile.end_hour - profile.start_hour))
                  ).toFixed(1)
                : '—'
            }
          />
          <Row label="Active hours" value={profile ? `${profile.start_hour}:00 – ${profile.end_hour}:00` : '—'} />
          <Row label="App lock" value={lockSummary(!!status?.should_lock, !!profile?.lock_enabled, lock)} />
          <Row
            label="Next reminder"
            value={
              !upcoming.allowed
                ? 'Notifications off'
                : next
                  ? `${formatTime(next.at.toISOString())} · ${next.notice}`
                  : 'None scheduled'
            }
          />
          <Row label="Scheduled" value={String(upcoming.reminders.length)} />
        </Card>
        <ThemedText variant="footnote" tone="secondary">
          Pace is judged only inside active hours and once at least 300 ml is expected; the lock needs
          &ldquo;critical&rdquo; (4 or more hours of pace behind). Jumping the clock doesn&apos;t fire reminders on the
          way: each fires at its real time, so the next one comes within one reminder interval.
        </ThemedText>
      </View>

      <View style={{ gap: spacing.sm }}>
        <ThemedText variant="eyebrow" tone="accent">
          Intake
        </ThemedText>
        <PressableScale
          accessibilityRole="button"
          onPress={() => logSip(250)}
          style={{ alignItems: 'center', paddingVertical: spacing.md, borderRadius: radius.full, backgroundColor: colors.surfaceTint }}
        >
          <ThemedText variant="headline" tone="accent">
            Log a 250 ml sip
          </ThemedText>
        </PressableScale>
        <ThemedText variant="footnote" tone="secondary">
          Logged as a manual sip at the app time above, so it counts toward the day the clock shows (up to 7 days
          either way). Undo it from Today&apos;s log.
        </ThemedText>
      </View>
    </ScreenScroll>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
      <ThemedText variant="body" tone="secondary">
        {label}
      </ThemedText>
      <ThemedText variant="headline" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </ThemedText>
    </View>
  );
}
