"use client";

import {
  motion,
  useMotionTemplate,
  useTransform,
  type PanInfo,
} from "framer-motion";
import { useRef, useState, type RefObject } from "react";
import type { Experience } from "./experience";
import { useCampfireLife } from "./useCampfireLife";
import { Flame } from "./Flame";
import { EmberField } from "./EmberField";
import styles from "./LivingExperience.module.css";

/** A soft, slightly bouncy pull back to center after a drag — "elastic," not rigid. */
const DRAG_RETURN_TRANSITION = { bounceStiffness: 260, bounceDamping: 20 };

/** Below this release speed (px/s) a nudge doesn't count as a real toss — sparks shouldn't fly from a tiny wiggle. */
const TOSS_VELOCITY_THRESHOLD = 250;

export function LivingExperience({
  experience,
  dragConstraintsRef,
}: {
  experience: Experience;
  dragConstraintsRef: RefObject<HTMLDivElement | null>;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [tossTrigger, setTossTrigger] = useState(0);

  const {
    combined,
    focusSpring,
    justNoticed,
    surpriseTick,
    prefersReducedMotion,
    handlePointerEnter,
    handlePointerLeave,
  } = useCampfireLife(cardRef);

  const liftY = useTransform(combined, [0, 1], [0, -14]);
  const liftScale = useTransform(combined, [0, 1], [1, 1.012]);
  const brightness = useTransform(combined, [0, 1], [1, 1.06]);
  const shadowY = useTransform(combined, [0, 1], [24, 46]);
  const shadowBlur = useTransform(combined, [0, 1], [50, 100]);
  const shadowAlpha = useTransform(combined, [0, 1], [0.28, 0.6]);
  const filter = useMotionTemplate`brightness(${brightness})`;
  const boxShadow = useMotionTemplate`0 ${shadowY}px ${shadowBlur}px -10px rgba(255, 140, 70, ${shadowAlpha})`;

  // Future memory brightens specifically on real focus, not mere approach.
  const futureMemoryOpacity = useTransform(focusSpring, [0, 1], [0.45, 1]);

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
  };

  return (
    <motion.div
      ref={cardRef}
      className={`${styles.card} ${isDragging ? styles.dragging : ""}`}
      onMouseEnter={handlePointerEnter}
      onMouseLeave={handlePointerLeave}
      drag={!prefersReducedMotion}
      dragConstraints={dragConstraintsRef}
      dragElastic={0.18}
      dragTransition={DRAG_RETURN_TRANSITION}
      dragSnapToOrigin
      onDragStart={() => setIsDragging(true)}
      onDragEnd={handleDragEnd}
      whileDrag={{ scale: 1.03 }}
      style={
        prefersReducedMotion
          ? undefined
          : { y: liftY, scale: liftScale, boxShadow, filter }
      }
      aria-label={experience.title}
    >
      <div className={styles.surface}>
        <Flame
          combined={combined}
          justNoticed={justNoticed}
          surpriseTick={surpriseTick}
          reducedMotion={prefersReducedMotion}
        />
      </div>

      <EmberField
        surpriseTrigger={surpriseTick}
        tossTrigger={tossTrigger}
        reducedMotion={prefersReducedMotion}
      />

      <div className={styles.textLayer}>
        <h2 className={styles.title}>{experience.title}</h2>
        <motion.p
          className={styles.futureMemory}
          style={
            prefersReducedMotion ? undefined : { opacity: futureMemoryOpacity }
          }
        >
          {experience.futureMemory}
        </motion.p>
      </div>
    </motion.div>
  );
}
