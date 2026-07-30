"use client";

import { useCallback, useRef, type RefObject } from "react";
import { useMotionValue, useSpring, type PanInfo } from "framer-motion";
import type { MotionParams } from "./mapPersonalityToParams";
import { useWorldTrail } from "./WorldTrailLayer";

/**
 * The physical body under drag — Sprint 004. Separate from
 * `usePersonalityEngine` (ambient life, awareness) on purpose: this hook is
 * only concerned with what happens while something is actually being moved
 * — tilt, bend, stretch, and what gets left behind — not with breathing or
 * noticing the cursor.
 *
 * The key idea: tilt/skew/squash are each driven toward an instantaneous
 * target every drag frame, but reach it through a spring whose stiffness
 * and damping come from `MotionParams` (ultimately from PhysicsCharacter).
 * That single choice is what makes release feel different per experience —
 * a rigid body's spring snaps the deformation back to zero almost
 * instantly; a liquid body's spring is underdamped and keeps rotating long
 * after the card itself has stopped. No special-casing per experience is
 * needed; it falls out of the spring config.
 */
export function usePhysicsBody(
  params: MotionParams,
  cardRef: RefObject<HTMLDivElement | null>,
  stageRef: RefObject<HTMLDivElement | null>,
) {
  const lastSampleRef = useRef<{ vx: number; vy: number; t: number } | null>(
    null,
  );
  const lastDepositRef = useRef(0);

  const deformSpringConfig = {
    stiffness: params.tiltLagStiffness,
    damping: params.tiltLagDamping,
    mass: 0.6,
  };

  const tiltTarget = useMotionValue(0);
  const tilt = useSpring(tiltTarget, deformSpringConfig);

  const skewTarget = useMotionValue(0);
  const skew = useSpring(skewTarget, deformSpringConfig);

  const scaleXTarget = useMotionValue(1);
  const scaleX = useSpring(scaleXTarget, deformSpringConfig);

  const scaleYTarget = useMotionValue(1);
  const scaleY = useSpring(scaleYTarget, deformSpringConfig);

  // Glow lag: the glow is a child of the card, so it moves *with* it for
  // free — this is what makes it visibly trail a beat behind instead,
  // countering the card's own velocity within its local frame. A slower,
  // heavier spring than the body's own deformation, so "the glow hasn't
  // caught up yet" reads as a distinct, secondary motion.
  const glowLagXTarget = useMotionValue(0);
  const glowLagX = useSpring(glowLagXTarget, {
    stiffness: params.tiltLagStiffness * 0.55,
    damping: params.tiltLagDamping * 0.85,
    mass: 0.9,
  });
  const glowLagYTarget = useMotionValue(0);
  const glowLagY = useSpring(glowLagYTarget, {
    stiffness: params.tiltLagStiffness * 0.55,
    damping: params.tiltLagDamping * 0.85,
    mass: 0.9,
  });

  const { deposits, deposit, expire } = useWorldTrail();

  const handleDrag = useCallback(
    (_event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
      const now = performance.now();
      const { x: vx, y: vy } = info.velocity;
      const speed = Math.hypot(vx, vy);

      const last = lastSampleRef.current;
      const dt = last ? Math.max(1, now - last.t) / 1000 : 1 / 60;
      const ax = last ? (vx - last.vx) / dt : 0;
      lastSampleRef.current = { vx, vy, t: now };

      // Tilt: banks/leans in the direction of travel, capped by personality.
      const tiltDeg = Math.max(
        -params.tiltMaxDeg,
        Math.min(params.tiltMaxDeg, (vx / 1200) * params.tiltMaxDeg),
      );
      tiltTarget.set(tiltDeg);

      // Skew: a sharp change in velocity (not speed itself) reads as a bend under load.
      const skewDeg = Math.max(
        -8,
        Math.min(8, (ax / 3200) * params.skewSensitivity * 45),
      );
      skewTarget.set(skewDeg);

      // Glow lag: countered against the card's own velocity, within its local frame.
      glowLagXTarget.set(Math.max(-40, Math.min(40, -vx / 40)));
      glowLagYTarget.set(Math.max(-40, Math.min(40, -vy / 40)));

      // Squash/stretch: elongates along the direction of travel at speed.
      const stretch = Math.min(
        params.squashAmount,
        (speed / 1600) * params.squashAmount,
      );
      scaleXTarget.set(1 + stretch);
      scaleYTarget.set(1 - stretch * 0.6);

      // Detachment: once moving energetically enough for this material, shed
      // a world-space particle at the card's current position — rate-limited
      // so "how often" is governed by trailEmissionRate, not a per-frame coin
      // flip that could flood the layer at 60fps.
      if (
        speed > params.detachThresholdPxPerS &&
        stageRef.current &&
        cardRef.current
      ) {
        const minIntervalMs = Math.max(40, 260 - params.trailEmissionRate * 40);
        if (now - lastDepositRef.current > minIntervalMs) {
          lastDepositRef.current = now;
          const stageRect = stageRef.current.getBoundingClientRect();
          const cardRect = cardRef.current.getBoundingClientRect();
          const originX = cardRect.left + cardRect.width / 2 - stageRect.left;
          const originY = cardRect.top + cardRect.height / 2 - stageRect.top;
          deposit(originX, originY);
        }
      }
    },
    [
      params,
      tiltTarget,
      skewTarget,
      scaleXTarget,
      scaleYTarget,
      glowLagXTarget,
      glowLagYTarget,
      deposit,
      cardRef,
      stageRef,
    ],
  );

  const handleDragEnd = useCallback(() => {
    lastSampleRef.current = null;
    tiltTarget.set(0);
    skewTarget.set(0);
    scaleXTarget.set(1);
    scaleYTarget.set(1);
    glowLagXTarget.set(0);
    glowLagYTarget.set(0);
  }, [
    tiltTarget,
    skewTarget,
    scaleXTarget,
    scaleYTarget,
    glowLagXTarget,
    glowLagYTarget,
  ]);

  return {
    tilt,
    skew,
    scaleX,
    scaleY,
    glowLagX,
    glowLagY,
    handleDrag,
    handleDragEnd,
    deposits,
    expireDeposit: expire,
  };
}
