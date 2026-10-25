import { randomUUID } from 'expo-crypto';

import { request } from './api';
import { appDate, appNow } from './clock';
import { cancelLocalIntake, writeKv, writeLocalMutation } from './db';
import { localDay } from './pace';
import { getState, setState } from './store';
import { requestSync } from './sync';
import type { Intake, Mutation, Profile, ScaleLive, Settings, Status } from './types';

/**
 * Every user change is applied locally first (memory + SQLite + outbox), so it works
 * offline and shows instantly; sync delivers it. Retries are safe because each change
 * carries a client-generated id the server deduplicates on.
 */
function enqueue(mutation: Mutation, intake?: Intake) {
  setState((s) => ({
    outbox: [...s.outbox, mutation],
    ...(intake && { intakes: { ...s.intakes, [intake.id]: intake } }),
    now: appNow(),
  }));
  void writeLocalMutation(mutation, intake).then(() => requestSync());
}

/** A manual sip (Developer panel), at app time so it lands on the day the dev clock shows. */
export function logSip(amountMl: number) {
  const at = appDate();
  const intake: Intake = {
    id: randomUUID(),
    day: localDay(at),
    kind: 'manual',
    source: 'app',
    amount_ml: amountMl,
    detail_ml: null,
    at: at.toISOString(),
    voided: false,
    updated_at: null,
    pending: true,
  };
  enqueue({ id: randomUUID(), type: 'intake.add', payload: { id: intake.id, amount_ml: amountMl, at: intake.at } }, intake);
}

export function undoIntake(intakeId: string) {
  const { intakes, outbox } = getState();
  const intake = intakes[intakeId];
  if (!intake) return;
  const queuedAdd = outbox.find((m) => m.type === 'intake.add' && m.payload.id === intakeId);
  if (intake.pending && queuedAdd) {
    // Never reached the server: cancel both locally instead of sending add + void.
    const { [intakeId]: _removed, ...rest } = intakes;
    setState((s) => ({ intakes: rest, outbox: s.outbox.filter((m) => m.id !== queuedAdd.id), now: appNow() }));
    void cancelLocalIntake(intakeId, queuedAdd.id);
    return;
  }
  enqueue({ id: randomUUID(), type: 'intake.void', payload: { id: intakeId } });
}

export function updateSettings(patch: Partial<Settings>) {
  if (Object.keys(patch).length) enqueue({ id: randomUUID(), type: 'settings.patch', payload: patch });
}

// ---- online-only (they talk to the scale through the server) ----
export function fetchScaleLive(signal?: AbortSignal) {
  return request<ScaleLive>('/scale/live', { token: getState().token, signal, timeoutMs: 5_000 });
}

/** Save the empty bottle weight: from the scale now, or `weightG` if given. */
export async function saveEmptyBottle(weightG?: number) {
  const result = await request<{ empty_g: number; status: Status }>('/me/bottle/empty', {
    method: 'POST',
    token: getState().token,
    body: weightG === undefined ? undefined : { weight_g: weightG },
  });
  setState((s) => ({
    profileBase: s.profileBase && ({ ...s.profileBase, empty_g: result.empty_g, scale_owner: weightG === undefined || s.profileBase.scale_owner } satisfies Profile),
    statusBase: result.status,
  }));
  void writeKv({ profile: getState().profileBase, status: result.status });
  void requestSync();
  return result.empty_g;
}

export function markBaselineSeen() {
  const day = localDay();
  setState({ baselineSeenDay: day });
  void writeKv({ baselineSeenDay: day });
}
