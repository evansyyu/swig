import { useSyncExternalStore } from 'react';

import { deriveStatus, localDay } from './pace';
import type { DayLog, Intake, Leaderboard, Mutation, Profile, Status } from './types';

export type SyncPhase = 'idle' | 'syncing' | 'offline' | 'error';

type Days = Readonly<Record<string, DayLog>>;

/**
 * `*Base` fields are exactly what the server last said (and what SQLite persists).
 * `profile`, `status`, `days` and `todayIntakes` are views: the base with unconfirmed
 * outbox changes and the local clock applied. Views are recomputed only when one of
 * their inputs changes, so selectors keep stable references between unrelated updates.
 */
export type AppState = {
  token: string | null;
  onboarded: boolean;
  profileBase: Profile | null;
  statusBase: Status | null;
  daysBase: Days;
  /** Server intakes plus local unconfirmed ones (`pending: true`), last ~35 days. */
  intakes: Readonly<Record<string, Intake>>;
  leaderboard: Leaderboard | null;
  /** Local changes the server hasn't confirmed yet, oldest first (mirrors the SQLite outbox). */
  outbox: readonly Mutation[];
  cursor: string | null;
  sync: { phase: SyncPhase; lastSyncedAt: string | null; error: string | null };
  live: boolean;
  baselineSeenDay: string | null;
  /** Clock tick (ms) for time-based views; bumped every minute and on foreground. */
  now: number;

  profile: Profile | null;
  status: Status | null;
  days: Days;
  todayIntakes: readonly Intake[];
};

export const initialState: AppState = {
  token: null,
  onboarded: false,
  profileBase: null,
  statusBase: null,
  daysBase: {},
  intakes: {},
  leaderboard: null,
  outbox: [],
  cursor: null,
  sync: { phase: 'idle', lastSyncedAt: null, error: null },
  live: false,
  baselineSeenDay: null,
  now: Date.now(),
  profile: null,
  status: null,
  days: {},
  todayIntakes: [],
};

let state = initialState;
const listeners = new Set<() => void>();

const VIEW_INPUTS = ['profileBase', 'statusBase', 'daysBase', 'intakes', 'outbox', 'now'] as const;

export function getState() {
  return state;
}

export function setState(update: Partial<AppState> | ((prev: AppState) => Partial<AppState>)) {
  const patch = typeof update === 'function' ? update(state) : update;
  let next: AppState = { ...state, ...patch };
  if (VIEW_INPUTS.some((key) => next[key] !== state[key])) {
    next = { ...next, ...deriveViews(next, state) };
  }
  state = next;
  listeners.forEach((listener) => listener());
}

export function resetState(patch: Partial<AppState> = {}) {
  state = { ...initialState, now: Date.now() };
  setState(patch);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Subscribe to one slice. Selectors must return a primitive or a reference already held
 * in state, so a component re-renders only when that slice actually changes.
 */
export function useAppState<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state));
}

function emptyDay(day: string, goal: number): DayLog {
  return { day, goal_ml: goal, consumed_ml: 0, met: false, met_at: null, updated_at: null };
}

function deriveViews(s: AppState, prev: AppState): Pick<AppState, 'profile' | 'status' | 'days' | 'todayIntakes'> {
  // Settings patches waiting to sync win over the server copy.
  let profile = s.profileBase;
  for (const m of s.outbox) {
    if (m.type === 'settings.patch' && profile) profile = { ...profile, ...m.payload };
  }

  const pendingVoids = new Set<string>();
  const delta: Record<string, number> = {};
  let pendingDrinkAt: string | null = null;
  const today = localDay(new Date(s.now));
  for (const m of s.outbox) {
    if (m.type === 'intake.void') pendingVoids.add(m.payload.id);
  }
  for (const m of s.outbox) {
    if (m.type === 'settings.patch') continue;
    const intake = s.intakes[m.payload.id];
    if (!intake) continue;
    if (m.type === 'intake.add' && intake.pending && !pendingVoids.has(intake.id)) {
      delta[intake.day] = (delta[intake.day] ?? 0) + intake.amount_ml;
      if (intake.day === today && (!pendingDrinkAt || intake.at > pendingDrinkAt)) pendingDrinkAt = intake.at;
    } else if (m.type === 'intake.void' && !intake.pending && !intake.voided) {
      delta[intake.day] = (delta[intake.day] ?? 0) - intake.amount_ml;
    }
  }

  let days: Days = s.daysBase;
  const goal = profile?.goal_ml ?? 2000;
  if (Object.keys(delta).length) {
    const copy = { ...s.daysBase };
    for (const [day, d] of Object.entries(delta)) {
      const base = copy[day] ?? emptyDay(day, goal);
      const consumed = Math.max(0, base.consumed_ml + d);
      copy[day] = { ...base, consumed_ml: consumed, met: consumed >= base.goal_ml };
    }
    days = copy;
  }

  let status = s.statusBase;
  if (status && profile) {
    const total = status.day === today ? Math.max(0, status.total_ml + (delta[today] ?? 0)) : days[today]?.consumed_ml ?? 0;
    status = deriveStatus(status, profile, total, new Date(s.now), pendingDrinkAt);
    if (days[today]?.met && !s.daysBase[today]?.met) {
      status = { ...status, streak: status.streak + 1 }; // goal reached offline: count today
    }
  }

  // Keep the previous array when nothing it depends on changed (stable for memoized lists).
  const todayIntakes =
    s.intakes === prev.intakes && s.outbox === prev.outbox && today === localDay(new Date(prev.now)) && prev.todayIntakes.length
      ? prev.todayIntakes
      : Object.values(s.intakes)
          .filter((i) => i.day === today && !i.voided && !pendingVoids.has(i.id))
          .sort((a, b) => (a.at < b.at ? 1 : -1));

  return { profile, status, days, todayIntakes };
}
