/**
 * App lock. iOS implements it with Screen Time in app-blocker.ios.ts; Android has no
 * equivalent public API, so this default is an inert stand-in with the same surface.
 */
export type AppLockState = {
  authorization: 'notDetermined' | 'denied' | 'approved';
  selectedCount: number;
  /** Shields are currently applied. */
  active: boolean;
};

export const isAppBlockingSupported = false;

const inert: AppLockState = { authorization: 'notDetermined', selectedCount: 0, active: false };

export function useAppLockState(): AppLockState {
  return inert;
}

export async function chooseApps(): Promise<number | null> {
  return null;
}

export async function applyAppLock(_locked: boolean) {}

export async function disableAppLock() {}
