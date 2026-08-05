/**
 * Which board is active, persisted locally (MVP: localStorage is enough —
 * see `boards-repo.ts` for why board *content* itself is never trusted
 * from here, only fetched fresh from Atlas). Mirrors the same guarded,
 * fail-soft pattern as `domain/discovery/persistence.ts`.
 */
const STORAGE_KEY = "elk-passport:discovery-space:active-board-id";

export function getStoredActiveBoardId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredActiveBoardId(boardId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, boardId);
  } catch {
    // Storage can fail (quota, private browsing) — falling back to
    // Atlas's first board on the next load is an acceptable MVP tradeoff.
  }
}
