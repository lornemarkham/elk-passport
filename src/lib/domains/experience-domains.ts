/**
 * **Some domains are an experience, not Passport.**
 *
 * `iamoctober.com` is October, and its front door should be October's
 * Discover rather than Passport's own homepage. The page itself is not copied:
 * the middleware *rewrites* the domain's root to the existing route, so the
 * browser stays on the domain and the route stays the one implementation.
 *
 * Only the root is mapped. Every other path on these domains is served as it
 * is on any Passport host, so `/october/mine`, `/auth` and `/api/*` keep
 * working and links inside the experience need no knowledge of the domain.
 *
 * A future month is one more entry here (say `iamjanuary.com` →
 * `/january/discover`); nothing else has to learn about it. Hosts not listed —
 * `elk-passport.vercel.app`, previews, localhost — are plain Passport.
 */
const EXPERIENCE_DOMAINS: Readonly<Record<string, string>> = {
  "iamoctober.com": "/october/discover",
};

/** `WWW.IAmOctober.com:443` and `iamoctober.com` are the same front door. */
function normalizeHost(host: string): string {
  return host
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/^www\./, "")
    .replace(/\.$/, "");
}

/**
 * The internal path a request should be rewritten to, or `null` to serve it
 * as requested.
 */
export function experienceRewriteFor(
  host: string | null | undefined,
  pathname: string,
): string | null {
  if (!host || pathname !== "/") return null;
  return EXPERIENCE_DOMAINS[normalizeHost(host)] ?? null;
}
