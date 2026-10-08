/**
 * **What we find out when something breaks in front of a real person.**
 *
 * Until now: nothing. There was no error reporting of any kind, one error
 * boundary on one unrelated route, and three `console.error` calls in the
 * whole application. A password-reset link that went to `localhost` was found
 * by a human clicking it, because that was the only detection mechanism we
 * had.
 *
 * ## Why this is a seam and not a vendor
 *
 * Server-side failures already reach Vercel's runtime logs, which is a real
 * place somebody can look. **Browser failures reach nothing at all**, and
 * October is mostly a client-rendered product — the discovery surface, the
 * save controls, Trust Me. So the smallest thing that closes the actual gap is
 * a way for the browser to tell the server, and one function that both sides
 * call.
 *
 * Adding Sentry later is this file's `deliver` function and a DSN. Nothing
 * that calls `reportError` has to change, which is the point of putting the
 * seam here rather than scattering a vendor's SDK through the components.
 *
 * ## What is deliberately not collected
 *
 * No cookies, no headers, no request bodies, no form values, no email
 * addresses, no Supabase session. A `Report` carries a message, a stack, the
 * route, and whatever small context the caller names — and `scrub` removes
 * anything that looks like a token or an email even from those, because the
 * one thing worse than no observability is observability that quietly becomes
 * a log of other people's credentials.
 */

export interface Report {
  /** What broke, in the error's own words. */
  readonly message: string;
  readonly stack?: string;
  /** Where the person was. A pathname, never a full URL with a query. */
  readonly route?: string;
  /** Next's own error id, which ties a client report to a server log line. */
  readonly digest?: string;
  /** Which boundary caught it — `october`, `global`, `client`. */
  readonly boundary?: string;
}

/** Anything that looks like a secret or a person, removed before it is logged. */
export function scrub(text: string): string {
  return (
    text
      .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
      .replace(/\beyJ[\w-]{10,}\.[\w-]+\.[\w-]+/g, "[jwt]")
      .replace(/\b(sb|sbp|eyJ)[\w-]{20,}/g, "[token]")
      // **Not only inside a URL.** The first version required `?` or `&` before
      // the key, and an error message does not write URLs — it says "reset
      // failed with code=…". Found in a real production log line, which
      // cheerfully carried the code.
      .replace(
        /\b(code|token|access_token|refresh_token|apikey|api_key)=[^&\s"']+/gi,
        "$1=[redacted]",
      )
  );
}

/** A report with every string scrubbed and nothing oversized. */
export function sanitize(report: Report): Report {
  // **Cut first, then scrub.** Scrubbing a 50,000-character stack and then
  // throwing away all but 4,000 of it meant the email pattern backtracked
  // across the whole thing — measured at eight seconds for one report, inside
  // an error boundary. Only what is emitted needs scrubbing, so only what is
  // emitted gets scrubbed.
  const cap = (value: string | undefined, max: number) =>
    value ? scrub(value.slice(0, max)) : undefined;
  return {
    message: cap(report.message, 500) ?? "Unknown error",
    ...(report.stack ? { stack: cap(report.stack, 4000) } : {}),
    ...(report.route ? { route: cap(report.route, 200) } : {}),
    ...(report.digest ? { digest: cap(report.digest, 100) } : {}),
    ...(report.boundary ? { boundary: cap(report.boundary, 40) } : {}),
  };
}

/**
 * Where a sanitized report goes.
 *
 * One line on stderr, structured so it can be searched in Vercel's logs and
 * parsed by a drain later. The prefix is deliberately distinctive: `[error]`
 * is what everything logs, `[october-error]` is what we put in an alert.
 */
function deliver(report: Report): void {
  console.error(`[october-error] ${JSON.stringify(report)}`);
}

/**
 * **Report a failure from either side of the wire.**
 *
 * On the server it logs. In the browser it posts to `/api/client-errors`,
 * which logs it on the server — `keepalive` so a report survives the
 * navigation that an error often causes, and every failure swallowed, because
 * an error reporter that throws is worse than one that misses.
 */
export function reportError(
  error: unknown,
  context: Partial<Report> = {},
): void {
  const report = sanitize({
    message:
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Non-error thrown",
    ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
    ...context,
  });

  if (typeof window === "undefined") {
    deliver(report);
    return;
  }

  try {
    void fetch("/api/client-errors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(report),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // A browser that refuses the request is not a reason to break the page
    // the person is already having trouble with.
  }
}

export { deliver as deliverForTests };
