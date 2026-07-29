"use client";

import { useEffect, useRef, type MouseEvent, type RefObject } from "react";

/** Centre and pan-range for `object-position-x`, in percent. Restrained on
 * purpose — the full width of the source video is never exposed, so the
 * crop never reveals an empty or unbalanced edge. */
const CENTRE_POSITION = 50;
const MIN_POSITION = 35;
const MAX_POSITION = 65;

/** Lerp factor toward the cursor's target position each frame — small and
 * physical, not a spring. Chosen so the pan trails the cursor slightly
 * rather than snapping to it. */
const EASING = 0.08;

interface UseCursorPanResult {
  videoRef: RefObject<HTMLVideoElement | null>;
  handleMouseMove: (event: MouseEvent<HTMLElement>) => void;
  handleMouseLeave: () => void;
}

/**
 * Drives a video's `object-position-x` toward the cursor's horizontal
 * position within its container, smoothed via a requestAnimationFrame lerp.
 * Writes directly to the DOM node's style — never through React state — so
 * mouse movement never triggers a re-render.
 *
 * `enabled` gates the whole effect (no rAF loop starts at all when false),
 * so it's safe to call unconditionally even on cards that never render a
 * video — pass a stable per-instance boolean (e.g. `Boolean(videoSrc)`).
 */
export function useCursorPan(enabled: boolean): UseCursorPanResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const currentPositionRef = useRef(CENTRE_POSITION);
  const targetPositionRef = useRef(CENTRE_POSITION);
  const animationFrameRef = useRef<number | null>(null);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = query.matches;
    const handleChange = (event: MediaQueryListEvent) => {
      reducedMotionRef.current = event.matches;
      if (event.matches) {
        targetPositionRef.current = CENTRE_POSITION;
      }
    };
    query.addEventListener("change", handleChange);

    const animate = () => {
      const current = currentPositionRef.current;
      const target = targetPositionRef.current;
      const next = current + (target - current) * EASING;
      currentPositionRef.current = next;

      if (videoRef.current) {
        videoRef.current.style.objectPosition = `${next}% center`;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      query.removeEventListener("change", handleChange);
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [enabled]);

  const handleMouseMove = (event: MouseEvent<HTMLElement>) => {
    if (!enabled || reducedMotionRef.current) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const relativeX = (event.clientX - rect.left) / rect.width;
    const clampedX = Math.min(1, Math.max(0, relativeX));

    targetPositionRef.current =
      MIN_POSITION + clampedX * (MAX_POSITION - MIN_POSITION);
  };

  const handleMouseLeave = () => {
    if (!enabled) return;
    targetPositionRef.current = CENTRE_POSITION;
  };

  return { videoRef, handleMouseMove, handleMouseLeave };
}
