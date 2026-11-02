import { NextResponse } from "next/server";
import {
  badRequest,
  bodyOf,
  requireAdventureSession,
} from "@/lib/adventures/server";
import { nightConfig } from "@/domain/date-night/adventures";
import { startNight } from "@/lib/date-night/night";
import { night } from "../_http";

/** `{ slug }` — open (or start) your own copy of that night. */
export async function POST(request: Request) {
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  const body = (await bodyOf(request)) as { slug?: unknown } | null;
  const config =
    typeof body?.slug === "string" ? nightConfig(body.slug) : undefined;
  if (!config) return badRequest("Which night?");
  return night(async () =>
    NextResponse.json({
      id: await startNight(
        session.db,
        session.user.id,
        session.user.displayName ?? null,
        config,
      ),
    }),
  );
}
