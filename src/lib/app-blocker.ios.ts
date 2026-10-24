import type { EventSubscription } from 'expo';
import { useSyncExternalStore } from 'react';

import ScreenTime, { type AuthorizationStatus, type BlockGroupSummary } from '@modules/screen-time';

import type { AppLockState } from './app-blocker';

/**
 * Screen Time (FamilyControls + ManagedSettings) app lock: one "comfort apps" group
 * the user picks with Apple's picker. Tokens stay native; JS only mirrors counts.
 */
const GROUP = { id: 'comfort', name: 'comfort apps' };

export const isAppBlockingSupported = true;

let authorization: AuthorizationStatus = ScreenTime.getAuthorizationStatus();
// One sync native call at startup: native owns persistence, JS only mirrors the summary.
let group: BlockGroupSummary = ScreenTime.registerGroups([GROUP])[0];
let snapshot: AppLockState = toSnapshot();
const listeners = new Set<() => void>();
let subscription: EventSubscription | null = null;

function toSnapshot(): AppLockState {
  return {
    authorization,
    selectedCount: group.appCount + group.categoryCount + group.webDomainCount,
    active: group.enabled,
  };
}

function commit(next: { authorization?: AuthorizationStatus; group?: BlockGroupSummary }) {
  authorization = next.authorization ?? authorization;
  group = next.group ?? group;
  snapshot = toSnapshot();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  subscription ??= ScreenTime.addListener('onAuthorizationStatusChange', (event) =>
    commit({ authorization: event.status })
  );
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      subscription?.remove();
      subscription = null;
    }
  };
}

export function useAppLockState() {
  return useSyncExternalStore(subscribe, () => snapshot);
}

async function ensureAuthorized() {
  if (authorization === 'approved') return true;
  const next = await ScreenTime.requestAuthorizationAsync();
  commit({ authorization: next });
  return next === 'approved';
}

/** Opens Apple's app picker. Resolves with the number of selected items, or null if cancelled/denied. */
export async function chooseApps() {
  if (!(await ensureAuthorized())) return null;
  const summary = await ScreenTime.presentPickerAsync(GROUP.id);
  if (!summary) return null;
  commit({ group: summary });
  return toSnapshot().selectedCount;
}

/** Shield or unshield the chosen apps. A no-op without access or a selection. */
export async function applyAppLock(locked: boolean) {
  if (group.enabled === locked) return;
  if (locked && (authorization !== 'approved' || toSnapshot().selectedCount === 0)) return;
  try {
    commit({ group: await ScreenTime.setGroupEnabledAsync(GROUP.id, locked) });
  } catch (error) {
    console.warn('[app-lock] could not apply', error);
  }
}

export async function disableAppLock() {
  const [summary] = await ScreenTime.disableAllAsync();
  if (summary) commit({ group: summary });
}
