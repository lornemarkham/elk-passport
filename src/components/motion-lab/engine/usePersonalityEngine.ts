"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useMotionValue, useSpring, useTransform } from "framer-motion";
import { mapPersonalityToParams } from "./mapPersonalityToParams";
import type { ExperienceDefinition } from "./types";

const NEAR_THRESHOLD = 0.06;
const NOTICE_PULSE_MS = 500;

/**
 * The reusable behavior system. Every experience runs through this exact
 * hook — the only thing that differs between Campfire and Helicopter is the
 * `MotionParams` derived from their personality, not the code that consumes
 * them. This is what makes it an engine rather than five bespoke effects.
 */
export function usePersonalityEngine(
  experience: ExperienceDefinition,
  cardRef: RefObject<HTMLDivElement | null>,
) {
  const params = useMemo(
    () =>
      mapPersonalityToParams(
        experience.personality,
        experience.identity.physics,
      ),
    [experience],
  );

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
  const [flourishTick, setFlourishTick] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  // Attention: how close the cursor is, continuously.
  const proximity = useMotionValue(0);
  const proximitySpring = useSpring(proximity, {
    stiffness: params.followStiffness,
    damping: 20,
    mass: 0.6,
  });

  // Curiosity: which way the cursor is, so the core can lean toward it — not just glow at it.
  const leanX = useMotionValue(0);
  const leanY = useMotionValue(0);
  const leanXSpring = useSpring(leanX, {
    stiffness: params.leanStiffness,
    damping: params.leanDamping,
    mass: 0.5,
  });
  const leanYSpring = useSpring(leanY, {
    stiffness: params.leanStiffness,
    damping: params.leanDamping,
    mass: 0.5,
  });

  // Focus: real hover, reached through a spring so its decay is the "soft exhale."
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

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (event: MediaQueryListEvent) =>
      setPrefersReducedMotion(event.matches);
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

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

  // Mystery: reschedules at a new random interval every time, so it never settles into a detectable rhythm.
  useEffect(() => {
    if (prefersReducedMotion) return;

    const scheduleNext = () => {
      const delay =
        params.surpriseMinMs +
        Math.random() * (params.surpriseMaxMs - params.surpriseMinMs);
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
  }, [prefersReducedMotion, params.surpriseMinMs, params.surpriseMaxMs]);

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
      const dx = event.clientX - centerX;
      const dy = event.clientY - centerY;
      const distance = Math.hypot(dx, dy);
      const halfDiagonal = Math.hypot(rect.width / 2, rect.height / 2);
      const edgeDistance = Math.max(0, distance - halfDiagonal);
      const normalized =
        1 - Math.min(1, edgeDistance / params.awarenessRadiusPx);

      proximity.set(normalized);

      // Curiosity: lean toward the cursor's actual direction, strongest up close, capped at leanDistancePx.
      if (params.leanDistancePx > 0 && distance > 0) {
        const unitX = dx / distance;
        const unitY = dy / distance;
        leanX.set(unitX * params.leanDistancePx * normalized);
        leanY.set(unitY * params.leanDistancePx * normalized);
      }

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
          }, params.noticeDelayMs);
        } else if (noticeTimeoutRef.current !== null) {
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
  }, [
    proximity,
    leanX,
    leanY,
    prefersReducedMotion,
    cardRef,
    params.awarenessRadiusPx,
    params.leanDistancePx,
    params.noticeDelayMs,
  ]);

  const handlePointerEnter = useCallback(() => {
    if (lingerTimeoutRef.current !== null) {
      window.clearTimeout(lingerTimeoutRef.current);
      lingerTimeoutRef.current = null;
    }
    focus.set(1);
    setIsFocused(true);
  }, [focus]);

  const handlePointerLeave = useCallback(() => {
    // Warmer personalities linger longer before letting go — the "soft exhale" lasts as long as the warmth does.
    const lingerMs = 300 + params.settleSoftness * 700;
    lingerTimeoutRef.current = window.setTimeout(() => {
      focus.set(0);
      setIsFocused(false);
      lingerTimeoutRef.current = null;
    }, lingerMs);
  }, [focus, params.settleSoftness]);

  /** Rolls against Playfulness — call at a moment worth rewarding (a hover, a toss). Not every roll lands. */
  const triggerFlourish = useCallback(() => {
    if (Math.random() < params.flourishChance) {
      setFlourishTick((tick) => tick + 1);
    }
  }, [params.flourishChance]);

  return {
    params,
    combined,
    leanXSpring,
    leanYSpring,
    focusSpring,
    isNear,
    isFocused,
    justNoticed,
    surpriseTick,
    flourishTick,
    prefersReducedMotion,
    handlePointerEnter,
    handlePointerLeave,
    triggerFlourish,
  };
}
