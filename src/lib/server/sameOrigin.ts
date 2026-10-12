/**
 * **Whether a request came from a page on this site.**
 *
 * A POST route that spends something on Passport's behalf — an Atlas request,
 * a provider's quota — should not be drivable by a script on somebody else's
 * page. A browser says where a request came from: `Sec-Fetch-Site` (modern
 * browsers, unforgeable by page script) and `Origin` (every cross-origin
 * request, and every POST). Either one saying "elsewhere" refuses it.
 *
 * A request carrying neither is not from a browser page — `curl`, a server, a
 * test — and is let through: this is not authentication, and the rate limit
 * and Atlas's own quota are what bound such a caller. `same-site` is allowed
 * because the experience domains are served by this same deployment;
 * `vercel.app` is a public suffix, so another Vercel project is `cross-site`.
 */
export function isSameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site") return false;

  const origin = request.headers.get("origin");
  if (origin === null) return true;
  let from: string;
  try {
    from = new URL(origin).host;
  } catch {
    // Includes the literal "null" a sandboxed frame or a data: URL sends.
    return false;
  }
  const hosts = [
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim(),
    request.headers.get("host")?.trim(),
    hostOf(request.url),
  ];
  return hosts.some((host) => host !== undefined && host === from);
}

const hostOf = (url: string): string | undefined => {
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
};

/** The 403 a cross-site request gets. */
export function crossSiteRefused(): Response {
  return Response.json(
    { error: "cross-site" },
    { status: 403, headers: { "Cache-Control": "no-store" } },
  );
}
