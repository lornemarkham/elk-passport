"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMotionValue, useSpring, useTransform } from "framer-motion";
import type { MotionParams } from "./mapPersonalityToParams";
import type { WorldObjectHandle } from "./world/WorldStage";

const NEAR_THRESHOLD = 0.06;
const NOTICE_PULSE_MS = 500;

/**
 * The reusable behavior system — Phase 1 revision. Raw pointer sensing now
 * comes from the shared world tick (`worldObject.rawProximity/rawDx/rawDy`),
 * computed once per frame for every registered object, not from a private
 * `window.addEventListener("mousemove", ...)` this hook used to keep for
 * itself. Everything downstream — the notice delay, the curiosity lean, the
 * linger-then-exhale spring — is unchanged: personality still interprets
 * the same shared signal differently per experience.
 */
export function usePersonalityEngine(
  params: MotionParams,
  worldObject: WorldObjectHandle,
  prefersReducedMotion: boolean,
) {
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

  // Attention: smooths the shared raw proximity signal through a personality-tuned spring.
  const proximitySpring = useSpring(worldObject.rawProximity, {
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

  // Subscribes to the shared, tick-driven sensing signal instead of owning a listener.
  useEffect(() => {
    if (prefersReducedMotion) return;

    const updateLean = () => {
      const dx = worldObject.rawDx.get();
      const dy = worldObject.rawDy.get();
      const normalized = worldObject.rawProximity.get();
      const distance = Math.hypot(dx, dy);
      if (params.leanDistancePx > 0 && distance > 0) {
        leanX.set((dx / distance) * params.leanDistancePx * normalized);
        leanY.set((dy / distance) * params.leanDistancePx * normalized);
      }
    };

    const unsubscribeDx = worldObject.rawDx.on("change", updateLean);
    const unsubscribeProximity = worldObject.rawProximity.on(
      "change",
      (normalized) => {
        updateLean();

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
      },
    );

    return () => {
      unsubscribeDx();
      unsubscribeProximity();
    };
  }, [
    worldObject.rawDx,
    worldObject.rawDy,
    worldObject.rawProximity,
    prefersReducedMotion,
    params.leanDistancePx,
    params.noticeDelayMs,
    leanX,
    leanY,
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
    combined,
    leanXSpring,
    leanYSpring,
    focusSpring,
    isNear,
    isFocused,
    justNoticed,
    surpriseTick,
    flourishTick,
    handlePointerEnter,
    handlePointerLeave,
    triggerFlourish,
  };
}
