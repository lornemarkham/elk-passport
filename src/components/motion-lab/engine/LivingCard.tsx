"use client";

import {
  motion,
  useMotionTemplate,
  useTransform,
  type PanInfo,
} from "framer-motion";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { ExperienceDefinition } from "./types";
import { mapPersonalityToParams } from "./mapPersonalityToParams";
import { usePersonalityEngine } from "./usePersonalityEngine";
import { usePhysicsBody } from "./usePhysicsBody";
import {
  useWorldObject,
  useStageRef,
  useStageReducedMotion,
} from "./world/WorldStage";
import { WorldTrailLayer } from "./WorldTrailLayer";
import { ParticleField } from "./ParticleField";
import { BeaconSweep } from "./BeaconSweep";
import { HeatHaze } from "./HeatHaze";
import { WineSwirl } from "./WineSwirl";
import styles from "./LivingCard.module.css";

const TOSS_VELOCITY_THRESHOLD = 250;

export function LivingCard({
  experience,
}: {
  experience: ExperienceDefinition;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [tossTrigger, setTossTrigger] = useState(0);

  const stageRef = useStageRef();
  const prefersReducedMotion = useStageReducedMotion();

  const params = useMemo(
    () =>
      mapPersonalityToParams(
        experience.personality,
        experience.identity.physics,
      ),
    [experience],
  );

  // Real, persistent stage position — Phase 1's core shift away from
  // "always relative to origin." Home is {0,0}: the object's own natural
  // (flexbox-centered) layout position, so this composes with existing
  // layout for free — no absolute stage coordinates to compute yet.
  const worldObject = useWorldObject(params.awarenessRadiusPx);

  useEffect(() => {
    worldObject.reportRect(
      () => cardRef.current?.getBoundingClientRect() ?? null,
    );
  }, [worldObject]);

  // The stage element, for the world-trail portal target. Refs can't be
  // read during render, so this is tracked as state, set once after mount.
  const [stageEl, setStageEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    const timeout = window.setTimeout(() => setStageEl(stageRef.current), 0);
    return () => window.clearTimeout(timeout);
  }, [stageRef]);

  const {
    combined,
    leanXSpring,
    leanYSpring,
    justNoticed,
    surpriseTick,
    flourishTick,
    handlePointerEnter,
    handlePointerLeave,
    triggerFlourish,
  } = usePersonalityEngine(params, worldObject, prefersReducedMotion);

  const {
    tilt,
    skew,
    scaleX: bodyScaleX,
    scaleY: bodyScaleY,
    glowLagX,
    glowLagY,
    handleDrag,
    handleDragEnd: handlePhysicsDragEnd,
    deposits,
    expireDeposit,
  } = usePhysicsBody(params, cardRef, stageRef);

  const { identity } = experience;

  const liftY = useTransform(combined, [0, 1], [0, -14]);
  const liftScale = useTransform(combined, [0, 1], [1, 1.014]);
  // The engagement lift and the object's own world position both want the
  // "y" channel — sum them, the same pattern already used for glow offset.
  const totalY = useTransform<number, number>(
    [worldObject.y, liftY],
    ([world, lift]) => world + lift,
  );
  const totalScaleX = useTransform<number, number>(
    [liftScale, bodyScaleX],
    ([lift, body]) => lift * body,
  );
  const totalScaleY = useTransform<number, number>(
    [liftScale, bodyScaleY],
    ([lift, body]) => lift * body,
  );
  const glowOffsetX = useTransform<number, number>(
    [leanXSpring, glowLagX],
    ([lean, lag]) => lean + lag,
  );
  const glowOffsetY = useTransform<number, number>(
    [leanYSpring, glowLagY],
    ([lean, lag]) => lean + lag,
  );
  const brightness = useTransform(
    combined,
    [0, 1],
    [1, params.brightnessCeiling],
  );
  const shadowY = useTransform(combined, [0, 1], [22, 48]);
  const shadowBlur = useTransform(
    combined,
    [0, 1],
    [params.glowBlurPx * 1.4, params.glowBlurPx * 2.6],
  );
  const shadowAlpha = useTransform(combined, [0, 1], [0.2, 0.5]);
  const glowOpacity = useTransform(
    combined,
    [0, 1],
    [params.glowOpacityCeiling * 0.55, params.glowOpacityCeiling],
  );
  const filter = useMotionTemplate`brightness(${brightness})`;
  const boxShadow = useMotionTemplate`0 ${shadowY}px ${shadowBlur}px -10px rgba(${identity.hue.glow}, ${shadowAlpha})`;

  // Chaos shapes the breathing curve itself — a clean two-point pulse at low
  // chaos, an irregular multi-bump wobble at high chaos. Deterministic (not
  // randomized per mount), so it stays a pure function of personality.
  const amp = params.breathAmplitude;
  const j = params.jitter;
  const breatheScale = [1, 1 + amp, 1 - amp * 0.4 * j, 1 + amp * 0.7 * j, 1];

  const dragElastic = 0.36 - Math.min(0.3, (params.dragMass / 2.6) * 0.3);
  const dragGrabScale = 1 + 0.05 * (1 - Math.min(1, params.dragMass / 2.6));

  const onPointerEnter = () => {
    handlePointerEnter();
    triggerFlourish();
  };

  const onDragStart = () => {
    setIsDragging(true);
    worldObject.setDragging(true);
  };

  const handleDragEnd = (
    _event: PointerEvent | MouseEvent | TouchEvent,
    info: PanInfo,
  ) => {
    setIsDragging(false);
    worldObject.setDragging(false);
    handlePhysicsDragEnd();
    if (
      Math.hypot(info.velocity.x, info.velocity.y) > TOSS_VELOCITY_THRESHOLD
    ) {
      setTossTrigger((tick) => tick + 1);
    }
    triggerFlourish();
  };

  const beaconDuration = Math.max(1.1, 7 - params.particleSpeed * 2.5);
  const wineSwirlDuration = Math.max(10, 26 - params.particleSpeed * 6);

  return (
    <motion.div
      ref={cardRef}
      className={`${styles.card} ${isDragging ? styles.dragging : ""}`}
      onMouseEnter={onPointerEnter}
      onMouseLeave={handlePointerLeave}
      drag={!prefersReducedMotion}
      dragConstraints={stageRef}
      dragElastic={dragElastic}
      dragTransition={{
        bounceStiffness: params.dragStiffness,
        bounceDamping: params.dragDamping,
      }}
      onDragStart={onDragStart}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      whileDrag={{ scale: dragGrabScale }}
      style={
        prefersReducedMotion
          ? undefined
          : {
              x: worldObject.x,
              y: totalY,
              scaleX: totalScaleX,
              scaleY: totalScaleY,
              rotate: tilt,
              skewX: skew,
              boxShadow,
              filter,
            }
      }
      aria-label={identity.title}
    >
      <div className={styles.surface}>
        <motion.div
          className={styles.glowLayer}
          style={
            prefersReducedMotion
              ? undefined
              : { x: glowOffsetX, y: glowOffsetY }
          }
        >
          <motion.div
            className={styles.glow}
            style={
              {
                opacity: prefersReducedMotion
                  ? params.glowOpacityCeiling
                  : glowOpacity,
                background: `radial-gradient(circle at 50% 65%, rgba(${identity.hue.glow}, 0.9) 0%, rgba(${identity.hue.glowSoft}, 0.4) 34%, rgba(${identity.hue.glowSoft}, 0) 70%)`,
                "--glow-radius": `${params.glowRadiusPct}%`,
                "--glow-blur": `${params.glowBlurPx}px`,
              } as CSSProperties
            }
            animate={prefersReducedMotion ? undefined : { scale: breatheScale }}
            transition={
              prefersReducedMotion
                ? undefined
                : {
                    duration: params.breathDurationS,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }
            }
          />

          {identity.signature === "helicopter-beacon" &&
            !prefersReducedMotion && (
              <BeaconSweep
                accentColor={identity.hue.accent}
                durationS={beaconDuration}
              />
            )}
          {identity.signature === "sauna-haze" && !prefersReducedMotion && (
            <HeatHaze durationS={params.breathDurationS} />
          )}
          {identity.signature === "wine-swirl" && !prefersReducedMotion && (
            <WineSwirl durationS={wineSwirlDuration} />
          )}

          {!prefersReducedMotion && justNoticed && (
            <motion.div
              className={styles.noticeFlicker}
              style={{
                background: `radial-gradient(circle at 50% 60%, rgba(${identity.hue.accent}, 0.55) 0%, rgba(${identity.hue.glowSoft}, 0) 68%)`,
              }}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: [0, 0.9, 0], scale: [0.92, 1.06, 1] }}
              transition={{ duration: 0.55, ease: "easeOut" }}
            />
          )}

          {!prefersReducedMotion && surpriseTick > 0 && (
            <motion.div
              key={`surprise-${surpriseTick}`}
              className={styles.flarePulse}
              style={{
                background: `radial-gradient(circle at 50% 60%, rgba(${identity.hue.accent}, 0.5) 0%, rgba(${identity.hue.glowSoft}, 0) 68%)`,
              }}
              initial={{ opacity: 0, scale: 1 }}
              animate={{ opacity: [0, 0.7, 0], scale: [1, 1.12, 1] }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            />
          )}

          {!prefersReducedMotion && flourishTick > 0 && (
            <motion.div
              key={`flourish-${flourishTick}`}
              className={styles.flarePulse}
              style={{
                background: `radial-gradient(circle at 50% 60%, rgba(${identity.hue.accent}, 0.6) 0%, rgba(${identity.hue.glowSoft}, 0) 68%)`,
              }}
              initial={{ opacity: 0, scale: 1 }}
              animate={{ opacity: [0, 0.8, 0], scale: [1, 1.16, 1] }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          )}
        </motion.div>
      </div>

      <ParticleField
        material={identity.material}
        count={params.particleCount}
        speed={params.particleSpeed}
        jitter={params.jitter}
        surpriseTrigger={surpriseTick}
        tossTrigger={tossTrigger}
        flourishTrigger={flourishTick}
        reducedMotion={prefersReducedMotion}
      />

      <div className={styles.textLayer}>
        <h2 className={styles.title}>{identity.title}</h2>
        <p className={styles.futureMemory}>{identity.futureMemory}</p>
      </div>

      {!prefersReducedMotion && (
        <WorldTrailLayer
          container={stageEl}
          deposits={deposits}
          material={identity.material}
          speed={params.particleSpeed}
          jitter={params.jitter}
          onExpire={expireDeposit}
        />
      )}
    </motion.div>
  );
}
