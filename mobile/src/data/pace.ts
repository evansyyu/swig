import { appDate } from './clock';
import type { HydrationStatus, Settings, Status } from './types';

/**
 * Client copy of the server's status rules (WaterAlarmi server/tracker.py), used only
 * to keep the UI and the app lock honest while offline. The server stays the source of truth.
 */
const MIN_EXPECTED_ML = 300;
/** This many hours of pace short = critical (locks the comfort apps). */
const CRITICAL_HOURS_BEHIND = 4;

export function hourFloat(date: Date) {
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

export function expectedMl(goal: number, start: number, end: number, hour: number) {
  const fraction = Math.min(1, Math.max(0, (hour - start) / (end - start)));
  return Math.round(goal * fraction);
}

export function computeStatus(total: number, goal: number, start: number, end: number, hour: number): HydrationStatus {
  if (total >= goal) return 'ahead';
  const expected = expectedMl(goal, start, end, hour);
  if (hour < start || hour >= end || expected < MIN_EXPECTED_ML) return 'ok';
  const ratio = total / expected;
  if (ratio >= 1.1) return 'ahead';
  // How far intake trails the pace line, in hours: the shortfall over the hourly pace.
  const hoursBehind = (expected - total) / (goal / (end - start));
  if (hoursBehind >= CRITICAL_HOURS_BEHIND) return 'critical';
  if (ratio >= 0.8) return 'ok';
  return 'behind';
}

/** Local calendar day as YYYY-MM-DD (matches the server's per-user "day"). */
export function localDay(date = appDate()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Re-derive time-dependent fields of a cached status for `now`, applying `total`.
 * Mirrors the server's lock state machine: lock on entering critical, unlock on a drink or leaving it.
 */
export function deriveStatus(
  prev: Status,
  settings: Pick<Settings, 'goal_ml' | 'start_hour' | 'end_hour'>,
  total: number,
  now: Date,
  /** Time of an unconfirmed local drink today, which unlocks like a scale drink does. */
  pendingDrinkAt: string | null = null
): Status {
  const today = localDay(now);
  const rolledOver = prev.day !== today;
  const goal = settings.goal_ml; // today's goal always follows the setting (server does the same)
  const hour = hourFloat(now);
  const status = computeStatus(total, goal, settings.start_hour, settings.end_hour, hour);
  const wasCritical = !rolledOver && prev.status === 'critical';
  let shouldLock = rolledOver ? false : prev.should_lock;
  if (status === 'critical' && !wasCritical) shouldLock = true;
  if (status !== 'critical' || pendingDrinkAt) shouldLock = false;
  return {
    ...prev,
    day: today,
    total_ml: total,
    goal_ml: goal,
    expected_ml: expectedMl(goal, settings.start_hour, settings.end_hour, hour),
    status,
    should_lock: shouldLock,
    last_drink_at: pendingDrinkAt ?? (rolledOver ? null : prev.last_drink_at),
    last_event: rolledOver ? null : prev.last_event,
  };
}
