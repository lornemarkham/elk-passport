/**
 * Discovery Lab v0.4 — Peripheral Temptation timing.
 * Tune freely; nothing outside this file should need to change to
 * re-pace the experiment.
 */

export const FIRST_TEMPTATION_MIN_DELAY_MS = 8_000;
export const FIRST_TEMPTATION_MAX_DELAY_MS = 14_000;

export const NEXT_TEMPTATION_MIN_DELAY_MS = 12_000;
export const NEXT_TEMPTATION_MAX_DELAY_MS = 25_000;

export const TEMPTATION_MIN_DURATION_MS = 1_500;
export const TEMPTATION_MAX_DURATION_MS = 3_000;

/** Delay before retrying when no card was eligible for an event. */
export const NO_ELIGIBLE_RETRY_MIN_DELAY_MS = 12_000;
export const NO_ELIGIBLE_RETRY_MAX_DELAY_MS = 25_000;

/**
 * Development-only. Shortens timing and enables the `T` debug key so the
 * experiment can be reviewed without waiting. Must be `false` for any real
 * build — flip it locally, never commit it `true`.
 */
export const TEMPTATION_DEBUG = false;

export const DEBUG_FIRST_TEMPTATION_MIN_DELAY_MS = 800;
export const DEBUG_FIRST_TEMPTATION_MAX_DELAY_MS = 1_500;
export const DEBUG_NEXT_TEMPTATION_MIN_DELAY_MS = 1_500;
export const DEBUG_NEXT_TEMPTATION_MAX_DELAY_MS = 3_000;
