import { useEffect, useRef } from "react";

type Tick = (deltaSeconds: number, elapsedSeconds: number) => void;

/**
 * One requestAnimationFrame loop for the entire page, not one per mounted
 * phenomenon. A Discovery field can have ~20 living cards at once; a
 * per-instance rAF loop for each would mean 20 independent callbacks doing
 * their own timing bookkeeping every frame for no benefit, since they all
 * need to tick in lockstep anyway. This is a plain module-level singleton
 * (not React context) on purpose — it has to be reachable from both Motion
 * Lab and Discovery Space without either needing to sit inside the other's
 * provider tree.
 *
 * Pausing on a hidden tab needs no special handling: browsers already
 * suspend `requestAnimationFrame` callbacks for hidden documents, which is
 * exactly the behavior every phenomenon here wants for free.
 */
const subscribers = new Set<Tick>();
let rafId: number | null = null;
let lastTime: number | null = null;
let simElapsedSeconds = 0;

/** A global multiplier on simulated time — 0 pauses every subscriber, 1 is
 * normal speed, <1 is slow motion. Deliberately scales the *simulated*
 * elapsed-time axis too (not just delta), not only the wall-clock delta —
 * a paused world should mean every noise sample, not just every position
 * update, is frozen; a slow-motion world should mean flicker and drift
 * genuinely slow down together, not just move less per real second. This
 * is the Playground's pause/slow-motion control (Prompt 011), added here
 * because "how fast is time" belongs with the clock, not with any one
 * phenomenon. */
let timeScale = 1;

export function setSharedRafTimeScale(scale: number): void {
  timeScale = Math.max(0, scale);
}

export function getSharedRafTimeScale(): number {
  return timeScale;
}

function loop(now: number) {
  if (lastTime === null) lastTime = now;
  const rawDeltaSeconds = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  const deltaSeconds = rawDeltaSeconds * timeScale;
  simElapsedSeconds += deltaSeconds;
  subscribers.forEach((tick) => tick(deltaSeconds, simElapsedSeconds));
  rafId = requestAnimationFrame(loop);
}

export function subscribeToSharedRaf(tick: Tick): () => void {
  subscribers.add(tick);
  if (rafId === null) {
    lastTime = null;
    rafId = requestAnimationFrame(loop);
  }
  return () => {
    subscribers.delete(tick);
    if (subscribers.size === 0 && rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };
}

/** React entry point — subscribes for the lifetime of the component, always
 * calling the latest `tick` without resubscribing on every render. */
export function useSharedRaf(tick: Tick, enabled = true): void {
  const tickRef = useRef(tick);
  useEffect(() => {
    tickRef.current = tick;
  });

  useEffect(() => {
    if (!enabled) return;
    return subscribeToSharedRaf((deltaSeconds, elapsedSeconds) =>
      tickRef.current(deltaSeconds, elapsedSeconds),
    );
  }, [enabled]);
}
