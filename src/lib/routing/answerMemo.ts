/**
 * **An answer Atlas already gave, kept for a few minutes in this tab.**
 *
 * Both travel routes are POSTs, so a position never enters a URL, and a
 * browser does not cache a POST, whatever `Cache-Control` the route sends.
 * Without this, switching a day from driving to walking and back asks Atlas
 * three times, and Atlas's provider quota is small (openrouteservice's free
 * plan is counted in hundreds of matrix requests a day; ADR 097).
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
