import { useEffect } from 'react';

import { useAppState } from '@/data/store';
import { applyAppLock } from '@/lib/app-blocker';

/**
 * Keeps Screen Time shields in step with the (offline-aware) status: lock when the
 * user opted in and has fallen critically behind, unlock on the next drink.
 */
export function useLockEnforcement() {
  const shouldLock = useAppState((s) => !!(s.token && s.status?.should_lock && s.profile?.lock_enabled));
  useEffect(() => {
    void applyAppLock(shouldLock);
  }, [shouldLock]);
}
