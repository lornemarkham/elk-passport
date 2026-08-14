"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { MotionValue } from "framer-motion";

export type AttentionState = "featured" | "supporting" | "ambient";

interface AttentionRecord {
  id: string;
  /** The card's own attention/intensity value — read by neighbors for
   * light-spill while this card is Featured. */
  intensity: MotionValue<number>;
}

interface AttentionFieldContextValue {
  register: (id: string, intensity: MotionValue<number>) => void;
  unregister: (id: string) => void;
  setInteracting: (id: string, interacting: boolean) => void;
  /** Every other registered card, for a given card's id. Deliberately a
   * function, not a precomputed list: today it always returns "everyone
   * else" because this milestone only ever has 2–3 cards on stage, so
   * "everyone else" and "my real spatial neighbors" are the same set. A
   * later, larger field swaps only this function for real distance-based
   * adjacency (Prompt 010 §5/§9) — nothing that calls it needs to change
   * when that happens, which is the whole point of it being a seam. */
  getNeighbors: (id: string) => string[];
  featuredId: string | null;
  /** The Featured card's own intensity, or `null` if nobody is Featured —
   * the light-spill source every Supporting card reads. */
  featuredIntensity: MotionValue<number> | null;
}

const AttentionFieldContext = createContext<AttentionFieldContextValue | null>(
  null,
);

/**
 * The Spotlight half of the Living World System (Prompt 010) — deliberately
 * *not* the full arbiter (Featured/Supporting/Spotlighted/Ambient/Resting,
 * with a cooldown-gated rare-event lottery). With only 2–3 cards there is
 * nothing to arbitrate: Featured is simply whichever registered card is
 * being hovered or dragged, and Supporting is everyone else. Building the
 * real scarcity arbiter now would be solving a problem — choosing fairly
 * among *many* candidates — this milestone doesn't have yet.
 *
 * What makes this evolutionary rather than disposable: every consumer
 * talks to this provider through the same shape the eventual arbiter will
 * expose (`register`/`unregister`, a per-card `attentionState`, a
 * `getNeighbors` seam, a light-spill source) — a future version replaces
 * what happens *inside* `setInteracting`/`getNeighbors` (a real cooldown
 * clock, a Spotlight lottery, real spatial adjacency) without changing
 * what any card calls or receives. Modeled directly on `WorldStage.tsx`'s
 * own register/report pattern for exactly this reason: it's already the
 * proven shape for "many independent cards share one small piece of
 * central state" in this codebase.
 */
export function AttentionFieldProvider({ children }: { children: ReactNode }) {
  const recordsRef = useRef(new Map<string, AttentionRecord>());
  const [featuredId, setFeaturedId] = useState<string | null>(null);
  const [featuredIntensity, setFeaturedIntensity] =
    useState<MotionValue<number> | null>(null);

  const register = useCallback((id: string, intensity: MotionValue<number>) => {
    recordsRef.current.set(id, { id, intensity });
  }, []);

  const unregister = useCallback((id: string) => {
    recordsRef.current.delete(id);
  }, []);

  const getNeighbors = useCallback((id: string) => {
    return Array.from(recordsRef.current.keys()).filter(
      (otherId) => otherId !== id,
    );
  }, []);

  const setInteracting = useCallback((id: string, interacting: boolean) => {
    const record = recordsRef.current.get(id);
    if (!record) return;

    setFeaturedId((current) => {
      if (interacting) return id;
      return current === id ? null : current;
    });
    setFeaturedIntensity((current) => {
      if (interacting) return record.intensity;
      return current === record.intensity ? null : current;
    });
  }, []);

  const value = useMemo(
    () => ({
      register,
      unregister,
      setInteracting,
      getNeighbors,
      featuredId,
      featuredIntensity,
    }),
    [
      register,
      unregister,
      setInteracting,
      getNeighbors,
      featuredId,
      featuredIntensity,
    ],
  );

  return (
    <AttentionFieldContext.Provider value={value}>
      {children}
    </AttentionFieldContext.Provider>
  );
}

export interface UseCardAttentionResult {
  attentionState: AttentionState;
  /** `null` unless this card is currently Supporting a Featured neighbor. */
  featuredIntensity: MotionValue<number> | null;
  reportInteracting: (interacting: boolean) => void;
}

/**
 * A card's one connection to the field's attention state. Registers for
 * the component's lifetime; returns a graceful, fully-functional "no field
 * present" result (`ambient`, no light-spill, a no-op reporter) outside an
 * `AttentionFieldProvider` — every existing solo-card usage must keep
 * working completely unmodified.
 */
export function useCardAttention(
  id: string,
  intensity: MotionValue<number>,
): UseCardAttentionResult {
  const ctx = useContext(AttentionFieldContext);

  useEffect(() => {
    if (!ctx) return;
    ctx.register(id, intensity);
    return () => ctx.unregister(id);
  }, [ctx, id, intensity]);

  const reportInteracting = useCallback(
    (interacting: boolean) => ctx?.setInteracting(id, interacting),
    [ctx, id],
  );

  if (!ctx) {
    return {
      attentionState: "ambient",
      featuredIntensity: null,
      reportInteracting: () => {},
    };
  }

  const attentionState: AttentionState =
    ctx.featuredId === id
      ? "featured"
      : ctx.featuredId !== null && ctx.getNeighbors(ctx.featuredId).includes(id)
        ? "supporting"
        : "ambient";

  return {
    attentionState,
    featuredIntensity: ctx.featuredId === id ? null : ctx.featuredIntensity,
    reportInteracting,
  };
}
