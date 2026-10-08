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
 * **The header that carries "this page is an experience domain's front door".**
 *
 * A rewrite changes the route the server renders and deliberately does not
 * change the URL the browser shows — that is the whole point of the domain
 * mapping. It also means `usePathname()` on `iamoctober.com/` reports `/`,
 * and anything deciding where you are from the browser path cannot tell this
 * page from Passport's own homepage.
 *
 * So the middleware states the rewrite on the request, and the one component
 * that needs to know — October's navigation — is told rather than guessing.
 * No component ever looks at a hostname.
 */
export const EXPERIENCE_PATH_HEADER = "x-experience-path";

/**
 * **Where "back to where you were" means, on a domain that is an experience.**
 *
 * A person who arrives on `iamoctober.com`, signs in, and is handed
 * Passport's generic `/discovery` has been ejected from the product they
 * chose. That happened in production: the whole auth chain defaults to
 * `/discovery` whenever it loses track of a destination, and the password
 * recovery chain lost track of one twice.
 *
 * This is the same table the rewrite uses, asked a different question —
 * *what is home here* — so a mapped domain only ever has to be declared once.
 * `null` for every other host, including `elk-passport.vercel.app`, which is
 * ordinary Passport and must keep ordinary Passport's defaults.
 */
export function experienceHomeFor(
  host: string | null | undefined,
): string | null {
  if (!host) return null;
  return EXPERIENCE_DOMAINS[normalizeHost(host)] ?? null;
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
