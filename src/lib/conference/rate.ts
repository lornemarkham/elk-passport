/**
 * **A brake on guessing access codes:** ten wrong codes per address per
 * fifteen minutes, per server instance.
 *
 * Only failures count. A hotel or an office full of colleagues shares one
 * address, and the eleventh person to type the *right* code must not be
 * locked out (the `/sycle` prototype found this by trying it). Not a security
 * boundary on its own: it turns a script into a slow script. A nine-character
 * code from a 31-letter alphabet is the actual boundary.
 */
const WINDOW = 15 * 60_000;
const LIMIT = 10;

export function failureBrake() {
  const failures = new Map<string, { n: number; since: number }>();
  return {
    blocked(address: string, now = Date.now()): boolean {
      const w = failures.get(address);
      return !!w && now - w.since <= WINDOW && w.n >= LIMIT;
    },
    fail(address: string, now = Date.now()): void {
      const w = failures.get(address);
      if (!w || now - w.since > WINDOW)
        failures.set(address, { n: 1, since: now });
      else w.n += 1;
    },
  };
}

const g = globalThis as unknown as {
  __conferenceBrake?: ReturnType<typeof failureBrake>;
};
export const codeBrake = () => (g.__conferenceBrake ??= failureBrake());
