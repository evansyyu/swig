import { say } from '@/lib/voice';

import { request } from './api';
import { requestSync } from './sync';
import type { Relayed } from './types';

/**
 * Forwards each Balance reading from Bluetooth to the server's `POST /weight`, where drink
 * detection runs (server/tracker.py). The reply carries any drink or refill it detected,
 * so the phone can react at once, even in the background with the WebSocket closed, and
 * whether the weight has settled, for the setup screens. Readings arrive about twice a
 * second; one still in flight means the next is dropped (detection only needs a steady
 * stream, not every reading).
 */
type WeightResponse = Relayed & {
  ok: boolean;
  event: { type: 'drink' | 'refill'; ml: number; drank_ml?: number; at: string } | null;
};

let inflight = false;
let neededRefill = false;

/** The server's verdict on this reading; null if the relay failed, undefined if it was dropped. */
export async function relayReading(grams: number): Promise<Relayed | null | undefined> {
  if (inflight || !(grams >= -100 && grams <= 6000)) return undefined;
  inflight = true;
  try {
    const { event, needs_refill, stable, stable_g } = await request<WeightResponse>('/weight', {
      method: 'POST',
      body: { grams },
      timeoutMs: 5_000,
    });
    if (event) {
      if (event.type === 'drink') say('sip');
      void requestSync(); // the drink is logged server-side; pull it with the new status
    }
    if (needs_refill && !neededRefill) say('refill');
    neededRefill = needs_refill;
    // A server from before `stable` was added: no verdict, so the setup screens keep polling.
    return typeof stable === 'boolean' ? { stable, stable_g, needs_refill } : null;
  } catch {
    // Offline or server down: the reading is gone, the next one tries again.
    return null;
  } finally {
    inflight = false;
  }
}
