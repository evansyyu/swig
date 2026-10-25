import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import phrases from '@/assets/sounds/phrases.json';
import { computeStatus, hourFloat } from '@/data/pace';
import type { Settings } from '@/data/types';

/**
 * The mascot's voice. Each phrase is an ElevenLabs clip bundled as a notification sound
 * (assets/sounds, made by server/make_phrases.py), so it plays through whatever the phone
 * plays on (the paired JBL), even while the app is closed. Reminders are scheduled ahead
 * on the device; live moments (a sip, a low bottle) play at once.
 */
export type Phrase = keyof typeof phrases;

const TITLES: Record<Phrase, string> = {
  reminder: 'Time for water',
  behind: 'Falling behind',
  critical: 'Way behind',
  locked: 'Apps locked',
  refill: 'Refill your bottle',
  sip: 'Nice sip',
  goal: 'Goal reached',
};
/** iOS keeps at most 64 pending notifications per app. */
const MAX_SCHEDULED = 48;
const DAY_MS = 86_400_000;

let ready = false;

/** Show and sound notifications while open too, set up Android channels, and ask permission. */
export async function setupVoice() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    // A channel's sound is fixed once created, so each phrase gets its own channel.
    await Promise.all(
      (Object.keys(phrases) as Phrase[]).map((key) =>
        Notifications.setNotificationChannelAsync(key, {
          name: TITLES[key],
          importance: AndroidImportance.HIGH,
          sound: `${key}.wav`,
        })
      )
    );
  }
  const current = await Notifications.getPermissionsAsync();
  ready = current.granted || (current.canAskAgain && (await Notifications.requestPermissionsAsync()).granted);
  return ready;
}

function content(key: Phrase): Notifications.NotificationContentInput {
  return { title: TITLES[key], body: phrases[key], sound: `${key}.wav` };
}

/** Speak a phrase now. */
export function say(key: Phrase) {
  if (!ready) return;
  void Notifications.scheduleNotificationAsync({
    content: content(key),
    trigger: Platform.OS === 'android' ? { channelId: key } : null,
  }).catch(() => undefined);
}

export type ReminderPlan = Pick<Settings, 'goal_ml' | 'interval_min' | 'start_hour' | 'end_hour'> & {
  totalMl: number;
  lastDrinkAt: string | null;
};

/**
 * Upcoming reminders, mirroring the server's `next_reminder_at` (server/accounts.py): one
 * interval after the last drink (or the day's start), then every interval until the day
 * ends. Tomorrow is included so reminders keep coming if the app isn't opened.
 */
export function reminderTimes(plan: ReminderPlan, now = new Date()): { at: Date; totalMl: number }[] {
  const interval = plan.interval_min * 60_000;
  const start = new Date(now);
  start.setHours(plan.start_hour, 0, 0, 0);
  const end = new Date(now);
  end.setHours(plan.end_hour, 0, 0, 0);
  const times: { at: Date; totalMl: number }[] = [];

  if (plan.totalMl < plan.goal_ml) {
    const last = plan.lastDrinkAt ? Date.parse(plan.lastDrinkAt) : 0;
    let next = Math.max(last, start.getTime()) + interval;
    if (next <= now.getTime()) next += interval * Math.ceil((now.getTime() - next) / interval + 1e-9);
    for (; next < end.getTime(); next += interval) times.push({ at: new Date(next), totalMl: plan.totalMl });
  }
  for (let next = start.getTime() + DAY_MS + interval; next < end.getTime() + DAY_MS; next += interval) {
    times.push({ at: new Date(next), totalMl: 0 });
  }
  return times.slice(0, MAX_SCHEDULED);
}

/**
 * Gentle on pace, firmer when behind. "Locked" is only said when the lock really happens
 * (use-voice.ts): a reminder scheduled ahead can't know the lock was applied.
 */
function phraseFor(plan: ReminderPlan, at: Date, totalMl: number): Phrase {
  switch (computeStatus(totalMl, plan.goal_ml, plan.start_hour, plan.end_hour, hourFloat(at))) {
    case 'critical':
      return 'critical';
    case 'behind':
      return 'behind';
    default:
      return 'reminder';
  }
}

// Rescheduling cancels everything first, so runs are serialized and only the latest plan applies.
let pending: ReminderPlan | null | undefined;
let running = false;

/** Replace the scheduled reminders with `plan`'s, or clear them with null. */
export function scheduleReminders(plan: ReminderPlan | null) {
  pending = plan;
  if (!running) void drain();
}

async function drain() {
  running = true;
  try {
    while (pending !== undefined) {
      const plan = pending;
      pending = undefined;
      await Notifications.cancelAllScheduledNotificationsAsync();
      if (!plan || !ready) continue;
      for (const { at, totalMl } of reminderTimes(plan)) {
        if (pending !== undefined) break; // superseded: start over with the newer plan
        const key = phraseFor(plan, at, totalMl);
        await Notifications.scheduleNotificationAsync({
          content: content(key),
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: at,
            ...(Platform.OS === 'android' && { channelId: key }),
          },
        });
      }
    }
  } catch (error) {
    console.warn('[voice] scheduling failed', error);
  } finally {
    running = false;
  }
}
