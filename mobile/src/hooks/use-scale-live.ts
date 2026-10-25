import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { fetchScaleLive } from '@/data/actions';
import { ApiError } from '@/data/api';
import { useScale } from '@/data/scale-ble';
import type { ScaleLive } from '@/data/types';

const POLL_MS = 1_000;

function same(a: ScaleLive | null, b: ScaleLive) {
  return !!a && a.connected === b.connected && a.grams === b.grams && a.stable === b.stable && a.owner === b.owner;
}

/**
 * Live Balance reading for the setup screens. While this phone relays the Balance, the
 * weight comes straight from Bluetooth and "settled" from the server's reply to each
 * relayed reading, so both update with every reading. Otherwise (another phone has the
 * Balance, or the last relay failed) the server is polled once a second while the screen
 * is focused. Re-renders only when the reading actually changes.
 */
export function useScaleLive() {
  const [polled, setPolled] = useState<ScaleLive | null>(null);
  const [error, setError] = useState<string | null>(null);
  const link = useScale((s) => s.link);
  const grams = useScale((s) => s.grams);
  const relayed = useScale((s) => s.relayed);
  const relaying = link === 'connected' && relayed !== null;

  useFocusEffect(
    useCallback(() => {
      if (relaying) return;
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const poll = async () => {
        try {
          const next = await fetchScaleLive(controller.signal);
          setPolled((prev) => (same(prev, next) ? prev : next));
          setError(null);
        } catch (e) {
          if (controller.signal.aborted) return;
          setError(e instanceof ApiError && e.isNetwork ? "You're offline. Connect to see your Balance." : "Can't reach your Balance right now.");
        }
        if (!controller.signal.aborted) timer = setTimeout(poll, POLL_MS);
      };
      void poll();
      return () => {
        controller.abort();
        clearTimeout(timer);
      };
    }, [relaying])
  );

  if (!relaying) return { live: polled, error };
  const live: ScaleLive = {
    water_ml: null,
    empty_g: null,
    owner: false,
    ...polled,
    connected: true,
    grams,
    stable: relayed.stable,
    stable_g: relayed.stable_g,
    needs_refill: relayed.needs_refill,
  };
  return { live, error: null };
}
