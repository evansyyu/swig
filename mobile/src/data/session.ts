import * as SecureStore from 'expo-secure-store';

import { disableAppLock } from '@/lib/app-blocker';
import { scheduleReminders } from '@/lib/reminders';

import { request } from './api';
import { clearAll, readDays, readIntakes, readKv, readOutbox, writeKv } from './db';
import * as live from './live';
import { localDay } from './pace';
import { getState, resetState, setState } from './store';
import { applyServerStatus, requestSync, setUnauthorizedHandler, startSync, stopSync } from './sync';
import type { Leaderboard, Profile, Status } from './types';

const TOKEN_KEY = 'sip.token';

type AuthResponse = { token: string; user: Profile };

function readToken() {
  try {
    return SecureStore.getItem(TOKEN_KEY);
  } catch {
    return null; // keychain unavailable (e.g. before first unlock): treat as signed out
  }
}

/**
 * Load the cached session synchronously so the first frame already shows the last
 * known data, online or not. Call once, before the root layout renders.
 */
export function hydrate() {
  const token = readToken();
  if (!token) {
    resetState();
    return;
  }
  const since = localDay(new Date(Date.now() - 35 * 86_400_000));
  resetState({
    token,
    onboarded: readKv<boolean>('onboarded') ?? false,
    profileBase: readKv<Profile>('profile'),
    statusBase: readKv<Status>('status'),
    leaderboard: readKv<Leaderboard>('leaderboard'),
    cursor: readKv<string>('cursor'),
    baselineSeenDay: readKv<string>('baselineSeenDay'),
    daysBase: Object.fromEntries(readDays().map((d) => [d.day, d])),
    intakes: Object.fromEntries(readIntakes(since).map((i) => [i.id, i])),
    outbox: readOutbox(1000),
    sync: { phase: 'idle', lastSyncedAt: readKv<string>('lastSyncedAt'), error: null },
  });
}

/** Start background sync for a signed-in session. Idempotent. */
export function resume() {
  if (getState().token) startSync();
}

function deviceTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

async function beginSession({ token, user }: AuthResponse, onboarded: boolean) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await clearAll();
  resetState({ token, profileBase: user, onboarded });
  await writeKv({ profile: user, onboarded });
  startSync();
}

export async function signUp(username: string, password: string) {
  const response = await request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: { username: username.trim(), password, timezone: deviceTimezone() },
  });
  await beginSession(response, false);
}

export async function logIn(username: string, password: string) {
  const response = await request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { username: username.trim(), password },
  });
  // Returning users skip onboarding; app selection lives in Settings too.
  await beginSession(response, true);
}

export async function logOut() {
  stopSync();
  scheduleReminders(null);
  await disableAppLock();
  await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
  await clearAll();
  resetState();
}

export async function completeOnboarding() {
  setState({ onboarded: true });
  await writeKv({ onboarded: true });
  void requestSync();
}

setUnauthorizedHandler(() => void logOut());
live.setLiveHandlers({
  onStatus: (status, changed) => {
    applyServerStatus(status);
    if (changed) void requestSync();
  },
  onUnauthorized: () => void logOut(),
});
