import { say } from '@/lib/voice';

import { request } from './api';
import { requestSync } from './sync';

/**
 * Forwards each Balance reading from Bluetooth to the server's `POST /weight`, where drink
 * detection runs (server/tracker.py). The reply carries any drink or refill it detected,
 * so the phone can react at once, even in the background with the WebSocket closed.
 * Readings arrive about twice a second; one still in flight means the next is dropped
 * (detection only needs a steady stream, not every reading).
 */
type WeightResponse = {
  ok: boolean;
  event: { type: 'drink' | 'refill'; ml: number; drank_ml?: number; at: string } | null;
  needs_refill: boolean;
};

let inflight = false;
let neededRefill = false;

export async function relayReading(grams: number) {
  if (inflight || !(grams >= -100 && grams <= 6000)) return;
  inflight = true;
  try {
    const { event, needs_refill } = await request<WeightResponse>('/weight', {
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
  } catch {
    // Offline or server down: the reading is gone, the next one tries again.
  } finally {
    inflight = false;
  }
}
