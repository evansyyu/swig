import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { fetchScaleLive } from '@/data/actions';
import { ApiError } from '@/data/api';
import type { ScaleLive } from '@/data/types';

const POLL_MS = 1_000;

function same(a: ScaleLive | null, b: ScaleLive) {
  return !!a && a.connected === b.connected && a.grams === b.grams && a.stable === b.stable && a.owner === b.owner;
}

/**
 * Live Balance reading for the setup screens, polled once a second only while the
 * screen is focused. Re-renders only when the reading actually changes.
 */
export function useScaleLive() {
  const [live, setLive] = useState<ScaleLive | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const poll = async () => {
        try {
          const next = await fetchScaleLive(controller.signal);
          setLive((prev) => (same(prev, next) ? prev : next));
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
    }, [])
  );

  return { live, error };
}
