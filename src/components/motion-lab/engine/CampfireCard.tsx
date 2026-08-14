"use client";

import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type PanInfo,
} from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ExperienceDefinition } from "./types";
import { mapPersonalityToParams } from "./mapPersonalityToParams";
import {
  useWorldObject,
  useStageRef,
  useStageReducedMotion,
} from "./world/WorldStage";
import { WorldWindow } from "@/components/motion/WorldWindow";
import { Fire } from "@/components/motion/phenomena/fire/Fire";
import { Embers } from "@/components/motion/phenomena/Embers";
import { Glow } from "@/components/motion/phenomena/Glow";
import { useAmbientScheduler } from "@/components/motion/primitives/useAmbientScheduler";
import { useFieldEnvironment } from "@/components/motion/world/FieldEnvironment";
import { useCardAttention } from "@/components/motion/world/AttentionField";
import cardStyles from "./LivingCard.module.css";

const TOSS_VELOCITY_THRESHOLD = 250;
const FAST_DRAG_SPEED = 700;
/** How close (as a fraction of this card's own awareness radius) the
 * cursor has to be — or a drag has to be underway — before this card
 * reports itself as a candidate for Featured. Deliberately stricter than
 * the "near" threshold that drives Fire/Glow's own hover brightening:
 * being Featured is a field-level claim, not just local noticing. */
const FEATURED_PROXIMITY_THRESHOLD = 0.55;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Prompt 009 — Campfire, proven here first before graduating into
 * Discovery Space. The Sprint 007 version replaced the shared personality
 * engine's CSS-keyframe flame with a bespoke one, but it was still
 * CSS-keyframe underneath — three layers jumping between hand-authored
 * poses, which is exactly what read as "independent keyframes" rather than
 * a continuous phenomenon. This version replaces the flame shape itself
 * with `Fire` (a canvas heat simulation driven by continuous noise, from
 * `@/components/motion`) and moves embers/glow onto the same shared
 * primitives — so this card is now a *composition* of reusable phenomena,
 * not a bespoke one-off.
 *
 * Prompt 010/011 — this card is also now Living-World aware: it reads a
 * shared `FieldEnvironment` (wind + a slow field-wide mood) if one is in
 * scope, and reports its own interaction state to an `AttentionField` so
 * it can become Featured/Supporting/Ambient relative to any sibling cards
 * on the same stage. Both are optional — every prop this card reads from
 * them has a graceful "no field present" fallback, so solo usage (every
 * existing Motion Lab tab) is completely unaffected.
 *
 * What stays local to this file: the card's own drag physics (lag,
 * stretch, skew — how the *atmosphere* responds to being pulled) and the
 * toss/fast-drag/idle event wiring. Those are card-specific behavior, not
 * reusable phenomena, so they don't belong in the shared library.
 */
export function CampfireCard({
  experience,
  instanceId,
}: {
  experience: ExperienceDefinition;
  /** Distinguishes this card from siblings sharing the same `experience`
   * (e.g. two Campfire cards side by side in the Pair Stage). Defaults to
   * the experience's own id, which is unique enough for every existing
   * solo-card usage. */
  instanceId?: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const stageRef = useStageRef();
  const prefersReducedMotion = useStageReducedMotion();
  const [isDragging, setIsDragging] = useState(false);

  const params = useMemo(
    () =>
      mapPersonalityToParams(
        experience.personality,
        experience.identity.physics,
      ),
    [experience],
  );

  const worldObject = useWorldObject(params.awarenessRadiusPx);
  useEffect(() => {
    worldObject.reportRect(
      () => cardRef.current?.getBoundingClientRect() ?? null,
    );
  }, [worldObject]);

  // The stage element, for the WorldWindow/Embers portal target. `stageRef`
  // is owned by the ancestor `WorldStageProvider`, not this component — a
  // *layout* effect here would be wrong: layout effects fire bottom-up
  // within a single commit, so a descendant's layout effect can run
  // before its ancestor's own ref has been attached. A passive `useEffect`
  // is correct: React only fires passive effects after every layout
  // effect in the whole tree has completed, by which point every ref,
  // ancestor or not, is guaranteed attached — no artificial delay (the
  // earlier code's `setTimeout(0)` wrapper) is needed on top of that.
  const [stageEl, setStageEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    setStageEl(stageRef.current);
  }, [stageRef]);

  // Atmosphere lag — the fire trails the card's own motion on a loose
  // spring, not glued to it. `WorldWindow` already tracks the card's live
  // position every frame; this is the *extra* offset on top of that,
  // which is what makes it read as "being pulled" rather than "attached."
  const lagXTarget = useMotionValue(0);
  const lagYTarget = useMotionValue(0);
  const lagX = useSpring(lagXTarget, { stiffness: 30, damping: 8, mass: 1 });
  const lagY = useSpring(lagYTarget, { stiffness: 30, damping: 8, mass: 1 });

  // Curiosity — a small, soft lean toward the cursor on hover, well before
  // any drag. Capped tiny on purpose: this should read as noticing, not
  // chasing.
  const leanXRaw = useMotionValue(0);
  const leanYRaw = useMotionValue(0);
  const leanX = useSpring(leanXRaw, { stiffness: 40, damping: 12, mass: 0.6 });
  const leanY = useSpring(leanYRaw, { stiffness: 40, damping: 12, mass: 0.6 });

  useEffect(() => {
    if (prefersReducedMotion) return;
    const update = () => {
      const dx = worldObject.rawDx.get();
      const dy = worldObject.rawDy.get();
      const p = worldObject.rawProximity.get();
      const dist = Math.hypot(dx, dy);
      if (dist > 0) {
        leanXRaw.set((dx / dist) * 9 * p);
        leanYRaw.set((dy / dist) * 5 * p);
      }
    };
    const unDx = worldObject.rawDx.on("change", update);
    const unProximity = worldObject.rawProximity.on("change", update);
    return () => {
      unDx();
      unProximity();
    };
  }, [
    worldObject.rawDx,
    worldObject.rawDy,
    worldObject.rawProximity,
    prefersReducedMotion,
    leanXRaw,
    leanYRaw,
  ]);

  const atmosphereX = useTransform<number, number>(
    [lagX, leanX],
    ([lag, lean]) => lag + lean,
  );
  const atmosphereY = useTransform<number, number>(
    [lagY, leanY],
    ([lag, lean]) => lag + lean,
  );

  // Stretch/skew — how elongated and bent the fire is along its direction
  // of travel. Pure drag feedback; resets the instant the gesture ends (or
  // overshoots once, for a toss — see handleDragEnd).
  const stretchTarget = useMotionValue(1);
  const stretch = useSpring(stretchTarget, {
    stiffness: 90,
    damping: 14,
    mass: 0.5,
  });
  const skewTarget = useMotionValue(0);
  const skew = useSpring(skewTarget, {
    stiffness: 90,
    damping: 14,
    mass: 0.5,
  });

  // This card's own, purely local excitement — hover proximity and drag
  // energy. This is what gets broadcast to the AttentionField as this
  // card's "intensity" (what a Supporting neighbor's light-spill reads),
  // deliberately *before* any field/social blending below — what a card
  // shares with its neighbors should be its own genuine state, not
  // something already inflated by whatever it received from someone else.
  const proximitySpring = useSpring(worldObject.rawProximity, {
    stiffness: 45,
    damping: 22,
    mass: 0.8,
  });
  const dragEnergyTarget = useMotionValue(0);
  const dragEnergy = useSpring(dragEnergyTarget, {
    stiffness: 60,
    damping: 14,
    mass: 0.5,
  });
  const localAttention = useTransform<number, number>(
    [proximitySpring, dragEnergy],
    ([p, d]) => Math.max(p, d),
  );

  // Living World (Prompt 010/011) — both optional, both graceful with
  // nothing present.
  const fieldEnvironment = useFieldEnvironment();
  const fallbackEnergy = useMotionValue(0);
  const fallbackWindAngle = useMotionValue(0);
  const fallbackWindStrength = useMotionValue(0);
  const fieldEnergyMv = fieldEnvironment?.fieldEnergy ?? fallbackEnergy;
  const windAngleMv = fieldEnvironment?.windAngle ?? fallbackWindAngle;
  const windStrengthMv = fieldEnvironment?.windStrength ?? fallbackWindStrength;

  const resolvedId = instanceId ?? experience.identity.id;
  const { attentionState, featuredIntensity, reportInteracting } =
    useCardAttention(resolvedId, localAttention);
  const isSupporting = attentionState === "supporting";

  // Supporting quiets rather than freezes: a small, spring-smoothed dip on
  // the shared attention channel (never enough to zero Fire's own noise
  // floor) plus, more legibly, a slower idle-event cadence below — this
  // card is choosing not to compete for the spotlight, not going dark.
  const socialTarget = useMotionValue(0);
  const social = useSpring(socialTarget, {
    stiffness: 40,
    damping: 14,
    mass: 0.6,
  });
  useEffect(() => {
    socialTarget.set(isSupporting ? -0.08 : 0);
  }, [isSupporting, socialTarget]);

  // Light spill: mirrors the Featured neighbor's own intensity into a
  // stable local motion value, spring-smoothed so a neighbor's hover
  // doesn't snap this card's warmth on and off.
  const lightSpillTarget = useMotionValue(0);
  const lightSpill = useSpring(lightSpillTarget, {
    stiffness: 50,
    damping: 18,
    mass: 0.7,
  });
  useEffect(() => {
    if (!featuredIntensity) {
      lightSpillTarget.set(0);
      return;
    }
    const update = () => lightSpillTarget.set(featuredIntensity.get() * 0.3);
    update();
    return featuredIntensity.on("change", update);
  }, [featuredIntensity, lightSpillTarget]);

  // What Fire/Embers/Glow actually receive — local excitement plus a
  // gentle lift from the field's own mood, plus supporting/light-spill.
  // fieldEnergy is deliberately additive and lightly weighted, not
  // multiplicative: multiplying would silence it whenever local attention
  // is 0 (i.e. almost always), which would defeat its whole purpose of
  // being felt as ambient, field-wide breathing.
  const attention = useTransform<number, number>(
    [localAttention, fieldEnergyMv, social, lightSpill],
    ([local, energy, soc, spill]) =>
      clamp01(local + energy * 0.22 + soc + spill),
  );

  const [emberBurstTrigger, setEmberBurstTrigger] = useState(0);
  const [emberBurstCount, setEmberBurstCount] = useState(1);

  const isDraggingRef = useRef(false);
  const firedFastBurstRef = useRef(false);

  // Reports Featured candidacy from real proximity, independent of drag.
  useEffect(() => {
    if (prefersReducedMotion) return;
    const update = () => {
      const proximity = worldObject.rawProximity.get();
      reportInteracting(
        proximity > FEATURED_PROXIMITY_THRESHOLD || isDraggingRef.current,
      );
    };
    return worldObject.rawProximity.on("change", update);
  }, [worldObject.rawProximity, prefersReducedMotion, reportInteracting]);

  const handleDrag = useCallback(
    (_event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
      const { x: vx, y: vy } = info.velocity;
      const speed = Math.hypot(vx, vy);

      lagXTarget.set(Math.max(-90, Math.min(90, -vx / 14)));
      lagYTarget.set(Math.max(-90, Math.min(90, -vy / 14)));
      stretchTarget.set(1 + Math.min(0.6, speed / 2200));
      skewTarget.set(Math.max(-14, Math.min(14, vx / 60)));
      dragEnergyTarget.set(Math.min(1, speed / 900));

      // Fast drag gets one extra, distinct beat the first moment it
      // crosses the threshold — not just "more of the same particles."
      if (speed > FAST_DRAG_SPEED && !firedFastBurstRef.current) {
        firedFastBurstRef.current = true;
        setEmberBurstCount(4);
        setEmberBurstTrigger((tick) => tick + 1);
      } else if (speed < FAST_DRAG_SPEED * 0.6) {
        firedFastBurstRef.current = false;
      }
    },
    [lagXTarget, lagYTarget, stretchTarget, skewTarget, dragEnergyTarget],
  );

  const onDragStart = () => {
    isDraggingRef.current = true;
    setIsDragging(true);
    worldObject.setDragging(true);
    firedFastBurstRef.current = false;
    reportInteracting(true);
  };

  const handleDragEnd = (
    _event: PointerEvent | MouseEvent | TouchEvent,
    info: PanInfo,
  ) => {
    isDraggingRef.current = false;
    setIsDragging(false);
    worldObject.setDragging(false);
    skewTarget.set(0);
    reportInteracting(
      worldObject.rawProximity.get() > FEATURED_PROXIMITY_THRESHOLD,
    );

    const speed = Math.hypot(info.velocity.x, info.velocity.y);

    if (speed > TOSS_VELOCITY_THRESHOLD) {
      // Toss — the hero moment. The fire briefly separates ahead of the
      // card along the throw's own direction before snapping back and
      // reconnecting, its own intensity spikes, and a shower of embers
      // follows the same arc.
      const overshootX = Math.max(-150, Math.min(150, -info.velocity.x / 6));
      const overshootY = Math.max(-150, Math.min(150, -info.velocity.y / 6));
      lagXTarget.set(overshootX);
      lagYTarget.set(overshootY);
      stretchTarget.set(1.7);
      dragEnergyTarget.set(1);
      window.setTimeout(() => {
        lagXTarget.set(0);
        lagYTarget.set(0);
        stretchTarget.set(1);
        dragEnergyTarget.set(0);
      }, 220);

      setEmberBurstCount(10 + Math.round(Math.min(10, speed / 200)));
      setEmberBurstTrigger((tick) => tick + 1);
    } else {
      // A normal release — the fire settles and reconnects on its own,
      // not because the input ended.
      lagXTarget.set(0);
      lagYTarget.set(0);
      stretchTarget.set(1);
      dragEnergyTarget.set(0);
    }
  };

  // Idle life — sparse and irregular on purpose, one of a small set of
  // possible outcomes each roll (including "nothing"), so the fire never
  // reads as running on a timer. Fire's own flicker no longer needs a
  // scheduled event — the noise simulation is already continuous — this
  // is only for the occasional *extra* escaping ember. Supporting a
  // Featured neighbor stretches the interval rather than disabling it —
  // quieter, not gone (Prompt 010's explicit "must not freeze").
  useAmbientScheduler({
    events: [{ kind: "ember", weight: 0.4 }],
    onEvent: () => {
      setEmberBurstCount(1);
      setEmberBurstTrigger((tick) => tick + 1);
    },
    minDelayMs: isSupporting ? 6500 : 3400,
    maxDelayMs: isSupporting ? 15000 : 9000,
    enabled: !prefersReducedMotion,
    isSuppressed: () => isDraggingRef.current,
  });

  const { identity } = experience;

  return (
    <motion.div
      ref={cardRef}
      className={`${cardStyles.card} ${isDragging ? cardStyles.dragging : ""}`}
      drag={!prefersReducedMotion}
      dragConstraints={stageRef}
      dragElastic={0.28}
      dragTransition={{ bounceStiffness: 70, bounceDamping: 12 }}
      onDragStart={onDragStart}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      whileDrag={{ scale: 1.015 }}
      style={
        prefersReducedMotion
          ? undefined
          : { x: worldObject.x, y: worldObject.y }
      }
      aria-label={identity.title}
    >
      <div className={cardStyles.surface} />

      <WorldWindow anchorRef={cardRef} portalContainer={stageEl} zIndex={5}>
        <motion.div
          style={
            prefersReducedMotion
              ? undefined
              : { x: atmosphereX, y: atmosphereY, scaleY: stretch, skewX: skew }
          }
        >
          <Glow
            hue={identity.hue.glow}
            hueSoft={identity.hue.glowSoft}
            attention={attention}
            baseOpacity={0.32}
            peakOpacity={0.7}
            reducedMotion={prefersReducedMotion}
          />
          <Fire attention={attention} reducedMotion={prefersReducedMotion} />
        </motion.div>
      </WorldWindow>

      <Embers
        anchorRef={cardRef}
        portalContainer={stageEl}
        originYPercent={0.3}
        spawnRate={0.03}
        attention={attention}
        windAngle={windAngleMv}
        windStrength={windStrengthMv}
        burstTrigger={emberBurstTrigger}
        burstCount={emberBurstCount}
        color={identity.material.color}
        colorSoft={identity.material.colorSoft}
        reducedMotion={prefersReducedMotion}
      />

      <div className={cardStyles.textLayer}>
        <h2 className={cardStyles.title}>{identity.title}</h2>
        <p className={cardStyles.futureMemory}>{identity.futureMemory}</p>
      </div>
    </motion.div>
  );
}
