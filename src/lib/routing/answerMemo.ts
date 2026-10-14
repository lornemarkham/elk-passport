/**
 * **An answer Atlas already gave, kept for a few minutes** — in this tab, and
 * (through `askedOnce`) on the server instance that asked.
 *
 * Both travel routes are POSTs, so a position never enters a URL, and a
 * browser does not cache a POST, whatever `Cache-Control` the route sends.
 * Without this, switching a day from driving to walking and back asks Atlas
 * three times, and Atlas's provider quota is small: 50 openrouteservice
 * requests a day for the whole key, shared by every caller (travel-legs/1).
 *
 * Only answers are kept: `ready` and `not-served`. A failure is never kept,
 * so "Try again" always asks. The key is the exact question the hook sends,
 * already rounded, so nothing finer than what left the browser is held, and
 * nothing outlives the tab.
 */
export const MEMO_TTL_MS = 5 * 60_000;
const MEMO_MAX = 32;

export interface AnswerMemo<T> {
  get(key: string): T | undefined;
  set(key: string, answer: T): void;
  clear(): void;
}

export function answerMemo<T>({
  ttlMs = MEMO_TTL_MS,
  max = MEMO_MAX,
  now = () => Date.now(),
}: {
  readonly ttlMs?: number;
  readonly max?: number;
  readonly now?: () => number;
} = {}): AnswerMemo<T> {
  const held = new Map<string, { readonly at: number; readonly answer: T }>();
  return {
    get(key) {
      const entry = held.get(key);
      if (!entry) return undefined;
      if (now() - entry.at >= ttlMs) {
        held.delete(key);
        return undefined;
      }
      return entry.answer;
    },
    set(key, answer) {
      held.delete(key);
      held.set(key, { at: now(), answer });
      // A Map iterates in insertion order: the first key is the oldest.
      while (held.size > max) held.delete(held.keys().next().value!);
    },
    clear() {
      held.clear();
    },
  };
}

export interface AskedOnce<T> {
  /** The kept answer to `key`, the one already being asked, or a new ask. */
  ask(key: string, asking: () => Promise<T>): Promise<T>;
  clear(): void;
}

/**
 * **The server's half: one Atlas question per few minutes, per instance.**
 *
 * The browser's memo holds one tab's answers; this holds the server
 * instance's, so a hundred tabs asking the same day (or a script asking it a
 * hundred times) reach Atlas once. Identical questions already in flight
 * share one request. `keep` decides what is worth holding: a failure throws
 * and is never kept, and an answer the caller marks temporary should not be
 * either.
 *
 * Per instance and in memory: a cold start begins empty, and two instances
 * keep two copies. Nothing finer than what is sent to Atlas is in a key.
 */
export function askedOnce<T>({
  keep = () => true,
  ...options
}: {
  readonly ttlMs?: number;
  readonly max?: number;
  readonly now?: () => number;
  readonly keep?: (answer: T) => boolean;
} = {}): AskedOnce<T> {
  const memo = answerMemo<T>(options);
  const asking = new Map<string, Promise<T>>();
  return {
    ask(key, ask) {
      const kept = memo.get(key);
      if (kept !== undefined) return Promise.resolve(kept);
      const already = asking.get(key);
      if (already) return already;
      const pending = ask()
        .then((answer) => {
          if (keep(answer)) memo.set(key, answer);
          return answer;
        })
        .finally(() => asking.delete(key));
      asking.set(key, pending);
      return pending;
    },
    clear() {
      memo.clear();
      asking.clear();
    },
  };
}
