/**
 * **Remember a pure reading of an object, for as long as the object lives.**
 *
 * Discovery reads the same ~3,400 immutable `Experience` objects on every
 * sentence somebody types: which activities Atlas's words put each one in,
 * its verbs, its kind's family, its title's key. Those are functions of the
 * object alone, so computing them once per object — not once per object per
 * search — changes no answer and takes the second search from "recompute
 * everything" to "look it up". Measured on the live corpus it was the top four
 * self-time entries of a search.
 *
 * Keyed by identity in a `WeakMap`, so nothing is retained once the pool is
 * replaced. **Only for objects that are never mutated after they are read** —
 * the experiences Discovery holds are built once by the mapper.
 */
export function memoizeByObject<K extends object, R>(
  read: (key: K) => R,
): (key: K) => R {
  const remembered = new WeakMap<K, R>();
  return (key) => {
    if (remembered.has(key)) return remembered.get(key) as R;
    const value = read(key);
    remembered.set(key, value);
    return value;
  };
}
