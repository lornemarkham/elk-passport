import {
  EMPTY_PREFS,
  STORAGE_KEY,
  parsePrefs,
  serialisePrefs,
  type LocationPrefs,
} from "@/domain/location/prefs";

/**
 * **The one place a visitor's place lives in the browser.**
 *
 * A tiny external store over `localStorage`, read with
 * `useSyncExternalStore` so every experience on the page — and every tab —
 * sees the same answer, and so the server render (which can know nothing) and
 * the first client render agree. Private mode and a full disk degrade to
 * memory for the visit rather than throwing.
 */
let current: LocationPrefs | undefined;
const listeners = new Set<() => void>();

function read(): LocationPrefs {
  if (typeof window === "undefined") return EMPTY_PREFS;
  if (current) return current;
  try {
    current = parsePrefs(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    current = EMPTY_PREFS;
  }
  return current;
}

export const getPrefs = read;
export const getServerPrefs = (): LocationPrefs => EMPTY_PREFS;

export function updatePrefs(
  change: (prefs: LocationPrefs) => LocationPrefs,
): void {
  const next = change(read());
  if (next === current) return;
  current = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, serialisePrefs(next));
  } catch {
    // Kept in memory for this visit.
  }
  listeners.forEach((l) => l());
}

export function subscribePrefs(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    current = parsePrefs(event.newValue);
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Tests only. */
export function resetPrefsForTest(): void {
  current = undefined;
  listeners.forEach((l) => l());
}
