/**
 * Discovery persistence, isolated behind an interface (IMP-004: "Persistence
 * must be isolated behind an interface so that local storage can later be
 * replaced by authenticated server persistence") — mirrors the same pattern
 * already used for the Adventure flow's local data layer
 * (`src/lib/data/local-repo.ts`).
 *
 * Deliberately narrow: only what the IMP asks to survive a reload — Mood
 * Board (saved) items, shelved items, and the last session's filters/query.
 * Rejected items are intentionally excluded (see discoveryState.ts and the
 * IMP-004 completion report) — they're a within-session signal, not a
 * standing decision that should silently hide a category forever.
 */
import type { DiscoveryFilterState } from "./types";

export interface DiscoveryPersistedState {
  savedExperienceIds: string[];
  shelvedExperienceIds: string[];
  filters: DiscoveryFilterState;
  query: string;
}

export interface DiscoveryPersistence {
  load(): DiscoveryPersistedState | null;
  save(state: DiscoveryPersistedState): void;
  clear(): void;
}

const STORAGE_KEY = "elk-passport:discovery-space";

export function createLocalDiscoveryPersistence(): DiscoveryPersistence {
  return {
    load() {
      if (typeof window === "undefined") return null;
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as DiscoveryPersistedState) : null;
      } catch {
        return null;
      }
    },
    save(state) {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // Storage can fail (quota, private browsing) — Discovery should
        // keep working in-memory for the session rather than throw.
      }
    },
    clear() {
      if (typeof window === "undefined") return;
      window.localStorage.removeItem(STORAGE_KEY);
    },
  };
}
