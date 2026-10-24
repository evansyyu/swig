/** Choices offered in onboarding and settings (PRD: 1.5–3 L goal, a nudge every 1–3 h). */
export const GOAL_OPTIONS = [1500, 1750, 2000, 2250, 2500, 2750, 3000] as const;
export const INTERVAL_OPTIONS = [60, 90, 120, 150, 180] as const;
export const START_HOURS = [5, 6, 7, 8, 9, 10, 11, 12] as const;
export const END_HOURS = [17, 18, 19, 20, 21, 22, 23, 24] as const;

export const SIP_AMOUNTS = [150, 250, 500] as const;
export const DEFAULT_SIP = 250;

export const DEFAULT_GOAL = 2000;
export const DEFAULT_INTERVAL = 120;
