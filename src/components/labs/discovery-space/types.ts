/**
 * Autonomous idle personality — independent of hover/proximity, always
 * running quietly in the background. "still" means no extra signal at all;
 * not every card should feel alive in the same way, or at all.
 */
export type LifeType = "still" | "ember" | "shimmer" | "breathing" | "whisper";

export interface Experience {
  id: string;
  name: string;
  tagline: string;
  /** Tailwind `from-*`/`to-*` pair driving the card's colored aura. */
  glow: string;
  life: LifeType;
  /**
   * Which Peripheral Temptation environmental event this place supports, if
   * any. Absence means the card is never eligible for a temptation event —
   * eligibility is data-driven, not hardcoded in the scheduler.
   */
  temptation?: TemptationKind;
  /**
   * Optional looping background video — a "living photograph" treatment
   * (see `@/components/passport/PassportVideoCard`). Absence means the
   * card renders its normal abstract glow only.
   */
  video?: string;
}

/**
 * A single brief environmental event a place can witness (see
 * `temptation/` for the scheduler and renderers). Kept alongside the card
 * types rather than duplicated because it extends the same card model.
 */
export type TemptationKind =
  "ember" | "shooting-star" | "window-glow" | "ripple" | "steam" | "glint";

/** The one temptation currently running, owned entirely by the scheduler. */
export type ActiveTemptation = {
  cardId: string;
  kind: TemptationKind;
  instanceId: number;
  durationMs: number;
} | null;

export interface FieldLayout {
  /** Position within the field, percent of container. */
  top: number;
  left: number;
  /** Card width in px; height follows a fixed aspect ratio. */
  size: number;
  /** Base rotation in degrees. */
  rotate: number;
  /** 0 (far, small, hazy) – 1 (near, large, sharp). Drives scale/blur/opacity/z-index. */
  depth: number;
  /** Drift loop duration in seconds — kept independent per card. */
  duration: number;
  /** Drift loop start offset in seconds, so cards move out of sync. */
  delay: number;
  /** Drift amplitude in px. */
  driftX: number;
  driftY: number;
}

export type FieldExperience = Experience & { layout: FieldLayout };
