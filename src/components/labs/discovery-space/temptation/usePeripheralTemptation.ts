"use client";

import { useEffect, useRef, useState } from "react";
import type { ActiveTemptation, Experience } from "../types";
import {
  DEBUG_FIRST_TEMPTATION_MAX_DELAY_MS,
  DEBUG_FIRST_TEMPTATION_MIN_DELAY_MS,
  DEBUG_NEXT_TEMPTATION_MAX_DELAY_MS,
  DEBUG_NEXT_TEMPTATION_MIN_DELAY_MS,
  FIRST_TEMPTATION_MAX_DELAY_MS,
  FIRST_TEMPTATION_MIN_DELAY_MS,
  NEXT_TEMPTATION_MAX_DELAY_MS,
  NEXT_TEMPTATION_MIN_DELAY_MS,
  NO_ELIGIBLE_RETRY_MAX_DELAY_MS,
  NO_ELIGIBLE_RETRY_MIN_DELAY_MS,
  TEMPTATION_DEBUG,
  TEMPTATION_MAX_DURATION_MS,
  TEMPTATION_MIN_DURATION_MS,
} from "./constants";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

interface UsePeripheralTemptationOptions {
  cards: Experience[];
  hoveredCardId?: string | null;
  draggedCardId?: string | null;
  moodBoardCardIds: string[];
  /** Lets a caller kill-switch the whole experiment without unmounting it. */
  enabled?: boolean;
}

function randomInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min));
}

function pickEligibleCard(
  cards: Experience[],
  hoveredCardId: string | null,
  draggedCardId: string | null,
  moodBoardCardIds: string[],
  lastCardId: string | null,
): Experience | null {
  const eligible = cards.filter(
    (card) =>
      card.temptation !== undefined &&
      card.id !== hoveredCardId &&
      card.id !== draggedCardId &&
      !moodBoardCardIds.includes(card.id),
  );

  if (eligible.length === 0) return null;

  const candidates =
    eligible.length > 1
      ? eligible.filter((card) => card.id !== lastCardId)
      : eligible;

  const pool = candidates.length > 0 ? candidates : eligible;
  return pool[randomInt(0, pool.length)];
}

/**
 * Owns all Peripheral Temptation timing and selection. Renders nothing —
 * callers hand the returned `ActiveTemptation` to whatever draws it. See
 * the module doc in `CardTemptation.tsx` for the rendering side.
 */
export function usePeripheralTemptation({
  cards,
  hoveredCardId = null,
  draggedCardId = null,
  moodBoardCardIds,
  enabled = true,
}: UsePeripheralTemptationOptions): ActiveTemptation {
  const prefersReducedMotion = usePrefersReducedMotion();
  const active = enabled && !prefersReducedMotion;

  const [activeTemptation, setActiveTemptation] =
    useState<ActiveTemptation>(null);

  // Latest-value refs so the timeout callbacks below never close over stale
  // props/state, without turning every prop into an effect dependency.
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const hoveredCardIdRef = useRef(hoveredCardId);
  hoveredCardIdRef.current = hoveredCardId;
  const draggedCardIdRef = useRef(draggedCardId);
  draggedCardIdRef.current = draggedCardId;
  const moodBoardCardIdsRef = useRef(moodBoardCardIds);
  moodBoardCardIdsRef.current = moodBoardCardIds;
  const activeRef = useRef(active);
  activeRef.current = active;

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);
  const lastCardIdRef = useRef<string | null>(null);
  const instanceCounterRef = useRef(0);

  const clearScheduled = () => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const scheduleAfter = (delayMs: number, callback: () => void) => {
    clearScheduled();
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      callback();
    }, delayMs);
  };

  const firstDelayRange = TEMPTATION_DEBUG
    ? [DEBUG_FIRST_TEMPTATION_MIN_DELAY_MS, DEBUG_FIRST_TEMPTATION_MAX_DELAY_MS]
    : [FIRST_TEMPTATION_MIN_DELAY_MS, FIRST_TEMPTATION_MAX_DELAY_MS];
  const nextDelayRange = TEMPTATION_DEBUG
    ? [DEBUG_NEXT_TEMPTATION_MIN_DELAY_MS, DEBUG_NEXT_TEMPTATION_MAX_DELAY_MS]
    : [NEXT_TEMPTATION_MIN_DELAY_MS, NEXT_TEMPTATION_MAX_DELAY_MS];

  const scheduleFirstAttempt = () => {
    scheduleAfter(randomInt(firstDelayRange[0], firstDelayRange[1]), attempt);
  };

  const scheduleNextAttempt = () => {
    scheduleAfter(randomInt(nextDelayRange[0], nextDelayRange[1]), attempt);
  };

  const scheduleRetryAfterNoEligible = () => {
    scheduleAfter(
      randomInt(NO_ELIGIBLE_RETRY_MIN_DELAY_MS, NO_ELIGIBLE_RETRY_MAX_DELAY_MS),
      attempt,
    );
  };

  function attempt() {
    if (!mountedRef.current || !activeRef.current) return;
    if (typeof document !== "undefined" && document.hidden) return;

    const card = pickEligibleCard(
      cardsRef.current,
      hoveredCardIdRef.current,
      draggedCardIdRef.current,
      moodBoardCardIdsRef.current,
      lastCardIdRef.current,
    );

    if (!card || !card.temptation) {
      scheduleRetryAfterNoEligible();
      return;
    }

    const durationMs = randomInt(
      TEMPTATION_MIN_DURATION_MS,
      TEMPTATION_MAX_DURATION_MS,
    );
    const instanceId = ++instanceCounterRef.current;
    lastCardIdRef.current = card.id;

    if (TEMPTATION_DEBUG) {
      console.log("[peripheral-temptation]", card.id, card.temptation);
    }

    setActiveTemptation({
      cardId: card.id,
      kind: card.temptation,
      instanceId,
      durationMs,
    });

    scheduleAfter(durationMs, endEvent);
  }

  function endEvent() {
    setActiveTemptation(null);
    if (!mountedRef.current || !activeRef.current) return;
    if (typeof document !== "undefined" && document.hidden) return;
    scheduleNextAttempt();
  }

  // Mount/unmount lifecycle, tracked separately from the scheduling effect
  // below so a mid-session `enabled`/reduced-motion flip doesn't get
  // mistaken for a real unmount.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // (Re)starts the whole cadence whenever the experiment turns on, and
  // tears everything down the moment it turns off (reduced motion, or the
  // caller disabling it).
  useEffect(() => {
    if (!active) {
      clearScheduled();
      return;
    }

    scheduleFirstAttempt();

    return () => {
      clearScheduled();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Tab visibility: hidden cancels everything without preserving progress;
  // becoming visible again starts a fresh randomized delay, never an
  // immediate or queued event.
  useEffect(() => {
    function handleVisibilityChange() {
      clearScheduled();
      if (document.hidden) {
        setActiveTemptation(null);
        return;
      }
      if (activeRef.current) {
        scheduleFirstAttempt();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debug-only: press `T` to fire the next eligible temptation immediately.
  // The listener is never registered when TEMPTATION_DEBUG is false.
  useEffect(() => {
    if (!TEMPTATION_DEBUG) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "t" || event.key === "T") {
        attempt();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Gate on `active` here (render time) rather than clearing state inside
  // the effect above — reduced motion or `enabled: false` should hide any
  // in-flight event immediately without an extra setState-in-effect render.
  return active ? activeTemptation : null;
}
