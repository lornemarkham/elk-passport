"use client";

import {
  createContext,
  useContext,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { motion, useMotionValue, type MotionValue } from "framer-motion";
import { useSharedRaf } from "./primitives/useSharedRaf";

interface WorldWindowFrame {
  width: MotionValue<number>;
  height: MotionValue<number>;
}

const WorldWindowContext = createContext<WorldWindowFrame | null>(null);

/** Read from inside a `WorldWindow`'s children to size/position phenomena
 * relative to the card they're escaping — e.g. "spawn at the card's
 * horizontal center, near its top edge" — without re-measuring the DOM
 * themselves. Motion values, not plain numbers: read via `.get()` inside a
 * phenomenon's own tick, never through `useTransform`/render, so a card
 * resizing never forces every phenomenon watching it to re-render. */
export function useWorldWindowFrame(): WorldWindowFrame {
  const ctx = useContext(WorldWindowContext);
  if (!ctx) throw new Error("Must be used within a WorldWindow");
  return ctx;
}

export interface WorldWindowProps {
  /** The card whose live position/size this window tracks. */
  anchorRef: RefObject<HTMLElement | null>;
  /** Where escaping content is portalled to — typically the field/stage's
   * own outer container: an ancestor with no `overflow: hidden` of its own
   * between it and the viewport. `null` while not yet known renders nothing. */
  portalContainer: HTMLElement | null;
  /** Stacking relative to sibling cards' own escape layers — callers
   * typically derive this from the same depth/z-index scheme the card
   * itself already uses for its own body. */
  zIndex: number;
  children: ReactNode;
}

/**
 * The generalized "life escapes the frame" primitive. A card's own
 * `overflow-hidden` correctly clips its content and any `inside` effects;
 * `WorldWindow` renders `children` into a sibling of the whole field
 * instead, tracked every frame from the card's real bounding rect — so
 * embers, glow, leaves, or snow can drift beyond a card's own edges
 * without being clipped by it. This generalizes the portal pattern Motion
 * Lab's `WorldTrailLayer` (Sprint 004) already proved for ember trails
 * into something any phenomenon, on any card, in either system, can use.
 */
export function WorldWindow({
  anchorRef,
  portalContainer,
  zIndex,
  children,
}: WorldWindowProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const width = useMotionValue(0);
  const height = useMotionValue(0);

  useSharedRaf(() => {
    const anchor = anchorRef.current;
    const container = portalContainer;
    if (!anchor || !container) return;
    const anchorRect = anchor.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    x.set(anchorRect.left - containerRect.left);
    y.set(anchorRect.top - containerRect.top);
    width.set(anchorRect.width);
    height.set(anchorRect.height);
  }, Boolean(portalContainer));

  if (!portalContainer) return null;

  return createPortal(
    <motion.div
      aria-hidden
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width,
        height,
        x,
        y,
        zIndex,
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      <WorldWindowContext.Provider value={{ width, height }}>
        {children}
      </WorldWindowContext.Provider>
    </motion.div>,
    portalContainer,
  );
}
