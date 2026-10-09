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
/**
 * **One experience, declared once.**
 *
 * This was a `host → path` map, and then two other places needed to ask the
 * same question a different way — *is this path part of an experience*, and
 * *what does a person call it* — which is how special-case hostname and
 * `startsWith("/october")` checks start spreading through components.
 *
 * So the table holds the whole fact. A future month is still one more entry
 * (`{ host: "iamjanuary.com", home: "/january/discover", at: "/january",
 * name: "January" }`) and nothing else has to learn about it.
 */
interface ExperienceDomain {
  /** The domain whose root is this experience's front door. */
  readonly host: string;
  /** Where "home here" means — what the root rewrites to, and where auth returns. */
  readonly home: string;
  /** The path prefix every page of this experience lives under. */
  readonly at: string;
  /** What a person calls it, for a link back to it. */
  readonly name: string;
}

const EXPERIENCES: readonly ExperienceDomain[] = [
  {
    host: "iamoctober.com",
    home: "/october/discover",
    at: "/october",
    name: "October",
  },
];

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
  const normalized = normalizeHost(host);
  return EXPERIENCES.find((e) => e.host === normalized)?.home ?? null;
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
  return experienceHomeFor(host);
}

/**
 * **Which experience a path belongs to, whatever host it is served from.**
 *
 * `/account` is shared: the same page serves a Passport user and an October
 * one, and on `elk-passport.vercel.app` the host says nothing. What it does
 * have is where the person came from, so a page that has been handed a
 * destination can ask what that destination *is* and name the way back
 * truthfully — "← October" rather than "← Discovery", which on production
 * walked an October reader into a cream page titled Passport with no route
 * home.
 *
 * `null` for a Passport path, which keeps Passport's own wording.
 */
export function experienceForPath(
  path: string | null | undefined,
): ExperienceDomain | null {
  if (!path) return null;
  return (
    EXPERIENCES.find((e) => path === e.at || path.startsWith(`${e.at}/`)) ??
    null
  );
}
