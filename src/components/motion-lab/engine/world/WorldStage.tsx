"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { useMotionValue, type MotionValue } from "framer-motion";

/**
 * Sprint 005/Phase 1 — the shared world. Everything here exists to answer
 * one question: what does a stage need to own so that objects can sense a
 * shared pointer, hold a real position instead of "always relative to
 * origin," and settle without either snapping back or drifting forever?
 *
 * Two tiers of state, deliberately: React state below is for things that
 * change rarely (mount/unmount, reduced-motion). Everything per-frame —
 * position, proximity, rest detection — lives in a plain mutable Map and is
 * pushed straight into motion values from one shared tick. No object's
 * movement ever causes a React re-render of anything.
 */

interface ObjectRecord {
  x: MotionValue<number>;
  y: MotionValue<number>;
  rawProximity: MotionValue<number>;
  rawDx: MotionValue<number>;
  rawDy: MotionValue<number>;
  awarenessRadiusPx: number;
  homeX: number;
  homeY: number;
  isDragging: boolean;
  lastX: number;
  lastY: number;
  stillFrames: number;
  getRect: () => DOMRect | null;
}

interface WorldStageContextValue {
  stageRef: RefObject<HTMLDivElement | null>;
  register: (id: string, record: ObjectRecord) => void;
  unregister: (id: string) => void;
  setDragging: (id: string, dragging: boolean) => void;
  prefersReducedMotion: boolean;
}

const WorldStageContext = createContext<WorldStageContextValue | null>(null);

// Deliberately almost imperceptible per-frame — this is quiet infrastructure,
// not a delight moment. Its whole job is to be invisible: a resting object
// takes several seconds to visibly creep home, and any direct grab
// interrupts it instantly.
const REST_EPSILON_PX = 0.15;
const REST_FRAMES_BEFORE_DRIFT = 36;
const DRIFT_RATE = 0.02;

export function WorldStageProvider({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const objectsRef = useRef(new Map<string, ObjectRecord>());
  const pointerRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (event: MediaQueryListEvent) =>
      setPrefersReducedMotion(event.matches);
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  const register = useCallback((id: string, record: ObjectRecord) => {
    objectsRef.current.set(id, record);
  }, []);

  const unregister = useCallback((id: string) => {
    objectsRef.current.delete(id);
  }, []);

  const setDragging = useCallback((id: string, dragging: boolean) => {
    const record = objectsRef.current.get(id);
    if (!record) return;
    record.isDragging = dragging;
    if (dragging) record.stillFrames = 0;
  }, []);

  // One shared pointer listener for the entire stage, not one per object.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const handleMouseMove = (event: MouseEvent) => {
      const rect = stage.getBoundingClientRect();
      pointerRef.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    };
    stage.addEventListener("mousemove", handleMouseMove);
    return () => stage.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // The one shared tick: proximity sensing and rest-detection/soft-home
  // drift for every registered object, computed once per frame regardless
  // of how many objects exist.
  useEffect(() => {
    if (prefersReducedMotion) return;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const stageRect = stageRef.current?.getBoundingClientRect() ?? null;

      objectsRef.current.forEach((record) => {
        if (stageRect) {
          const objRect = record.getRect();
          if (objRect) {
            const centerX = objRect.left + objRect.width / 2 - stageRect.left;
            const centerY = objRect.top + objRect.height / 2 - stageRect.top;
            const dx = pointerRef.current.x - centerX;
            const dy = pointerRef.current.y - centerY;
            const distance = Math.hypot(dx, dy);
            const halfDiagonal = Math.hypot(
              objRect.width / 2,
              objRect.height / 2,
            );
            const edgeDistance = Math.max(0, distance - halfDiagonal);
            const normalized =
              1 - Math.min(1, edgeDistance / record.awarenessRadiusPx);
            record.rawProximity.set(normalized);
            record.rawDx.set(dx);
            record.rawDy.set(dy);
          }
        }

        if (!record.isDragging) {
          const x = record.x.get();
          const y = record.y.get();
          const moved = Math.hypot(x - record.lastX, y - record.lastY);
          record.lastX = x;
          record.lastY = y;

          if (moved > REST_EPSILON_PX) {
            record.stillFrames = 0;
          } else {
            record.stillFrames += 1;
            if (record.stillFrames > REST_FRAMES_BEFORE_DRIFT) {
              record.x.set(x + (record.homeX - x) * DRIFT_RATE);
              record.y.set(y + (record.homeY - y) * DRIFT_RATE);
            }
          }
        }
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [prefersReducedMotion]);

  const value: WorldStageContextValue = {
    stageRef,
    register,
    unregister,
    setDragging,
    prefersReducedMotion,
  };

  return (
    <WorldStageContext.Provider value={value}>
      <div ref={stageRef} className={className}>
        {children}
      </div>
    </WorldStageContext.Provider>
  );
}

function useWorldStageContext(): WorldStageContextValue {
  const ctx = useContext(WorldStageContext);
  if (!ctx) throw new Error("Must be used within a WorldStageProvider");
  return ctx;
}

export function useStageRef(): RefObject<HTMLDivElement | null> {
  return useWorldStageContext().stageRef;
}

export function useStageReducedMotion(): boolean {
  return useWorldStageContext().prefersReducedMotion;
}

export interface WorldObjectHandle {
  x: MotionValue<number>;
  y: MotionValue<number>;
  rawProximity: MotionValue<number>;
  rawDx: MotionValue<number>;
  rawDy: MotionValue<number>;
  /** Tells the shared tick how to measure this object's current bounding rect. */
  reportRect: (getRect: () => DOMRect | null) => void;
  /** Tells the shared tick whether this object is actively being dragged (pauses rest-detection/drift while true). */
  setDragging: (dragging: boolean) => void;
}

/**
 * Registers one object with the world. Position is a real, persistent
 * offset from `home` (default the object's natural layout position) — not
 * something that resets to zero whenever a gesture ends. Proximity/lean
 * direction are sensed once per frame by the shared tick, not by a private
 * `mousemove` listener this hook would otherwise need its own copy of.
 */
export function useWorldObject(
  awarenessRadiusPx: number,
  home: { x: number; y: number } = { x: 0, y: 0 },
): WorldObjectHandle {
  const {
    register,
    unregister,
    setDragging: setDraggingContext,
  } = useWorldStageContext();
  const [id] = useState(
    () => `world-object-${Math.random().toString(36).slice(2)}`,
  );

  const x = useMotionValue(home.x);
  const y = useMotionValue(home.y);
  const rawProximity = useMotionValue(0);
  const rawDx = useMotionValue(0);
  const rawDy = useMotionValue(0);

  const rectGetterRef = useRef<() => DOMRect | null>(() => null);

  // A single mutable record, created and registered inside an effect — never
  // read or written during render, which this lint config disallows even
  // for the "lazy init" idiom. A ref is still the right container for
  // something genuinely mutated imperatively afterward (by the shared tick,
  // by drag handlers); `useState` values must stay immutable, refs don't
  // have that constraint. Re-registering when `awarenessRadiusPx` changes
  // (e.g. a debug-slider edit to Attention) is a deliberate, harmless
  // simplification — the only cost is losing a few frames of rest-detection
  // history, not anything felt.
  const recordRef = useRef<ObjectRecord | null>(null);

  useEffect(() => {
    const record: ObjectRecord = {
      x,
      y,
      rawProximity,
      rawDx,
      rawDy,
      awarenessRadiusPx,
      homeX: home.x,
      homeY: home.y,
      isDragging: false,
      lastX: home.x,
      lastY: home.y,
      stillFrames: 0,
      getRect: () => rectGetterRef.current(),
    };
    recordRef.current = record;
    register(id, record);
    return () => {
      recordRef.current = null;
      unregister(id);
    };
  }, [
    id,
    register,
    unregister,
    x,
    y,
    rawProximity,
    rawDx,
    rawDy,
    awarenessRadiusPx,
    home.x,
    home.y,
  ]);

  const reportRect = useCallback((getRect: () => DOMRect | null) => {
    rectGetterRef.current = getRect;
  }, []);

  const setDragging = useCallback(
    (dragging: boolean) => setDraggingContext(id, dragging),
    [id, setDraggingContext],
  );

  return { x, y, rawProximity, rawDx, rawDy, reportRect, setDragging };
}
