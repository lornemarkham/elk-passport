import { useEffect, useRef } from "react";

export interface AmbientEvent<TKind extends string> {
  kind: TKind;
  /** Relative weight — doesn't need to sum to 1. A remaining "do nothing"
   * share is implied whenever the weights provided don't already cover the
   * full roll (see `weightTotal` below). */
  weight: number;
}

export interface UseAmbientSchedulerOptions<TKind extends string> {
  events: AmbientEvent<TKind>[];
  onEvent: (kind: TKind) => void;
  /** How long to wait between rolls, in ms. */
  minDelayMs: number;
  maxDelayMs: number;
  enabled: boolean;
  /** Skip this roll's outcome (still reschedules) — e.g. while dragging. */
  isSuppressed?: () => boolean;
}

/**
 * The one shared "rare, weighted, silence-between-events" idle primitive —
 * this is what makes a card feel like it has a nervous system instead of a
 * timer. Every roll picks at most one event; if the supplied weights don't
 * add up to 1, the remainder is a deliberate "nothing happens this cycle,"
 * which is what keeps idle life from reading as constant background noise.
 *
 * Kept deliberately narrower than a full pub/sub scheduler: this answers
 * "what should one card quietly do next," not "which one card in an entire
 * field gets to have a moment" (a field-wide, single-slot-at-a-time
 * decision belongs to its own scheduler, since it's a different kind of
 * rarity — see Discovery Space's `usePeripheralTemptation`, which this is
 * not intended to replace).
 */
export function useAmbientScheduler<TKind extends string>({
  events,
  onEvent,
  minDelayMs,
  maxDelayMs,
  enabled,
  isSuppressed,
}: UseAmbientSchedulerOptions<TKind>): void {
  const onEventRef = useRef(onEvent);
  const isSuppressedRef = useRef(isSuppressed);
  useEffect(() => {
    onEventRef.current = onEvent;
    isSuppressedRef.current = isSuppressed;
  });

  useEffect(() => {
    if (!enabled || events.length === 0) return;
    let timeout: number;

    const weightTotal = events.reduce((sum, e) => sum + e.weight, 0);

    const schedule = () => {
      const delay = minDelayMs + Math.random() * (maxDelayMs - minDelayMs);
      timeout = window.setTimeout(() => {
        if (!isSuppressedRef.current?.()) {
          const roll = Math.random() * Math.max(1, weightTotal);
          let cursor = 0;
          for (const event of events) {
            cursor += event.weight;
            if (roll < cursor) {
              onEventRef.current(event.kind);
              break;
            }
          }
          // roll >= weightTotal: a deliberate quiet beat, nothing fires.
        }
        schedule();
      }, delay);
    };
    schedule();

    return () => window.clearTimeout(timeout);
    // `events` intentionally omitted: callers pass a fresh array each
    // render (it's small, inline data) and re-scheduling on every one of
    // those renders would restart the quiet-period timer far too often.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, minDelayMs, maxDelayMs]);
}
