import {
  EMPTY_PREFS,
  PLACE_COOKIE,
  STORAGE_KEY,
  parsePrefs,
  saved,
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

/** `PLACE_COOKIE`: the shared place for the server's first render, or gone. */
function mirror(prefs: LocationPrefs): void {
  try {
    const townId = saved(prefs)?.townId;
    document.cookie = townId
      ? `${PLACE_COOKIE}=${encodeURIComponent(townId)}; path=/; max-age=31536000; SameSite=Lax`
      : `${PLACE_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  } catch {
    // No cookies: the page opens on its default and the bar corrects it.
  }
}

function read(): LocationPrefs {
  if (typeof window === "undefined") return EMPTY_PREFS;
  if (current) return current;
  try {
    current = parsePrefs(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    current = EMPTY_PREFS;
  }
  // A place chosen before the cookie existed reaches the server too.
  mirror(current);
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
  mirror(next);
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
