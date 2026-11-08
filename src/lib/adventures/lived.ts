/**
 * **"We did it" — said on the phone that lived the day.**
 *
 * An adventure becomes a memory in two ways. Its dates pass (`adventureStatus`
 * calls that _done_), or the person finishes the day on their phone — every
 * stop marked done or skipped in _Start your day_ — which can happen hours
 * before the date is over. The second is a device mark, like every other
 * mark the companion keeps (ADR 014: personal memories stay on the phone), so
 * My Stuff reads it from here and nothing is written to the server.
 *
 * Doctrine §2.9 / §15.14: this does not name the Want / Plan / Lived states.
 * It only lets a finished day be found under Memories.
 */

const PREFIX = "gh.lived.";

const store = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

/** The day was finished (or reopened) on this phone. */
export function markLived(adventureId: string, day: string, lived: boolean) {
  const s = store();
  if (!s) return;
  try {
    if (lived) s.setItem(`${PREFIX}${adventureId}`, day);
    else s.removeItem(`${PREFIX}${adventureId}`);
  } catch {
    // A phone that won't keep it still showed it.
  }
}

/** Every adventure finished on this phone. */
export function livedHere(): ReadonlySet<string> {
  const s = store();
  if (!s) return new Set();
  const ids = new Set<string>();
  try {
    for (let i = 0; i < s.length; i++) {
      const key = s.key(i);
      if (key?.startsWith(PREFIX)) ids.add(key.slice(PREFIX.length));
    }
  } catch {
    // Nothing readable is nothing lived.
  }
  return ids;
}
