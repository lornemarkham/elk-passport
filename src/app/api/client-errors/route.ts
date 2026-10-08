import { NextResponse } from "next/server";
import { sanitize, type Report } from "@/lib/observability/report";

/**
 * **Where a browser failure becomes something we can actually find.**
 *
 * Server errors already reach Vercel's runtime logs. Browser errors reached
 * nothing, and October is mostly rendered in the browser — discovery, the save
 * controls, Trust Me. This is the one line of wire between the two.
 *
 * ## It trusts nothing it is sent
 *
 * The body is attacker-controlled: anyone can POST here. So nothing is
 * forwarded verbatim. `sanitize` caps every field and strips anything shaped
 * like an email, a JWT or an auth code, and only five known fields survive —
 * a caller cannot smuggle a sixth into the log. The response is always 204
 * whatever happens, because a reporter that can be probed for errors is a
 * reporter that tells somebody about our internals.
 *
 * Unauthenticated on purpose: the failures most worth hearing about are the
 * ones that happen to people who are not signed in, and requiring a session
 * would silence exactly those.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const raw: unknown = await request.json();
    if (!raw || typeof raw !== "object")
      return new NextResponse(null, { status: 204 });

    const body = raw as Partial<Report>;
    if (typeof body.message !== "string" || body.message.length === 0) {
      return new NextResponse(null, { status: 204 });
    }

    const report = sanitize({
      message: body.message,
      ...(typeof body.stack === "string" ? { stack: body.stack } : {}),
      ...(typeof body.route === "string" ? { route: body.route } : {}),
      ...(typeof body.digest === "string" ? { digest: body.digest } : {}),
      ...(typeof body.boundary === "string" ? { boundary: body.boundary } : {}),
    });

    console.error(
      `[october-error] ${JSON.stringify({ ...report, from: "client" })}`,
    );
  } catch {
    // A malformed body is not worth a log line and certainly not a 500.
  }
  return new NextResponse(null, { status: 204 });
}
