import { useEffect, useRef, useState } from 'react';

import { useAppState } from '@/data/store';
import { say, scheduleReminders, setupVoice } from '@/lib/voice';

/**
 * Keeps spoken reminders scheduled from the (offline-aware) status and settings, and speaks
 * when the goal is reached or the apps lock. Sips and refills are spoken by the scale relay.
 */
export function useVoice() {
  const active = useAppState((s) => !!s.token && s.onboarded);
  const day = useAppState((s) => s.status?.day ?? null);
  const totalMl = useAppState((s) => s.status?.total_ml ?? 0);
  const lastDrinkAt = useAppState((s) => s.status?.last_drink_at ?? null);
  const locked = useAppState((s) => !!(s.status?.should_lock && s.profile?.lock_enabled));
  const goal = useAppState((s) => s.profile?.goal_ml ?? null);
  const interval = useAppState((s) => s.profile?.interval_min ?? null);
  const start = useAppState((s) => s.profile?.start_hour ?? null);
  const end = useAppState((s) => s.profile?.end_hour ?? null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void setupVoice().then((granted) => !cancelled && setReady(granted));
    return () => {
      cancelled = true;
    };
  }, [active]);

  useEffect(() => {
    if (!ready || !active || goal == null || interval == null || start == null || end == null) return;
    scheduleReminders({
      goal_ml: goal,
      interval_min: interval,
      start_hour: start,
      end_hour: end,
      totalMl,
      lastDrinkAt,
    });
  }, [ready, active, day, totalMl, lastDrinkAt, goal, interval, start, end]);

  // Compared with the previous value, so opening the app doesn't replay old news.
  const previous = useRef<{ day: string | null; totalMl: number; locked: boolean } | null>(null);
  useEffect(() => {
    const prev = previous.current;
    previous.current = { day, totalMl, locked };
    if (!ready || !prev || prev.day !== day || goal == null) return;
    if (prev.totalMl < goal && totalMl >= goal) say('goal');
    else if (!prev.locked && locked) say('locked');
  }, [ready, day, totalMl, locked, goal]);
}
