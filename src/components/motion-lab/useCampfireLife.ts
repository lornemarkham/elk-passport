"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useMotionValue, useSpring, useTransform } from "framer-motion";

/** How far out (in px, beyond the card's own edge) the cursor's approach starts registering at all. */
const AWARENESS_RADIUS_PX = 260;

/** Proximity above this counts as "nearby" for notice/breathing-tier purposes. */
const NEAR_THRESHOLD = 0.06;

/** How long a just-departed hover stays warm before letting go — the "Linger" phase, distinct from the spring-driven "soft exhale" that follows it. */
const LINGER_MS = 650;

/**
 * The pause before the fire visibly reacts to an approaching cursor — "not
 * instantly, not dramatically, almost like someone looked up." Without this,
 * a continuous proximity ramp just looks like a hover effect with a bigger
 * radius, which is exactly what Sprint 1 felt flat doing.
 */
const NOTICE_DELAY_MS = 320;
const NOTICE_PULSE_MS = 500;

/** A rare, randomized, not-user-triggered beat — "I wonder if that always happens." */
const SURPRISE_MIN_MS = 14000;
const SURPRISE_MAX_MS = 26000;

/**
 * The non-visual "attention" system behind Campfire's personality: how close
 * the cursor is, whether it's actually hovering, whether the fire has just
 * noticed someone approaching, and an occasional unprompted surprise beat.
 * Kept separate from rendering so LivingExperience stays about composing a
 * performance, not managing timers.
 */
export function useCampfireLife(cardRef: RefObject<HTMLDivElement | null>) {
  const rectRef = useRef<DOMRect | null>(null);
  const isNearRef = useRef(false);
  const lingerTimeoutRef = useRef<number | null>(null);
  const noticeTimeoutRef = useRef<number | null>(null);
  const noticePulseTimeoutRef = useRef<number | null>(null);
  const surpriseTimeoutRef = useRef<number | null>(null);

  const [isNear, setIsNear] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [justNoticed, setJustNoticed] = useState(false);
  const [surpriseTick, setSurpriseTick] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  const proximity = useMotionValue(0);
  const proximitySpring = useSpring(proximity, {
    stiffness: 90,
    damping: 18,
    mass: 0.6,
  });

  const focus = useMotionValue(0);
  const focusSpring = useSpring(focus, {
    stiffness: 55,
    damping: 16,
    mass: 0.9,
  });

  const combined = useTransform<number, number>(
    [proximitySpring, focusSpring],
    ([p, f]) => Math.max(p, f),
  );

  // Reduced-motion preference — subscribe only, never set synchronously in the effect body.
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (event: MediaQueryListEvent) =>
      setPrefersReducedMotion(event.matches);
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  // Every pending timer must die with the component.
  useEffect(() => {
    return () => {
      if (lingerTimeoutRef.current !== null)
        window.clearTimeout(lingerTimeoutRef.current);
      if (noticeTimeoutRef.current !== null)
        window.clearTimeout(noticeTimeoutRef.current);
      if (noticePulseTimeoutRef.current !== null)
        window.clearTimeout(noticePulseTimeoutRef.current);
      if (surpriseTimeoutRef.current !== null)
        window.clearTimeout(surpriseTimeoutRef.current);
    };
  }, []);

  // The surprise scheduler: reschedules itself at a new random interval each
  // time, so it never settles into a detectable rhythm.
  useEffect(() => {
    if (prefersReducedMotion) return;

    const scheduleNext = () => {
      const delay =
        SURPRISE_MIN_MS + Math.random() * (SURPRISE_MAX_MS - SURPRISE_MIN_MS);
      surpriseTimeoutRef.current = window.setTimeout(() => {
        setSurpriseTick((tick) => tick + 1);
        scheduleNext();
      }, delay);
    };
    scheduleNext();

    return () => {
      if (surpriseTimeoutRef.current !== null)
        window.clearTimeout(surpriseTimeoutRef.current);
    };
  }, [prefersReducedMotion]);

  useEffect(() => {
    const measure = () => {
      rectRef.current = cardRef.current?.getBoundingClientRect() ?? null;
    };
    measure();
    window.addEventListener("resize", measure);

    if (prefersReducedMotion) {
      return () => window.removeEventListener("resize", measure);
    }

    const handleMouseMove = (event: MouseEvent) => {
      const rect = rectRef.current;
      if (!rect) return;

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distance = Math.hypot(
        event.clientX - centerX,
        event.clientY - centerY,
      );
      const halfDiagonal = Math.hypot(rect.width / 2, rect.height / 2);
      const edgeDistance = Math.max(0, distance - halfDiagonal);
      const normalized = 1 - Math.min(1, edgeDistance / AWARENESS_RADIUS_PX);

      proximity.set(normalized);

      const near = normalized > NEAR_THRESHOLD;
      if (near !== isNearRef.current) {
        isNearRef.current = near;
        setIsNear(near);

        if (near) {
          noticeTimeoutRef.current = window.setTimeout(() => {
            setJustNoticed(true);
            noticePulseTimeoutRef.current = window.setTimeout(
              () => setJustNoticed(false),
              NOTICE_PULSE_MS,
            );
            noticeTimeoutRef.current = null;
          }, NOTICE_DELAY_MS);
        } else if (noticeTimeoutRef.current !== null) {
          // Cursor passed by before the fire ever "looked up" — patient, not reactive to every twitch.
          window.clearTimeout(noticeTimeoutRef.current);
          noticeTimeoutRef.current = null;
        }
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [proximity, prefersReducedMotion, cardRef]);

  const handlePointerEnter = useCallback(() => {
    if (lingerTimeoutRef.current !== null) {
      window.clearTimeout(lingerTimeoutRef.current);
      lingerTimeoutRef.current = null;
    }
    focus.set(1);
    setIsFocused(true);
  }, [focus]);

  const handlePointerLeave = useCallback(() => {
    lingerTimeoutRef.current = window.setTimeout(() => {
      focus.set(0);
      setIsFocused(false);
      lingerTimeoutRef.current = null;
    }, LINGER_MS);
  }, [focus]);

  return {
    combined,
    focusSpring,
    isNear,
    isFocused,
    justNoticed,
    surpriseTick,
    prefersReducedMotion,
    handlePointerEnter,
    handlePointerLeave,
  };
}
