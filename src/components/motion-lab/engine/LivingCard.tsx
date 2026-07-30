"use client";

import {
  motion,
  useMotionTemplate,
  useTransform,
  type PanInfo,
} from "framer-motion";
import { useRef, useState, type CSSProperties, type RefObject } from "react";
import type { ExperienceDefinition } from "./types";
import { usePersonalityEngine } from "./usePersonalityEngine";
import { ParticleField } from "./ParticleField";
import { BeaconSweep } from "./BeaconSweep";
import { HeatHaze } from "./HeatHaze";
import { WineSwirl } from "./WineSwirl";
import styles from "./LivingCard.module.css";

const TOSS_VELOCITY_THRESHOLD = 250;

export function LivingCard({
  experience,
  dragConstraintsRef,
}: {
  experience: ExperienceDefinition;
  dragConstraintsRef: RefObject<HTMLDivElement | null>;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [tossTrigger, setTossTrigger] = useState(0);

  const {
    params,
    combined,
    leanXSpring,
    leanYSpring,
    justNoticed,
    surpriseTick,
    flourishTick,
    prefersReducedMotion,
    handlePointerEnter,
    handlePointerLeave,
    triggerFlourish,
  } = usePersonalityEngine(experience, cardRef);

  const { identity } = experience;

  const liftY = useTransform(combined, [0, 1], [0, -14]);
  const liftScale = useTransform(combined, [0, 1], [1, 1.014]);
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

  const handleDragEnd = (
    _event: PointerEvent | MouseEvent | TouchEvent,
    info: PanInfo,
  ) => {
    setIsDragging(false);
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
      dragConstraints={dragConstraintsRef}
      dragElastic={dragElastic}
      dragTransition={{
        bounceStiffness: params.dragStiffness,
        bounceDamping: params.dragDamping,
      }}
      dragSnapToOrigin
      onDragStart={() => setIsDragging(true)}
      onDragEnd={handleDragEnd}
      whileDrag={{ scale: dragGrabScale }}
      style={
        prefersReducedMotion
          ? undefined
          : { y: liftY, scale: liftScale, boxShadow, filter }
      }
      aria-label={identity.title}
    >
      <div className={styles.surface}>
        <motion.div
          className={styles.glowLayer}
          style={
            prefersReducedMotion
              ? undefined
              : { x: leanXSpring, y: leanYSpring }
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
    </motion.div>
  );
}
