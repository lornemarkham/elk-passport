"use client";

import { useEffect, useRef, useState } from "react";
import type { MotionValue } from "framer-motion";
import { FireSim } from "./fireSim";
import { nextNoiseSeed } from "../../primitives/noise";
import { useSharedRaf } from "../../primitives/useSharedRaf";
import styles from "./Fire.module.css";

const GRID_WIDTH = 20;
const GRID_HEIGHT = 28;

/** A 256-step color ramp, precomputed once — cheap per-pixel lookup during
 * the actual draw loop instead of building a color string per cell per
 * frame (20×28 cells × 60fps adds up). */
function buildPalette(): string[] {
  const stops: [number, [number, number, number]][] = [
    [0, [8, 4, 2]],
    [0.15, [40, 8, 2]],
    [0.35, [140, 30, 4]],
    [0.55, [220, 90, 10]],
    [0.75, [255, 170, 40]],
    [0.9, [255, 220, 120]],
    [1, [255, 250, 220]],
  ];
  const palette: string[] = [];
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let lower = stops[0];
    let upper = stops[stops.length - 1];
    for (let s = 0; s < stops.length - 1; s++) {
      if (t >= stops[s][0] && t <= stops[s + 1][0]) {
        lower = stops[s];
        upper = stops[s + 1];
        break;
      }
    }
    const span = upper[0] - lower[0] || 1;
    const localT = (t - lower[0]) / span;
    const r = Math.round(lower[1][0] + (upper[1][0] - lower[1][0]) * localT);
    const g = Math.round(lower[1][1] + (upper[1][1] - lower[1][1]) * localT);
    const b = Math.round(lower[1][2] + (upper[1][2] - lower[1][2]) * localT);
    palette.push(`rgb(${r},${g},${b})`);
  }
  return palette;
}

const PALETTE = buildPalette();

function draw(canvas: HTMLCanvasElement, sim: FireSim) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, sim.width, sim.height);
  for (let y = 0; y < sim.height; y++) {
    for (let x = 0; x < sim.width; x++) {
      const heat = sim.get(x, y);
      if (heat <= 0.015) continue;
      const index = Math.min(255, Math.max(0, Math.round(heat * 255)));
      ctx.fillStyle = PALETTE[index];
      ctx.globalAlpha = Math.min(1, heat * 1.4);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}

export interface FireProps {
  /** 0–1 — how alert the fire is right now. Brightens/thickens the base
   * directly in the simulation; not a separate hover treatment. */
  attention?: MotionValue<number>;
  reducedMotion: boolean;
  className?: string;
}

/**
 * The flame — a small canvas running `FireSim` off the shared rAF tick.
 * Internal resolution is tiny (20×28); the organic look comes entirely
 * from upscaling that grid via CSS plus a soft blur, which is also what
 * keeps this cheap enough to run several instances on one field at once.
 */
export function Fire({ attention, reducedMotion, className }: FireProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sim] = useState(
    () =>
      new FireSim({
        width: GRID_WIDTH,
        height: GRID_HEIGHT,
        seed: nextNoiseSeed(),
      }),
  );

  // Reduced motion: warm the base up for a couple of steps and draw
  // exactly one static frame — no rAF subscription at all below.
  useEffect(() => {
    if (!reducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    sim.step(0, 0.6);
    sim.step(0.08, 0.6);
    draw(canvas, sim);
  }, [reducedMotion, sim]);

  useSharedRaf((_delta, elapsed) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const intensity = attention?.get() ?? 0;
    sim.step(elapsed, intensity);
    draw(canvas, sim);
  }, !reducedMotion);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      width={GRID_WIDTH}
      height={GRID_HEIGHT}
      className={`${styles.fireCanvas} ${className ?? ""}`}
    />
  );
}
