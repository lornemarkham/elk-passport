"use client";

import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { Clock, Heart, X } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { cn } from "@/lib/utils";
import { useCursorPan } from "@/components/passport/useCursorPan";
import { CardTemptation } from "./temptation/CardTemptation";
import { usePrefersReducedMotion } from "./temptation/usePrefersReducedMotion";
import type {
  ActiveTemptation,
  Experience,
  FieldLayout,
  LifeType,
} from "./types";

interface DiscoveryCardProps {
  experience: Experience;
  layout: FieldLayout;
  /** Card-body inspection — must not save, reject, or shelf on its own
   * (IMP-004 acceptance criteria). */
  onInspect: (experience: Experience) => void;
  onSave: (experience: Experience) => void;
  onReject: (experience: Experience) => void;
  onShelf: (experience: Experience) => void;
  pointerXPercent: MotionValue<number>;
  pointerYPercent: MotionValue<number>;
  /** Lifts hover state up for Peripheral Temptation eligibility — see DiscoverySpace. */
  onHoverChange?: (hovering: boolean) => void;
  /** The one temptation running anywhere in the field, if any. */
  activeTemptation?: ActiveTemptation;
  /** Drag boundary — the Discovery field's own container (IMP-005 "safe boundaries"). */
  dragConstraintsRef: RefObject<HTMLDivElement | null>;
}

/** Shared premium easing — a slow, deliberate settle, not a bounce. */
const PREMIUM_EASE = [0.16, 1, 0.3, 1] as const;

/** How far out, in percentage-space, a card starts noticing the cursor. */
const PROXIMITY_RADIUS = 28;

/**
 * IMP-005 motion states, in priority order (highest wins): Dragging >
 * Settling > Hover > Proximity > Ambient. Hover and Proximity are already
 * expressed declaratively (whileHover / the proximity-driven aura), so the
 * only state machine needed is Ambient vs. Dragging vs. Settling — while
 * either of the latter two is true, the ambient drift/rotation keyframes
 * are suppressed so they never fight the drag gesture's own control of the
 * same x/y motion values.
 */
type CardMotionState = "idle" | "dragging" | "settling";

/** How long the "settling" state (post-release glide) is assumed to last
 * before ambient drift is allowed to resume. Framer's inertia animation has
 * no completion callback, so this is a deliberate approximation matched to
 * the `dragTransition` below rather than an exact measurement. */
const SETTLE_DURATION_MS = 1400;

/** IMP-005 §Ambient: tight, deliberately subtle ranges — replaces the
 * earlier prototype's larger drift (up to ~14px / 21–34s), which is the
 * "still feels largely static... or distracting" problem this IMP exists
 * to fix. Existing per-card `driftX`/`driftY`/`duration` values (still used
 * for independent per-card timing/variety) are rescaled into these ranges
 * rather than rewritten by hand across all 20 field-presentation records. */
const AMBIENT_DRIFT_X_RANGE = [1, 4] as const;
const AMBIENT_DRIFT_Y_RANGE = [2, 6] as const;
const AMBIENT_ROTATE_DEGREES = 0.3;
const AMBIENT_DURATION_RANGE = [8, 16] as const;

/** The known range of the existing per-card layout values being rescaled. */
const SOURCE_DRIFT_X_RANGE = [6, 14] as const;
const SOURCE_DRIFT_Y_RANGE = [7, 15] as const;
const SOURCE_DURATION_RANGE = [21, 34] as const;

function remap(
  value: number,
  [inMin, inMax]: readonly [number, number],
  [outMin, outMax]: readonly [number, number],
): number {
  const t = Math.max(0, Math.min(1, (value - inMin) / (inMax - inMin)));
  return outMin + t * (outMax - outMin);
}

/**
 * Autonomous "sign of life" presets — layered on top of a card's base glow,
 * always running, entirely independent of hover or proximity. Each shape is
 * additive (rests at 0 and briefly lifts), so a card's baseline color and
 * the existing hover/proximity behavior are never touched.
 */
const LIFE_PRESETS: Record<
  Exclude<LifeType, "still">,
  { opacity: number[]; scale?: number[]; times: number[]; duration: number }
> = {
  // Irregular, continuous flicker — never a clean metronomic pulse.
  ember: {
    opacity: [0, 0.45, 0.25, 0.6, 0.3, 0.55, 0.2, 0],
    times: [0, 0.12, 0.26, 0.4, 0.55, 0.68, 0.84, 1],
    duration: 6.5,
  },
  // Mostly still, then one brief glint — light catching water.
  shimmer: {
    opacity: [0, 0, 0.5, 0, 0],
    times: [0, 0.42, 0.48, 0.55, 1],
    duration: 17,
  },
  // Smooth, slow, symmetric — felt more than seen.
  breathing: {
    opacity: [0, 0.32, 0],
    times: [0, 0.5, 1],
    duration: 9,
  },
  // Long quiet, then one small, unmistakably deliberate moment.
  whisper: {
    opacity: [0, 0, 0.55, 0, 0],
    scale: [1, 1, 1.1, 1, 1],
    times: [0, 0.55, 0.62, 0.72, 1],
    duration: 32,
  },
};

/** A small, always-reachable action button — never hover-only, so touch and
 * keyboard users have the same access as mouse users (IMP-004 accessibility
 * requirements). Visually quiet at rest, clear on hover/focus. */
function CardActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: (event: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="focus-visible:ring-ring/50 flex size-8 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white/70 opacity-70 backdrop-blur-md transition-all hover:border-white/30 hover:bg-black/70 hover:text-white hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:outline-none"
    >
      {children}
    </button>
  );
}

export function DiscoveryCard({
  experience,
  layout,
  onInspect,
  onSave,
  onReject,
  onShelf,
  pointerXPercent,
  pointerYPercent,
  onHoverChange,
  activeTemptation,
  dragConstraintsRef,
}: DiscoveryCardProps) {
  const { top, left, size, rotate, depth, duration, delay, driftX, driftY } =
    layout;

  const scale = 0.72 + depth * 0.36;
  const blur = (1 - depth) * 1.4;
  const opacity = 0.5 + depth * 0.5;
  const lifePreset =
    experience.life === "still" ? null : LIFE_PRESETS[experience.life];
  const { videoRef, handleMouseMove, handleMouseLeave } = useCursorPan(
    Boolean(experience.video),
  );
  const [videoFailed, setVideoFailed] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();

  // Dragging > Settling > Ambient (IMP-005 priority order). Idle is the only
  // state in which the ambient drift/rotation keyframes below are allowed
  // to run — otherwise they'd fight Framer's own control of x/y during and
  // immediately after a drag/throw.
  const [motionState, setMotionState] = useState<CardMotionState>("idle");
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Design Review Experiment 3 ("the tagline wins"): a card is a future
  // memory, not a product shot — the sentence is the point, not the glow
  // around it. Sustained hover (not the instant kind) lets the tagline
  // grow into the card's most prominent element while the video/glow
  // beneath it quietly dims, so lingering is rewarded with more of the
  // story instead of more shine. Deliberately not gated behind
  // `prefersReducedMotion`: this is a response to real, sustained
  // attention (like drag, which also stays enabled under reduced motion),
  // not ambient/automatic motion — and the transition itself is a mild
  // opacity/size fade, not motion in the vestibular sense.
  const [isLingering, setIsLingering] = useState(false);
  const lingerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleHoverStart() {
    onHoverChange?.(true);
    lingerTimeoutRef.current = setTimeout(() => setIsLingering(true), 1000);
  }

  function handleHoverEnd() {
    onHoverChange?.(false);
    if (lingerTimeoutRef.current !== null) {
      clearTimeout(lingerTimeoutRef.current);
      lingerTimeoutRef.current = null;
    }
    // No lingering delay on the way out — leaving should read as immediate,
    // only arriving is deliberately slow.
    setIsLingering(false);
  }

  // Explicit x/y motion values (rather than letting Framer create them
  // implicitly) so a throw's resting position can be *read* once dragging
  // ends. Without this, resuming the ambient keyframes below — which are
  // written as an offset sequence starting and ending at 0 — would visibly
  // glide the card back to its pre-drag position instead of drifting from
  // wherever it was actually dropped.
  const xMotion = useMotionValue(0);
  const yMotion = useMotionValue(0);
  const [ambientBaseX, setAmbientBaseX] = useState(0);
  const [ambientBaseY, setAmbientBaseY] = useState(0);

  useEffect(() => {
    return () => {
      if (settleTimeoutRef.current !== null) {
        clearTimeout(settleTimeoutRef.current);
      }
      if (lingerTimeoutRef.current !== null) {
        clearTimeout(lingerTimeoutRef.current);
      }
    };
  }, []);

  function handleDragStart() {
    if (settleTimeoutRef.current !== null) {
      clearTimeout(settleTimeoutRef.current);
      settleTimeoutRef.current = null;
    }
    setMotionState("dragging");
  }

  function handleDragEnd() {
    setMotionState("settling");
    // No momentum under reduced motion (dragMomentum is disabled below), so
    // there's nothing to wait out — return to ambient immediately.
    const settleDuration = prefersReducedMotion ? 0 : SETTLE_DURATION_MS;
    settleTimeoutRef.current = setTimeout(() => {
      // Capture wherever the throw actually settled — ambient drift then
      // continues relative to *this*, not the card's original spot.
      setAmbientBaseX(xMotion.get());
      setAmbientBaseY(yMotion.get());
      setMotionState("idle");
      settleTimeoutRef.current = null;
    }, settleDuration);
  }

  const ambientDriftX = remap(
    driftX,
    SOURCE_DRIFT_X_RANGE,
    AMBIENT_DRIFT_X_RANGE,
  );
  const ambientDriftY = remap(
    driftY,
    SOURCE_DRIFT_Y_RANGE,
    AMBIENT_DRIFT_Y_RANGE,
  );
  const ambientDuration = remap(
    duration,
    SOURCE_DURATION_RANGE,
    AMBIENT_DURATION_RANGE,
  );

  const showAmbientMotion = !prefersReducedMotion && motionState === "idle";

  // 0 (cursor far away) – 1 (right on top of the card). Drives a quiet
  // bloom in the card's aura as the cursor approaches, before hover commits
  // to anything — the card notices you before you've decided to notice it.
  const proximity = useTransform([pointerXPercent, pointerYPercent], (v) => {
    const [px, py] = v as [number, number];
    const distance = Math.hypot(px - left, py - top);
    return Math.max(0, 1 - distance / PROXIMITY_RADIUS);
  });
  const auraScale = useSpring(useTransform(proximity, [0, 1], [1, 1.9]), {
    stiffness: 55,
    damping: 16,
  });

  // Depth reads as elevation: nearer cards sit higher and cast a bigger,
  // softer shadow; farther ones stay closer to the background.
  const restShadow = `0 ${6 + depth * 14}px ${18 + depth * 30}px rgba(0,0,0,${(0.26 + depth * 0.16).toFixed(2)})`;
  const hoverShadow = `0 ${20 + depth * 18}px ${52 + depth * 26}px rgba(0,0,0,${(0.42 + depth * 0.14).toFixed(2)})`;

  return (
    <motion.div
      layoutId={experience.id}
      // "position" only — the field card and its Mood Board counterpart are
      // very different shapes (tall card vs. wide row); letting Framer
      // Motion interpolate the box itself produces a grotesque stretch
      // mid-flight. Position-only travel + crossfade reads far cleaner.
      layout="position"
      onHoverStart={handleHoverStart}
      onHoverEnd={handleHoverEnd}
      // Framer's own tap gesture, not the inner button's onClick: once
      // `drag` is attached to this element, its pointerdown handling
      // suppresses the native click that would otherwise fire on the
      // nested inspect button below. `onTap` already correctly
      // disambiguates a genuine tap from a drag that happened to start
      // here, so it's the right place for pointer/touch inspection.
      // Keyboard activation of the inner button still works independently
      // (Enter/Space dispatch a click without going through pointerdown).
      onTap={() => onInspect(experience)}
      className="absolute text-left"
      initial={{ opacity: 0, scale: scale * 0.9 }}
      // Ambient drift/rotation only while idle (IMP-005 priority: Dragging >
      // Settling > Hover > Proximity > Ambient) — x/y/rotate are omitted
      // entirely while dragging/settling so Framer's own drag control of
      // those same motion values is never fought by a competing keyframe
      // animation.
      animate={
        showAmbientMotion
          ? {
              opacity,
              scale,
              // Multi-point, asymmetric paths per axis so the loop never
              // reads as a simple back-and-forth — closer to drifting than
              // oscillating. Ranges rescaled to IMP-005's tighter ambient
              // spec (1–4px / 2–6px / ±0.3°), not the layout's raw values.
              // Offset by ambientBaseX/Y so a thrown card drifts from where
              // it actually landed, not its original pre-drag position.
              x: [
                ambientBaseX,
                ambientBaseX + ambientDriftX * 0.55,
                ambientBaseX + ambientDriftX,
                ambientBaseX + ambientDriftX * 0.25,
                ambientBaseX - ambientDriftX * 0.35,
                ambientBaseX,
              ],
              y: [
                ambientBaseY,
                ambientBaseY - ambientDriftY * 0.4,
                ambientBaseY + ambientDriftY * 0.65,
                ambientBaseY + ambientDriftY,
                ambientBaseY + ambientDriftY * 0.2,
                ambientBaseY,
              ],
              rotate: [
                rotate,
                rotate + AMBIENT_ROTATE_DEGREES * 0.6,
                rotate - AMBIENT_ROTATE_DEGREES * 0.45,
                rotate + AMBIENT_ROTATE_DEGREES * 0.8,
                rotate,
              ],
              filter: `blur(${blur}px)`,
            }
          : { opacity, scale, filter: `blur(${blur}px)` }
      }
      transition={{
        default: {
          duration: ambientDuration,
          repeat: Infinity,
          ease: "easeInOut",
          delay,
        },
        // Without its own key, the shared-layout projection correction
        // (this card and its Mood Board row share layoutId) falls back to
        // `default` above — an Infinite-repeat ambient-drift tween that
        // never settles. A one-shot layout transition lets the FLIP from
        // the row's position actually converge instead of getting stuck
        // mid-transition forever.
        layout: { duration: 0.7, ease: PREMIUM_EASE },
        // Deliberately fast relative to the ambient drift delay above —
        // the whole field should be visible within ~1.2s of load, staggered
        // just enough to feel alive rather than a single flash-in.
        opacity: { duration: 0.9, delay: delay * 0.06, ease: "easeOut" },
        // Slower release than entry (IMP-005 "Hover"): whileHover's own
        // transition below governs the fast entry; these govern the return
        // to rest once the pointer leaves.
        scale: { duration: 0.85, ease: PREMIUM_EASE },
        y: { duration: 0.85, ease: PREMIUM_EASE },
        filter: { duration: 0.85, ease: PREMIUM_EASE },
      }}
      whileHover={{
        // A subtle relative bump on top of the card's own depth-based size —
        // not an absolute 1.02–1.03, which would erase the depth illusion.
        scale: scale * 1.025,
        y: -4,
        filter: "blur(0px)",
        zIndex: 999,
        transition: { duration: 0.28, ease: PREMIUM_EASE },
      }}
      whileTap={{ scale: scale * 1.02, y: -4 }}
      // Dragging (IMP-005 "Drag"/"Throw"). Direct manipulation stays enabled
      // even under reduced motion — only the post-release momentum glide is
      // suppressed (dragMomentum below), since gliding after release is
      // automatic motion, not something the user is actively doing.
      drag
      dragConstraints={dragConstraintsRef}
      dragElastic={0.12}
      dragMomentum={!prefersReducedMotion}
      dragTransition={{
        power: 0.3,
        timeConstant: 200,
        bounceStiffness: 300,
        bounceDamping: 40,
      }}
      whileDrag={{
        scale: scale * 1.05,
        zIndex: 1000,
        cursor: "grabbing",
        transition: { duration: 0.15, ease: PREMIUM_EASE },
      }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      style={{
        top: `${top}%`,
        left: `${left}%`,
        width: size,
        zIndex: Math.round(depth * 100),
        cursor: "grab",
        x: xMotion,
        y: yMotion,
      }}
    >
      <motion.div
        className="group relative overflow-hidden rounded-2xl border backdrop-blur-md"
        initial={false}
        animate={{
          borderColor: "rgba(255,255,255,0.08)",
          backgroundColor: "rgba(255,255,255,0.025)",
          boxShadow: restShadow,
        }}
        whileHover={{
          borderColor: "rgba(255,255,255,0.26)",
          backgroundColor: "rgba(255,255,255,0.045)",
          boxShadow: hoverShadow,
        }}
        transition={{ duration: 0.55, ease: PREMIUM_EASE }}
        style={{ aspectRatio: "1 / 1.15" }}
      >
        {experience.video && !videoFailed && (
          <>
            <video
              ref={videoRef}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full object-cover select-none"
              style={{ objectPosition: "50% center" }}
              src={experience.video}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              onError={() => setVideoFailed(true)}
            />
            {/* "Brighter video" on hover (IMP-005): this scrim dims on
                hover rather than the video itself brightening, so a failed/
                missing video (videoFailed above) never needs its own
                separate hover treatment — the fallback glow/text underneath
                already has one. */}
            <div
              aria-hidden
              className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.65)_0%,rgba(0,0,0,0.1)_55%,rgba(0,0,0,0.05)_100%)] transition-opacity duration-700 group-hover:opacity-70"
            />
          </>
        )}
        <motion.div
          style={{ scale: auraScale }}
          className={cn(
            "absolute -inset-8 rounded-full bg-linear-to-br opacity-70 blur-3xl transition-opacity duration-700 group-hover:opacity-100",
            experience.glow,
          )}
        />
        {lifePreset && (
          <motion.div
            aria-hidden
            className={cn(
              "absolute -inset-8 rounded-full bg-linear-to-br blur-3xl",
              experience.glow,
            )}
            initial={{ opacity: 0 }}
            animate={{
              opacity: lifePreset.opacity,
              ...(lifePreset.scale ? { scale: lifePreset.scale } : {}),
            }}
            transition={{
              duration: lifePreset.duration,
              times: lifePreset.times,
              repeat: Infinity,
              delay,
              ease: "easeInOut",
            }}
          />
        )}
        <CardTemptation
          kind={experience.temptation}
          active={activeTemptation?.cardId === experience.id}
          instanceId={
            activeTemptation?.cardId === experience.id
              ? activeTemptation.instanceId
              : undefined
          }
          durationMs={
            activeTemptation?.cardId === experience.id
              ? activeTemptation.durationMs
              : undefined
          }
        />

        {/* Card-body inspection surface — covers the card but must never
            save/reject/shelf on its own (IMP-004 acceptance criteria).
            Transparent; the visible layers above render through it. */}
        <button
          type="button"
          onClick={() => onInspect(experience)}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          aria-label={`View details for ${experience.name}`}
          className="absolute inset-0 z-0 cursor-pointer bg-transparent text-left"
        />

        {/* The lingering-hover dim: everything below the text (video, glow,
            temptation effects) quietly recedes so the tagline — the actual
            memory — becomes the thing being looked at, not the light
            around it. */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 bg-black transition-opacity duration-500",
            isLingering ? "opacity-45" : "opacity-0",
          )}
        />

        <div
          aria-hidden
          className="relative z-0 flex h-full flex-col justify-end gap-1 p-4"
        >
          <p className="font-heading text-base leading-snug font-medium tracking-[-0.01em] text-white/90 sm:text-lg">
            {experience.name}
          </p>
          <p
            className={cn(
              "leading-snug transition-all duration-500 ease-out",
              isLingering
                ? "text-sm text-white/95 sm:text-base"
                : "text-xs text-white/45",
            )}
          >
            {experience.tagline}
          </p>
        </div>

        {/* Always-reachable actions — sit above the inspect surface so they
            intercept their own clicks; never hover-gated (touch/keyboard
            parity, IMP-004 "Mobile and accessibility"). */}
        <div className="absolute top-2.5 right-2.5 z-10 flex gap-1.5">
          <CardActionButton
            label={`Save ${experience.name} to your Mood Board`}
            onClick={(event) => {
              event.stopPropagation();
              onSave(experience);
            }}
          >
            <Heart className="size-3.5" />
          </CardActionButton>
          <CardActionButton
            label={`Shelf ${experience.name} for later`}
            onClick={(event) => {
              event.stopPropagation();
              onShelf(experience);
            }}
          >
            <Clock className="size-3.5" />
          </CardActionButton>
          <CardActionButton
            label={`Not interested in ${experience.name} right now`}
            onClick={(event) => {
              event.stopPropagation();
              onReject(experience);
            }}
          >
            <X className="size-3.5" />
          </CardActionButton>
        </div>
      </motion.div>
    </motion.div>
  );
}
