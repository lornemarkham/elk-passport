"use client";

import { createPortal } from "react-dom";
import { useRef, useState, type RefObject } from "react";
import type { MotionValue } from "framer-motion";
import { NoiseField, nextNoiseSeed } from "../primitives/noise";
import {
  advectParticle,
  type FlowParticleState,
} from "../primitives/flowField";
import { useSharedRaf } from "../primitives/useSharedRaf";

interface EmberParticle extends FlowParticleState {
  id: number;
}

const MAX_PARTICLES = 40;

export interface EmbersProps {
  /** The card embers spawn from — sampled once per spawn, never tracked
   * afterward. This is deliberately *not* a `WorldWindow` child: a real
   * ember doesn't keep following the fire once it's left it, so each
   * particle's position is recorded in the portal container's own
   * stage-absolute space at the moment it's born, then advected
   * independently. */
  anchorRef: RefObject<HTMLElement | null>;
  /** Where spawned particles are portalled to — an ancestor with no
   * `overflow: hidden` between it and the viewport (typically the
   * field/stage's own outer container). */
  portalContainer: HTMLElement | null;
  originXPercent?: number;
  originYPercent?: number;
  /** Ambient particles spawned per second at rest. Deliberately low —
   * "embers every few seconds," not a constant stream; see `burstTrigger`
   * for the actual reward moments. */
  spawnRate?: number;
  /** 0–1 — scales spawn rate and rise speed. Wire to hover/drag intensity. */
  attention?: MotionValue<number>;
  /** Shared-wind bias from a `FieldEnvironment`, if one is in scope —
   * optional, defaults to "no wind," so solo-card usage is unaffected. */
  windAngle?: MotionValue<number>;
  windStrength?: MotionValue<number>;
  /** Increment to fire an immediate burst — e.g. on release after a toss. */
  burstTrigger?: number;
  burstCount?: number;
  color?: string;
  colorSoft?: string;
  reducedMotion: boolean;
}

/**
 * Particles-in-a-flow-field — the primitive `Smoke`, `Snow`, `Leaves`,
 * `Dust`, and `Pollen` will eventually share (only this one is built so
 * far; the others don't have a real composition asking for them yet).
 *
 * Pre-mounted (`MAX_PARTICLES` spans, always in the DOM) and moved via
 * direct style writes inside the shared rAF tick rather than through React
 * state — a few dozen particles at 60fps is far cheaper this way than a
 * full re-render per spawn.
 */
export function Embers({
  anchorRef,
  portalContainer,
  originXPercent = 0.5,
  originYPercent = 0.25,
  spawnRate = 0.15,
  attention,
  windAngle,
  windStrength,
  burstTrigger = 0,
  burstCount = 10,
  color = "255, 200, 140",
  colorSoft = "255, 140, 60",
  reducedMotion,
}: EmbersProps) {
  const [noise] = useState(() => new NoiseField(nextNoiseSeed()));
  const particlesRef = useRef<EmberParticle[]>([]);
  const nextIdRef = useRef(0);
  const spawnAccumulatorRef = useRef(0);
  const lastBurstRef = useRef(burstTrigger);
  const containerRef = useRef<HTMLDivElement>(null);

  function spawnOne() {
    const anchor = anchorRef.current;
    const container = portalContainer;
    if (!anchor || !container) return;
    if (particlesRef.current.length >= MAX_PARTICLES) return;
    const anchorRect = anchor.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const jitter = (Math.random() - 0.5) * anchorRect.width * 0.12;
    particlesRef.current.push({
      id: nextIdRef.current++,
      x:
        anchorRect.left -
        containerRect.left +
        anchorRect.width * originXPercent +
        jitter,
      y:
        anchorRect.top - containerRect.top + anchorRect.height * originYPercent,
      vx: 0,
      vy: -20,
      age: 0,
      lifetime: 2.4 + Math.random() * 2.2,
    });
  }

  useSharedRaf((deltaSeconds, elapsedSeconds) => {
    const container = containerRef.current;
    if (!container || !portalContainer) return;

    if (burstTrigger !== lastBurstRef.current) {
      lastBurstRef.current = burstTrigger;
      for (let i = 0; i < burstCount; i++) spawnOne();
    }

    const currentAttention = attention?.get() ?? 0;
    spawnAccumulatorRef.current +=
      deltaSeconds * spawnRate * (1 + currentAttention * 4);
    while (spawnAccumulatorRef.current >= 1) {
      spawnAccumulatorRef.current -= 1;
      spawnOne();
    }

    particlesRef.current = particlesRef.current
      .map((particle) => ({
        ...advectParticle(particle, noise, deltaSeconds, elapsedSeconds, {
          speed: 8,
          turnRate: 1.4,
          buoyancy: -34 - currentAttention * 20,
          flowScale: 0.02,
          flowTimeScale: 0.25,
          windAngle: windAngle?.get(),
          windStrength: windStrength?.get(),
        }),
        id: particle.id,
      }))
      .filter((particle) => particle.age < particle.lifetime);

    const children = container.children;
    for (let i = 0; i < children.length; i++) {
      const el = children[i] as HTMLElement;
      const particle = particlesRef.current[i];
      if (!particle) {
        el.style.opacity = "0";
        continue;
      }
      const lifeT = particle.age / particle.lifetime;
      const opacity = lifeT < 0.15 ? lifeT / 0.15 : 1 - (lifeT - 0.15) / 0.85;
      el.style.transform = `translate(${particle.x}px, ${particle.y}px)`;
      el.style.opacity = String(Math.max(0, opacity) * 0.85);
    }
  }, !reducedMotion);

  if (reducedMotion || !portalContainer) return null;

  return createPortal(
    <div
      ref={containerRef}
      aria-hidden
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      {Array.from({ length: MAX_PARTICLES }, (_, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 3,
            height: 3,
            borderRadius: "50%",
            opacity: 0,
            background: `radial-gradient(circle, rgba(${color}, 0.95) 0%, rgba(${colorSoft}, 0.5) 60%, rgba(${colorSoft}, 0) 100%)`,
            willChange: "transform, opacity",
          }}
        />
      ))}
    </div>,
    portalContainer,
  );
}
