"use client";

import { SnowLayer } from "@/app/about/experiment-05-christmas/SnowLayer";
import { useReducedMotion } from "./stored";

/**
 * **A little snow, and nothing to press.** The gentle snowfall is the original
 * Christmas experiment's own (`/about/experiment-05-christmas`, reused, not
 * rewritten). It falls by itself and stays out of the way — no buttons, no
 * sound — and a device that asks for reduced motion gets none (2026-11-21 QA:
 * the Snow on / Light the fire buttons were removed, the snow kept).
 */
export function Festive() {
  const reduced = useReducedMotion();
  return reduced ? null : <SnowLayer />;
}
