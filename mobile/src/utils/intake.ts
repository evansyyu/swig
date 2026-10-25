import type { SyncPhase } from '@/data/store';
import type { Intake } from '@/data/types';
import type { Palette } from '@/theme';

import { formatMl } from './format';

export function describeIntake(intake: Intake) {
  switch (intake.kind) {
    case 'baseline':
      return {
        label: intake.detail_ml != null ? `Baseline · ${formatMl(intake.detail_ml)} ml in bottle` : 'Baseline set',
        amount: 'Not counted',
      };
    case 'refill':
      return {
        label: `Refill${intake.detail_ml ? ` · +${formatMl(intake.detail_ml)} ml` : ''}`,
        amount: intake.amount_ml ? `+${formatMl(intake.amount_ml)} ml` : 'Not counted',
      };
    case 'manual':
      return { label: 'Logged in Swig', amount: `+${formatMl(intake.amount_ml)} ml` };
    default:
      return { label: 'Drink detected', amount: `+${formatMl(intake.amount_ml)} ml` };
  }
}

/** Only entries that count toward the day can be removed. */
export const canUndo = (intake: Intake) => intake.amount_ml > 0;

export type WeekBar = {
  day: string;
  /** "Sun"…"Sat" */
  label: string;
  ml: number;
  state: 'met' | 'partial' | 'today' | 'future';
};

export function barColor(state: WeekBar['state'], colors: Palette) {
  return state === 'met' ? colors.accent : state === 'today' ? colors.accentMuted : colors.surfaceSky;
}

export function hourLabel(hour: number) {
  const h = hour % 24;
  return `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? 'AM' : 'PM'}`;
}

export function syncSummary(phase: SyncPhase, pending: number, lastSyncedAt: string | null) {
  if (phase === 'offline') return pending ? `Offline · ${pending} waiting` : 'Offline';
  if (phase === 'syncing') return 'Syncing…';
  if (phase === 'error') return 'Last sync failed';
  if (!lastSyncedAt) return 'Not yet';
  return new Date(lastSyncedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
