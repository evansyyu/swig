import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { appDate, getClockOffset, onClockChange } from '@/data/clock';
import { computeStatus, hourFloat } from '@/data/pace';
import type { Settings } from '@/data/types';

/**
 * Hydration notifications. Reminders are scheduled ahead on the device, so they arrive even
 * while the app is closed; live moments (a low bottle, the goal, the lock) are shown at once.
 */
export type Notice = 'reminder' | 'behind' | 'critical' | 'locked' | 'refill' | 'goal';

const NOTICES: Record<Notice, { title: string; body: string }> = {
  reminder: { title: 'Time for water', body: 'Hey! Time for a sip of water.' },
  behind: { title: 'Falling behind', body: "You're falling behind on water. Grab your bottle and take a few sips." },
  critical: { title: 'Way behind', body: "You're way behind on water. Drink some right now!" },
  locked: { title: 'Apps locked', body: 'Your apps are locked until you drink some water.' },
  refill: { title: 'Refill your bottle', body: 'Your bottle is almost empty. Time to refill!' },
  goal: { title: 'Goal reached', body: 'You hit your water goal for today. Amazing!' },
};
/** iOS keeps at most 64 pending notifications per app. */
const MAX_SCHEDULED = 48;
const DAY_MS = 86_400_000;
const CHANNEL = 'reminders';

let ready = false;

/** Show notifications while open too, set up the Android channel, and ask permission. */
export async function setupNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Reminders', importance: AndroidImportance.HIGH });
  }
  const current = await Notifications.getPermissionsAsync();
  ready = current.granted || (current.canAskAgain && (await Notifications.requestPermissionsAsync()).granted);
  setUpcoming({ ...upcoming, allowed: ready });
  return ready;
}

/** What's scheduled, in app time (Developer panel). `allowed` is false when notifications are off. */
export type UpcomingReminders = { allowed: boolean; reminders: readonly { at: Date; notice: Notice }[] };
let upcoming: UpcomingReminders = { allowed: false, reminders: [] };
const upcomingListeners = new Set<() => void>();

function setUpcoming(next: UpcomingReminders) {
  upcoming = next;
  upcomingListeners.forEach((listener) => listener());
}

export function useUpcomingReminders() {
  return useSyncExternalStore(
    (listener) => {
      upcomingListeners.add(listener);
      return () => upcomingListeners.delete(listener);
    },
    () => upcoming
  );
}

function content(key: Notice): Notifications.NotificationContentInput {
  return { ...NOTICES[key], sound: 'default' };
}

/** Show a notice now. */
export function notify(key: Notice) {
  if (!ready) return;
  void Notifications.scheduleNotificationAsync({
    content: content(key),
    trigger: Platform.OS === 'android' ? { channelId: CHANNEL } : null,
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
export function reminderTimes(plan: ReminderPlan, now = appDate()): { at: Date; totalMl: number }[] {
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
 * Gentle on pace, firmer when behind. "Locked" is only sent when the lock really happens
 * (use-reminders.ts): a reminder scheduled ahead can't know the lock was applied.
 */
function noticeFor(plan: ReminderPlan, at: Date, totalMl: number): Notice {
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
let lastPlan: ReminderPlan | null | undefined;
let running = false;

/** Replace the scheduled reminders with `plan`'s, or clear them with null. */
export function scheduleReminders(plan: ReminderPlan | null) {
  pending = plan;
  lastPlan = plan;
  if (!running) void drain();
}

// Moving the dev clock moves every upcoming reminder.
onClockChange(() => lastPlan !== undefined && scheduleReminders(lastPlan));

async function drain() {
  running = true;
  try {
    while (pending !== undefined) {
      const plan = pending;
      pending = undefined;
      await Notifications.cancelAllScheduledNotificationsAsync();
      if (!plan || !ready) {
        setUpcoming({ allowed: ready, reminders: [] });
        continue;
      }
      const scheduled: { at: Date; notice: Notice }[] = [];
      for (const { at, totalMl } of reminderTimes(plan)) {
        if (pending !== undefined) break; // superseded: start over with the newer plan
        const key = noticeFor(plan, at, totalMl);
        scheduled.push({ at, notice: key });
        await Notifications.scheduleNotificationAsync({
          content: content(key),
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(at.getTime() - getClockOffset()), // `at` is app time; iOS fires on real time
            ...(Platform.OS === 'android' && { channelId: CHANNEL }),
          },
        });
      }
      if (pending === undefined) setUpcoming({ allowed: true, reminders: scheduled });
    }
  } catch (error) {
    console.warn('[reminders] scheduling failed', error);
  } finally {
    running = false;
  }
}
