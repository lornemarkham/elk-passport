"use client";

import { useEffect, useReducer } from "react";
import {
  createInitialDiscoveryState,
  discoveryReducer,
  type DiscoveryBroadenStrategy,
  type DiscoveryState,
} from "@/domain/discovery/discoveryState";
import type { DiscoveryFilterState } from "@/domain/discovery/types";
import { createLocalDiscoveryPersistence } from "@/domain/discovery/persistence";
import {
  logDiscoveryEvent,
  type ExperienceInteractionAction,
} from "@/domain/discovery/interactions";

function createSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

// One Discovery Space renders per page, so a module-level singleton is
// simpler and just as correct as memoizing it per-instance — and avoids
// reading a ref during render (React refs must not be read while rendering;
// see useReducer's lazy initializer below, which runs during render).
const persistence = createLocalDiscoveryPersistence();

/**
 * Wires the pure `discoveryReducer` (src/domain/discovery/discoveryState.ts)
 * to React, local persistence, and interaction logging. This is the one
 * "Compass" instance `DiscoverySpace` talks to — see the IMP-004 spec's
 * "Compass is the single source of discovery truth" architecture decision.
 */
export function useDiscoveryEngine() {
  // Deliberately the *same* initial state on server and client — reading
  // localStorage inside this lazy initializer would make it run during SSR
  // (no persisted data) and differently during client hydration (real
  // persisted data), producing a server/client mismatch on the very first
  // render for any returning visitor with a Mood Board. Persisted state is
  // applied after mount instead, via the effect below.
  const [state, dispatch] = useReducer(discoveryReducer, undefined, () =>
    createInitialDiscoveryState(createSessionId()),
  );

  useEffect(() => {
    const persisted = persistence.load();
    if (!persisted) return;
    dispatch({
      type: "HYDRATE_PERSISTED",
      savedExperienceIds: persisted.savedExperienceIds,
      shelvedExperienceIds: persisted.shelvedExperienceIds,
      filters: persisted.filters,
      query: persisted.query,
    });
    // Runs once, after the client has hydrated — not on every state change.
  }, []);

  // Persist only the durable slice (Mood Board, shelved, last filters) —
  // rejected items and lastRemoved are session-scoped by design.
  useEffect(() => {
    persistence.save({
      savedExperienceIds: state.savedExperienceIds,
      shelvedExperienceIds: state.shelvedExperienceIds,
      filters: state.filters,
      query: state.query,
    });
  }, [
    state.savedExperienceIds,
    state.shelvedExperienceIds,
    state.filters,
    state.query,
  ]);

  function logInteraction(
    experienceId: string,
    action: ExperienceInteractionAction,
    source:
      "touch" | "mouse" | "keyboard" | "filter" | "text" | "voice" = "mouse",
  ) {
    logDiscoveryEvent({
      experienceId,
      action,
      sessionId: state.sessionId,
      occurredAt: nowIso(),
      source,
    });
  }

  return {
    state,

    setFilters(filters: DiscoveryFilterState) {
      dispatch({ type: "FILTER_REPLACE", filters });
      logDiscoveryEvent({
        type: "filter_applied",
        sessionId: state.sessionId,
        occurredAt: nowIso(),
      });
    },

    clearFilters() {
      dispatch({ type: "FILTER_CLEAR" });
      logDiscoveryEvent({
        type: "filter_removed",
        sessionId: state.sessionId,
        occurredAt: nowIso(),
      });
    },

    setQuery(query: string) {
      dispatch({ type: "QUERY_SET", value: query });
    },

    inspect(experienceId: string) {
      logInteraction(experienceId, "view");
    },

    save(experienceId: string) {
      dispatch({ type: "EXPERIENCE_SAVE", experienceId });
      logInteraction(experienceId, "save");
    },

    reject(experienceId: string) {
      dispatch({ type: "EXPERIENCE_REJECT", experienceId });
      logInteraction(experienceId, "reject");
    },

    shelf(experienceId: string) {
      dispatch({ type: "EXPERIENCE_SHELF", experienceId });
      logInteraction(experienceId, "shelf");
    },

    restore(experienceId: string) {
      dispatch({ type: "EXPERIENCE_RESTORE", experienceId });
      logInteraction(experienceId, "restore");
    },

    restoreLastRemoved() {
      if (!state.lastRemoved) return;
      const { experienceId } = state.lastRemoved;
      dispatch({ type: "EXPERIENCE_RESTORE", experienceId });
      logInteraction(experienceId, "restore");
    },

    removeSaved(experienceId: string) {
      // Removing from the Mood Board is a neutral "not this one," not a
      // reject signal — it returns the experience to the active pool
      // rather than marking it unwanted (IMP-004: "Allow removal of saved
      // items"; rejecting is a stronger, separate action).
      dispatch({ type: "EXPERIENCE_RESTORE", experienceId });
      logDiscoveryEvent({
        type: "mood_board_item_removed",
        sessionId: state.sessionId,
        occurredAt: nowIso(),
        experienceId,
      });
    },

    broaden(strategy: DiscoveryBroadenStrategy) {
      dispatch({ type: "DISCOVERY_BROADEN", strategy });
      logDiscoveryEvent({
        type: "discovery_broadened",
        sessionId: state.sessionId,
        occurredAt: nowIso(),
        strategy,
      });
    },

    reset() {
      dispatch({ type: "DISCOVERY_RESET" });
      logDiscoveryEvent({
        type: "session_reset",
        sessionId: state.sessionId,
        occurredAt: nowIso(),
      });
    },

    moodBoardOpened() {
      logDiscoveryEvent({
        type: "mood_board_opened",
        sessionId: state.sessionId,
        occurredAt: nowIso(),
      });
    },
  } as const;
}

export type DiscoveryEngine = ReturnType<typeof useDiscoveryEngine>;
export type { DiscoveryState };
