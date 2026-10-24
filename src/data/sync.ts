import NetInfo from '@react-native-community/netinfo';
import { AppState, type NativeEventSubscription } from 'react-native';

import { ApiError, request } from './api';
import { writeServerData } from './db';
import * as live from './live';
import { localDay } from './pace';
import { getState, setState } from './store';
import type { Intake, Status, SyncResponse } from './types';

/**
 * Offline-first sync. Local changes land in SQLite + the outbox first (see actions.ts);
 * this engine pushes the outbox and pulls changes in one `POST /sync` round trip.
 *
 * Triggers: start, a local change, reconnect, foreground, a `changed` push over the
 * WebSocket, and a 60 s heartbeat while the socket is down. Requests coalesce: at most
 * one is in flight, and anything requested meanwhile runs once right after it.
 */
const KEEP_INTAKE_DAYS = 35;
const MAX_BATCH = 100;
const HEARTBEAT_MS = 60_000;

let started = false;
let online = true;
let inflight: Promise<void> | null = null;
let rerun = false;
let retryDelay = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let heartbeat: ReturnType<typeof setInterval> | undefined;
let unsubscribeNet: (() => void) | undefined;
let appStateSub: NativeEventSubscription | undefined;
let onUnauthorized: (() => void) | undefined;

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

export function isOnline() {
  return online;
}

export function startSync() {
  if (started) return;
  started = true;
  unsubscribeNet = NetInfo.addEventListener((net) => {
    const wasOnline = online;
    online = net.isConnected !== false && net.isInternetReachable !== false;
    if (online && !wasOnline) {
      requestSync();
      live.connect();
    } else if (!online) {
      setState((s) => ({ sync: { ...s.sync, phase: 'offline' } }));
    }
  });
  appStateSub = AppState.addEventListener('change', (next) => {
    if (next === 'active') {
      tick();
      requestSync();
      live.connect();
    } else if (next === 'background') {
      live.disconnect();
    }
  });
  heartbeat = setInterval(() => {
    tick();
    if (!getState().live) requestSync();
  }, HEARTBEAT_MS);
  live.connect();
  requestSync();
}

export function stopSync() {
  started = false;
  unsubscribeNet?.();
  appStateSub?.remove();
  clearInterval(heartbeat);
  clearTimeout(retryTimer);
  live.disconnect();
  retryDelay = 0;
}

/** Re-derive time-based views (pace, lock, day rollover) from the local clock. */
export function tick() {
  setState({ now: Date.now() });
}

export function requestSync(): Promise<void> {
  if (inflight) {
    rerun = true;
    return inflight;
  }
  inflight = runSync().finally(() => {
    inflight = null;
    if (rerun) {
      rerun = false;
      void requestSync();
    }
  });
  return inflight;
}

async function runSync() {
  const { token, outbox, cursor } = getState();
  if (!token) return;
  if (!online) {
    setState((s) => ({ sync: { ...s.sync, phase: 'offline' } }));
    return;
  }
  clearTimeout(retryTimer);
  setState((s) => ({ sync: { ...s.sync, phase: 'syncing' } }));
  const batch = outbox.slice(0, MAX_BATCH);
  try {
    const response = await request<SyncResponse>('/sync', {
      method: 'POST',
      token,
      body: { mutations: batch, ...(cursor && { since: cursor }) },
    });
    if (getState().token !== token) return; // signed out while this was in flight
    await applySyncResponse(response, batch.map((m) => m.id));
    retryDelay = 0;
    if (getState().outbox.length) rerun = true;
  } catch (error) {
    const apiError = error instanceof ApiError ? error : new ApiError(String(error), 0, 'unknown');
    if (apiError.status === 401) {
      onUnauthorized?.();
      return;
    }
    setState((s) => ({
      sync: { ...s.sync, phase: apiError.isNetwork ? 'offline' : 'error', error: apiError.message },
    }));
    // A non-transient failure (bad request) waits for the next trigger instead of looping.
    if (apiError.isTransient) scheduleRetry();
  }
}

function scheduleRetry() {
  retryDelay = Math.min(60_000, retryDelay ? retryDelay * 2 : 2_000);
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => void requestSync(), retryDelay);
}

/** Apply a pull and drop the outbox entries the server answered (applied, or permanently rejected). */
export async function applySyncResponse(response: SyncResponse, sentIds: string[]) {
  const results = new Map((response.results ?? []).map((r) => [r.id, r]));
  const acked = new Set(sentIds.filter((id) => results.has(id)));
  const prev = getState();
  const rejectedIntakeIds = prev.outbox.flatMap((m) =>
    m.type === 'intake.add' && results.get(m.id)?.ok === false ? [m.payload.id] : []
  );

  const cutoff = localDay(new Date(Date.now() - KEEP_INTAKE_DAYS * 86_400_000));
  const intakes: Record<string, Intake> = {};
  for (const intake of Object.values(prev.intakes)) {
    if (intake.day < cutoff) continue;
    if (response.full && !intake.pending) continue;
    intakes[intake.id] = intake;
  }
  for (const id of rejectedIntakeIds) delete intakes[id];
  for (const intake of response.intakes) intakes[intake.id] = { ...intake, pending: false };

  const daysBase = response.full ? {} : { ...prev.daysBase };
  for (const day of response.days) daysBase[day.day] = day;

  const lastSyncedAt = new Date().toISOString();
  setState((s) => ({
    profileBase: response.user,
    statusBase: response.status,
    daysBase,
    intakes,
    leaderboard: response.leaderboard,
    outbox: s.outbox.filter((m) => !acked.has(m.id)),
    cursor: response.server_time,
    now: Date.now(),
    sync: { phase: 'idle', lastSyncedAt, error: null },
  }));

  await writeServerData({
    full: response.full,
    intakes: response.intakes,
    days: response.days,
    ackedMutationIds: [...acked],
    rejectedIntakeIds,
    kv: {
      profile: response.user,
      status: response.status,
      leaderboard: response.leaderboard,
      cursor: response.server_time,
      lastSyncedAt,
    },
  });
}

/** A pushed status (WebSocket). Views re-apply anything still in the outbox. */
export function applyServerStatus(status: Status) {
  setState({ statusBase: status, now: Date.now() });
}
