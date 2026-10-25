import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';

/**
 * The app's "now": real time plus an offset set from the Developer panel (dev builds only),
 * for testing day rollovers, pace and reminders without touching the phone's clock.
 * The offset moves what the app shows and schedules; what it records (sips, sync times)
 * stays on real time, and the server keeps its own clock.
 */
const OFFSET_KEY = 'sip.devClockOffset';
const listeners = new Set<() => void>();
let offsetMs = __DEV__ ? storedOffset() : 0;

function storedOffset() {
  try {
    return Number(Storage.getItemSync(OFFSET_KEY)) || 0;
  } catch {
    return 0;
  }
}

export const appNow = () => Date.now() + offsetMs;
export const appDate = () => new Date(appNow());
export const getClockOffset = () => offsetMs;

/** Called after the offset changes (views re-derive, reminders reschedule). */
export function onClockChange(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useClockOffset() {
  return useSyncExternalStore(onClockChange, getClockOffset);
}

export function setClockOffset(ms: number) {
  if (!__DEV__ || ms === offsetMs) return;
  offsetMs = ms;
  try {
    Storage.setItemSync(OFFSET_KEY, String(ms));
  } catch (error) {
    console.warn('[clock] could not save the offset', error);
  }
  listeners.forEach((listener) => listener());
}

export const shiftClock = (ms: number) => setClockOffset(offsetMs + ms);
