/**
 * **Dream is a Labs experiment, off in production until somebody turns it on.**
 *
 * `GHAD_DREAM=on` opens `/labs/dream` and its endpoint; anything else in
 * production is a 404, so merging this code changes nothing anybody sees.
 * In development it is on unless `GHAD_DREAM=off`. Reversible by one
 * environment variable, and by deleting `src/{app/labs,components,domain,lib}/dream`.
 */
type Env = Readonly<Record<string, string | undefined>>;

export function dreamEnabled(
  env: Env = process.env,
  isDev: boolean = process.env.NODE_ENV !== "production",
): boolean {
  if (env.GHAD_DREAM === "on") return true;
  if (env.GHAD_DREAM === "off") return false;
  return isDev;
}
