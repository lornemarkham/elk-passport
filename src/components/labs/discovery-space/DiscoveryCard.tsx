"use client";

import {
  motion,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { Clock, Heart, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCursorPan } from "@/components/passport/useCursorPan";
import { CardTemptation } from "./temptation/CardTemptation";
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
}

/** Shared premium easing — a slow, deliberate settle, not a bounce. */
const PREMIUM_EASE = [0.16, 1, 0.3, 1] as const;

/** How far out, in percentage-space, a card starts noticing the cursor. */
const PROXIMITY_RADIUS = 28;

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
}: DiscoveryCardProps) {
  const { top, left, size, rotate, depth, duration, delay, driftX, driftY } =
    layout;

  const scale = 0.72 + depth * 0.36;
  const blur = (1 - depth) * 1.4;
  const opacity = 0.5 + depth * 0.5;
  const wobble = 1 + depth * 0.5;
  const lifePreset =
    experience.life === "still" ? null : LIFE_PRESETS[experience.life];
  const { videoRef, handleMouseMove, handleMouseLeave } = useCursorPan(
    Boolean(experience.video),
  );

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
      onHoverStart={() => onHoverChange?.(true)}
      onHoverEnd={() => onHoverChange?.(false)}
      className="absolute text-left"
      style={{
        top: `${top}%`,
        left: `${left}%`,
        width: size,
        zIndex: Math.round(depth * 100),
      }}
      initial={{ opacity: 0, scale: scale * 0.9 }}
      animate={{
        opacity,
        // Multi-point, asymmetric paths per axis so the loop never reads as
        // a simple back-and-forth — closer to drifting than oscillating.
        scale: [scale, scale * 1.012, scale * 0.996, scale * 1.006, scale],
        x: [0, driftX * 0.55, driftX, driftX * 0.25, -driftX * 0.35, 0],
        y: [0, -driftY * 0.4, driftY * 0.65, driftY, driftY * 0.2, 0],
        rotate: [
          rotate,
          rotate + wobble * 0.5,
          rotate - wobble * 0.35,
          rotate + wobble * 0.7,
          rotate,
        ],
        filter: `blur(${blur}px)`,
      }}
      transition={{
        default: { duration, repeat: Infinity, ease: "easeInOut", delay },
        // Deliberately fast relative to the ambient drift delay above —
        // the whole field should be visible within ~1.2s of load, staggered
        // just enough to feel alive rather than a single flash-in.
        opacity: { duration: 0.9, delay: delay * 0.06, ease: "easeOut" },
      }}
      whileHover={{
        scale: scale * 1.07,
        y: -10,
        filter: "blur(0px)",
        zIndex: 999,
        transition: { duration: 0.55, ease: PREMIUM_EASE },
      }}
      whileTap={{ scale: scale * 1.02, y: -4 }}
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
        {experience.video && (
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
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.65)_0%,rgba(0,0,0,0.1)_55%,rgba(0,0,0,0.05)_100%)]"
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

        <div
          aria-hidden
          className="relative z-0 flex h-full flex-col justify-end gap-1 p-4"
        >
          <p className="font-heading text-base leading-snug font-medium tracking-[-0.01em] text-white/90 sm:text-lg">
            {experience.name}
          </p>
          <p className="text-xs leading-snug text-white/45">
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
