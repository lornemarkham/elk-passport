/**
 * Discovery state and command model (IMP-004). This is the "Compass" the
 * IMP-004 spec describes: the single source of discovery truth that every
 * input method (filters, card actions, typed query, and eventually touch
 * gestures and Atlas voice) dispatches into rather than each implementing
 * its own save/reject/filter logic.
 *
 * Kept pure and framework-free on purpose — no React, no storage, no
 * side effects — so it can be unit tested directly and reused by any future
 * input adapter without dragging UI concerns along with it. `useDiscoveryEngine`
 * (in the discovery-space lab) is what wires this to React, persistence, and
 * interaction logging.
 */
import { createEmptyFilterState, type DiscoveryFilterState } from "./types";

export type DiscoverySortMode = "default";

/**
 * `lastRemoved` exists so "Undo" (Acceptance Criteria: "the user can undo
 * or restore at least the most recent removal action") can be a single
 * `restoreLastRemoved()` call rather than the UI having to separately track
 * what just happened. It is cleared by restoring, saving, or resetting.
 */
export interface DiscoveryState {
  filters: DiscoveryFilterState;
  query: string;
  savedExperienceIds: string[];
  rejectedExperienceIds: string[];
  shelvedExperienceIds: string[];
  lastRemoved: { experienceId: string; action: "reject" | "shelf" } | null;
  sortMode: DiscoverySortMode;
  sessionId: string;
}

export type DiscoveryBroadenStrategy =
  "clear-filters" | "restore-rejected" | "return-shelved" | "all";

export type DiscoveryCommand =
  | { type: "FILTER_SET"; key: keyof DiscoveryFilterState; value: unknown }
  | { type: "FILTER_REPLACE"; filters: DiscoveryFilterState }
  | { type: "FILTER_CLEAR" }
  | { type: "QUERY_SET"; value: string }
  | { type: "EXPERIENCE_SAVE"; experienceId: string }
  | { type: "EXPERIENCE_REJECT"; experienceId: string }
  | { type: "EXPERIENCE_SHELF"; experienceId: string }
  | { type: "EXPERIENCE_RESTORE"; experienceId: string }
  | { type: "DISCOVERY_BROADEN"; strategy: DiscoveryBroadenStrategy }
  | { type: "DISCOVERY_RESET" }
  | {
      type: "HYDRATE_PERSISTED";
      savedExperienceIds: string[];
      shelvedExperienceIds: string[];
      filters: DiscoveryFilterState;
      query: string;
    };

export function createInitialDiscoveryState(sessionId: string): DiscoveryState {
  return {
    filters: createEmptyFilterState(),
    query: "",
    savedExperienceIds: [],
    rejectedExperienceIds: [],
    shelvedExperienceIds: [],
    lastRemoved: null,
    sortMode: "default",
    sessionId,
  };
}

function without(ids: string[], id: string): string[] {
  return ids.filter((existing) => existing !== id);
}

function withId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids : [...ids, id];
}

/**
 * Pure state transition function — the one place discovery state actually
 * changes. Every input adapter (filters, card buttons, future gestures,
 * future typed/voice intent) should produce a `DiscoveryCommand` and call
 * this rather than mutating discovery state directly.
 */
export function discoveryReducer(
  state: DiscoveryState,
  command: DiscoveryCommand,
): DiscoveryState {
  switch (command.type) {
    case "FILTER_SET":
      return {
        ...state,
        filters: { ...state.filters, [command.key]: command.value },
      };

    case "FILTER_REPLACE":
      return { ...state, filters: command.filters };

    case "FILTER_CLEAR":
      return { ...state, filters: createEmptyFilterState() };

    case "QUERY_SET":
      return { ...state, query: command.value };

    case "EXPERIENCE_SAVE":
      return {
        ...state,
        savedExperienceIds: withId(
          state.savedExperienceIds,
          command.experienceId,
        ),
        rejectedExperienceIds: without(
          state.rejectedExperienceIds,
          command.experienceId,
        ),
        shelvedExperienceIds: without(
          state.shelvedExperienceIds,
          command.experienceId,
        ),
        lastRemoved:
          state.lastRemoved?.experienceId === command.experienceId
            ? null
            : state.lastRemoved,
      };

    case "EXPERIENCE_REJECT":
      return {
        ...state,
        rejectedExperienceIds: withId(
          state.rejectedExperienceIds,
          command.experienceId,
        ),
        savedExperienceIds: without(
          state.savedExperienceIds,
          command.experienceId,
        ),
        shelvedExperienceIds: without(
          state.shelvedExperienceIds,
          command.experienceId,
        ),
        lastRemoved: { experienceId: command.experienceId, action: "reject" },
      };

    case "EXPERIENCE_SHELF":
      return {
        ...state,
        shelvedExperienceIds: withId(
          state.shelvedExperienceIds,
          command.experienceId,
        ),
        savedExperienceIds: without(
          state.savedExperienceIds,
          command.experienceId,
        ),
        rejectedExperienceIds: without(
          state.rejectedExperienceIds,
          command.experienceId,
        ),
        lastRemoved: { experienceId: command.experienceId, action: "shelf" },
      };

    case "EXPERIENCE_RESTORE":
      return {
        ...state,
        rejectedExperienceIds: without(
          state.rejectedExperienceIds,
          command.experienceId,
        ),
        shelvedExperienceIds: without(
          state.shelvedExperienceIds,
          command.experienceId,
        ),
        lastRemoved:
          state.lastRemoved?.experienceId === command.experienceId
            ? null
            : state.lastRemoved,
      };

    case "DISCOVERY_BROADEN": {
      const clearFilters =
        command.strategy === "clear-filters" || command.strategy === "all";
      const restoreRejected =
        command.strategy === "restore-rejected" || command.strategy === "all";
      const returnShelved =
        command.strategy === "return-shelved" || command.strategy === "all";

      return {
        ...state,
        filters: clearFilters ? createEmptyFilterState() : state.filters,
        query: clearFilters ? "" : state.query,
        rejectedExperienceIds: restoreRejected
          ? []
          : state.rejectedExperienceIds,
        shelvedExperienceIds: returnShelved ? [] : state.shelvedExperienceIds,
        lastRemoved: null,
      };
    }

    // Clears session-scoped state (filters, query, rejected, shelved).
    // Saved experiences are deliberately preserved — the Mood Board is a
    // remembered collection the person built on purpose, not session noise,
    // per the "session state vs. remembered preference state" architecture
    // decision in the IMP. See the completion report for this call-out.
    case "DISCOVERY_RESET":
      return {
        ...state,
        filters: createEmptyFilterState(),
        query: "",
        rejectedExperienceIds: [],
        shelvedExperienceIds: [],
        lastRemoved: null,
      };

    // Applies persisted Mood Board/shelved/filters/query state loaded from
    // localStorage. Deliberately a dispatched command applied *after* the
    // initial render (see useDiscoveryEngine) rather than read during state
    // initialization — reading localStorage synchronously during the first
    // render produces a different result on the server (no localStorage)
    // than on the client (real persisted data), which is a server/client
    // hydration mismatch, not a design choice.
    case "HYDRATE_PERSISTED":
      return {
        ...state,
        savedExperienceIds: command.savedExperienceIds,
        shelvedExperienceIds: command.shelvedExperienceIds,
        filters: command.filters,
        query: command.query,
      };

    default:
      return state;
  }
}
