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

export function safeNext(value: string | null | undefined): string {
  if (!value) return DEFAULT_NEXT;

  // `//evil.example` looks relative to the eye and is not — the browser reads
  // it as protocol-relative and leaves the site. Same for a backslash, which
  // some browsers normalise to a slash.
  if (!value.startsWith("/")) return DEFAULT_NEXT;
  if (value.startsWith("//") || value.startsWith("/\\")) return DEFAULT_NEXT;

  return value;
}
