/** Shapes from the WaterAlarmi v2 API (see docs/API.md). */

export type HydrationStatus = 'ahead' | 'ok' | 'behind' | 'critical';

export type Settings = {
  goal_ml: number;
  interval_min: number;
  start_hour: number;
  end_hour: number;
  lock_enabled: boolean;
  timezone: string;
};

export type Profile = Settings & {
  id: string;
  username: string;
  created_at: string;
  empty_g: number | null;
  scale_owner: boolean;
  rank: number | null;
};

export type LastEvent = {
  type: IntakeKind;
  ml: number;
  detail_ml: number | null;
  at: string;
};

export type Status = {
  day: string;
  total_ml: number;
  goal_ml: number;
  expected_ml: number;
  status: HydrationStatus;
  should_lock: boolean;
  last_drink_at: string | null;
  last_event: LastEvent | null;
  next_reminder_at: string | null;
  streak: number;
  best_streak: number;
  empty_g: number | null;
  scale: { connected: boolean; water_ml: number | null; needs_refill: boolean } | null;
};

export type IntakeKind = 'drink' | 'refill' | 'baseline' | 'manual';

export type Intake = {
  id: string;
  day: string;
  kind: IntakeKind;
  source: 'scale' | 'app';
  amount_ml: number;
  detail_ml: number | null;
  at: string;
  voided: boolean;
  updated_at: string | null;
  /** Local only: logged on this device and not yet confirmed by the server. */
  pending?: boolean;
};

export type DayLog = {
  day: string;
  goal_ml: number;
  consumed_ml: number;
  met: boolean;
  met_at: string | null;
  updated_at: string | null;
};

export type LeaderboardEntry = {
  rank: number;
  username: string;
  streak: number;
  best_streak: number;
  is_me: boolean;
};

export type Leaderboard = {
  entries: LeaderboardEntry[];
  me: LeaderboardEntry | null;
  total: number;
};

export type Mutation =
  | { id: string; type: 'intake.add'; payload: { id: string; amount_ml: number; at: string } }
  | { id: string; type: 'intake.void'; payload: { id: string } }
  | { id: string; type: 'settings.patch'; payload: Partial<Settings> };

export type SyncResponse = {
  results?: { id: string; ok: boolean; error?: { code: string; message: string } }[];
  server_time: string;
  full: boolean;
  user: Profile;
  status: Status;
  days: DayLog[];
  intakes: Intake[];
  leaderboard: Leaderboard;
};

/** Bluetooth link to the Balance (see firmware/scale_firmware). */
export type ScaleLink = 'off' | 'scanning' | 'connecting' | 'connected';

/**
 * Where the Balance's calibrate() routine is. `empty`, `weight`, `done` and `cancelled`
 * come from the scale; the others cover the wait after the app answers a prompt.
 */
export type CalibrationStep = 'idle' | 'starting' | 'empty' | 'taring' | 'weight' | 'measuring' | 'done' | 'cancelled';

export type BleScale = {
  link: ScaleLink;
  /** Latest reading the scale sent, in grams. */
  grams: number | null;
  calibration: CalibrationStep;
  error: string | null;
};

export type ScaleLive = {
  connected: boolean;
  grams: number | null;
  stable: boolean;
  stable_g: number | null;
  water_ml: number | null;
  empty_g: number | null;
  needs_refill: boolean;
  owner: boolean;
};
