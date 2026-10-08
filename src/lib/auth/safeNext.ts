/**
 * **Where to send someone after they sign in.**
 *
 * Passport asks for identity at exactly one moment — you tried to keep
 * something — and the only decent answer is to put you back where you were.
 * That means a `?next=` in the URL, and a `next=` anyone can write is an open
 * redirect unless something refuses the hostile shapes.
 *
 * Same-site absolute paths only. Anything else goes to the default rather than
 * being repaired, because "repair a URL an attacker supplied" is not a job with
 * a safe version.
 */
export const DEFAULT_NEXT = "/discovery";

export function safeNext(
  value: string | null | undefined,
  /**
   * Where to go when there is nothing usable to go back to.
   *
   * Defaults to Passport's own Discovery, which is right for Passport and
   * wrong for an experience domain — `iamoctober.com` hands somebody who has
   * just signed in to a product they did not ask for. Callers that know which
   * host they are on pass `experienceHomeFor(host) ?? DEFAULT_NEXT`.
   */
  fallback: string = DEFAULT_NEXT,
): string {
  if (!value) return fallback;

  // `//evil.example` looks relative to the eye and is not — the browser reads
  // it as protocol-relative and leaves the site. Same for a backslash, which
  // some browsers normalise to a slash.
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;

  return value;
}
