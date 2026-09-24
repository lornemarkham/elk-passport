"use client";

import { useEffect, useRef } from "react";
import { PLATE } from "./shelfGeometry";

/**
 * **The store's own nerves.**
 *
 * Two fluorescents, measured off the plate at roughly (566, 115) and (620, 80),
 * plus the exposure of the room as a whole. A working tube in a building this
 * old does not sit still: it holds, then loses a little, then catches. So the
 * exposure wanders by a few per cent, and every so often — rarely, and never
 * on a beat — it drops harder and comes back.
 *
 * That is the whole effect. No fog, no ghosts, no red, no glitch. The right
 * aisle stays exactly as dark as the footage made it, which is the most
 * frightening thing in the frame precisely because nothing is ever shown in
 * it. Uncertainty does the work.
 *
 * Written straight to the element on a frame loop rather than held in state,
 * for the same reason the camera is: nothing else needs to re-render because
 * the lights moved.
 */

export interface AtmosphereHandle {
  /** Pull the room down hard for a moment. Used when something interferes. */
  readonly stagger: () => void;
}

export function Atmosphere({
  dim,
  handle,
}: {
  /** Extra darkness on top of the ambient, 0–1. */
  readonly dim: number;
  readonly handle?: (h: AtmosphereHandle) => void;
}) {
  const shade = useRef<HTMLDivElement>(null);
  const glow = useRef<HTMLDivElement>(null);
  const forced = useRef(0);
  const dimRef = useRef(dim);
  useEffect(() => {
    dimRef.current = dim;
  }, [dim]);

  useEffect(() => {
    handle?.({
      stagger: () => {
        forced.current = performance.now();
      },
    });
  }, [handle]);

  useEffect(() => {
    const quiet = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    // Three slow waves that never line up, so the wander has no period a
    // person can learn. The dips are separate and rare.
    const tick = () => {
      const t = performance.now() / 1000;
      let level = 0;
      if (!quiet) {
        const wander =
          Math.sin(t * 0.7) * 0.012 +
          Math.sin(t * 1.9 + 1.1) * 0.008 +
          Math.sin(t * 4.3 + 2.7) * 0.005;
        // A dip roughly every eleven seconds, a couple of frames long, never
        // quite the same depth.
        const beat = (t % 11.3) / 11.3;
        const dip =
          beat > 0.97 ? (1 - Math.abs(beat - 0.985) / 0.015) * 0.12 : 0;
        const shoved = Math.max(
          0,
          1 - (performance.now() - forced.current) / 420,
        );
        level = wander + dip + shoved * 0.26;
      }
      const total = Math.max(0, Math.min(0.62, dimRef.current + level));
      if (shade.current) shade.current.style.opacity = String(total);
      if (glow.current)
        glow.current.style.opacity = String(Math.max(0, 0.5 - level * 3.4));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <>
      {/* What the tubes throw back into the room. Loses its footing first,
          because a failing tube dims before the room reads as darker. */}
      <div
        ref={glow}
        aria-hidden
        className="absolute inset-0"
        style={{
          pointerEvents: "none",
          // Above everything physical, including a tape in your hand: a change
          // in the light is a change to all of it at once.
          zIndex: 3,
          opacity: 0.5,
          background: [
            `radial-gradient(ellipse ${PLATE.width * 0.17}px ${PLATE.height * 0.1}px at 66% 24%, rgba(216,232,236,0.18), rgba(0,0,0,0) 70%)`,
            `radial-gradient(ellipse ${PLATE.width * 0.12}px ${PLATE.height * 0.07}px at 73% 16%, rgba(216,232,236,0.14), rgba(0,0,0,0) 72%)`,
          ].join(","),
        }}
      />

      {/* The room's exposure. Sits above everything physical, because a change
          in the light is a change to all of it at once. */}
      <div
        ref={shade}
        aria-hidden
        className="absolute inset-0"
        style={{
          pointerEvents: "none",
          zIndex: 3,
          opacity: 0,
          background:
            "radial-gradient(ellipse at 52% 46%, rgba(2,3,5,0.82) 0%, rgba(2,3,5,0.94) 62%, rgba(1,2,3,1) 100%)",
        }}
      />
    </>
  );
}
