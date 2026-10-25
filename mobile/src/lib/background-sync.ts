import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { hydrate } from '@/data/session';
import { getState } from '@/data/store';
import { requestSync } from '@/data/sync';

import { applyAppLock } from './app-blocker';

/**
 * Periodic background sync (the OS decides when; at most every ~15 min). Flushes the
 * outbox, pulls the latest status, and applies or lifts the app lock, so blocking
 * keeps up with the scale even while Sip isn't open.
 */
const TASK = 'sip-background-sync';

TaskManager.defineTask(TASK, async () => {
  try {
    if (!getState().token) hydrate(); // cold background launch: nothing loaded yet
    if (!getState().token) return BackgroundTask.BackgroundTaskResult.Success;
    await requestSync();
    const { status, profile } = getState();
    await applyAppLock(!!(status?.should_lock && profile?.lock_enabled));
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundSync() {
  try {
    if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available) return;
    if (!(await TaskManager.isTaskRegisteredAsync(TASK))) {
      await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 15 });
    }
  } catch (error) {
    console.warn('[background-sync] unavailable', error);
  }
}
