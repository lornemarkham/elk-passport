import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import {
  livedOnDay,
  planThing,
  forgetThing,
  isOctoberKind,
  livedThing,
  wantThing,
} from "@/lib/october/octoberThings";

type Params = { params: Promise<{ entityId: string }> };

/**
 * PUT = "want to do". The body carries the snapshot — kind, name, and an
 * Event's start — because the server does not re-read Atlas to learn what
 * the person just looked at. The identity is the session's, never the body's.
 */
export async function PUT(request: Request, { params }: Params) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { entityId } = await params;
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const startsAt = typeof body?.startsAt === "string" ? body.startsAt : null;

  if (!name || !isOctoberKind(body?.entityKind)) {
    return NextResponse.json(
      { error: "A Thing needs a name and a kind Passport recognises." },
      { status: 400 },
    );
  }

  const thing = await wantThing(auth.user, {
    entityId,
    entityKind: body.entityKind,
    name,
    startsAt,
  });
  return NextResponse.json(thing, { status: 201 });
}

/**
 * PATCH = "it is on this day", or "it happened on that one".
 *
 * Separate from PUT because PUT is idempotent by design — saving the same
 * thing twice must never rewrite what is already there — so it cannot also be
 * the way a date is set. A body of `{ day: null }` takes the day back off.
 *
 * `{ livedOn }` is the other direction: correcting the day something actually
 * happened, for somebody catching up on Sunday about a Friday. It is a repair
 * to a memory and never a way to make one, so it only moves a Thing that is
 * already lived. The two are mutually exclusive — one request changes one
 * day — because a body carrying both would have to invent a precedence rule.
 */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { entityId } = await params;
  const body = await request.json().catch(() => null);
  const day: unknown = body?.day;
  const livedOn: unknown = body?.livedOn;

  const isDay = (v: unknown): v is string =>
    typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

  if (livedOn !== undefined) {
    if (day !== undefined) {
      return NextResponse.json(
        { error: "Send a day or a livedOn, not both." },
        { status: 400 },
      );
    }
    if (!isDay(livedOn)) {
      return NextResponse.json(
        { error: "A livedOn is YYYY-MM-DD." },
        { status: 400 },
      );
    }
    const moved = await livedOnDay(auth.user, entityId, livedOn);
    if (!moved) {
      return NextResponse.json(
        { error: "Not something you have lived." },
        { status: 404 },
      );
    }
    return NextResponse.json(moved);
  }

  if (!(day === null || isDay(day))) {
    return NextResponse.json(
      { error: "A day is YYYY-MM-DD, or null to remove it." },
      { status: 400 },
    );
  }

  const thing = await planThing(auth.user, entityId, day as string | null);
  if (!thing) {
    return NextResponse.json(
      { error: "Not in your October." },
      { status: 404 },
    );
  }
  return NextResponse.json(thing);
}

/** POST = "did this". The only way a Thing becomes lived. */
export async function POST(_request: Request, { params }: Params) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { entityId } = await params;
  const thing = await livedThing(auth.user, entityId);
  if (!thing) {
    return NextResponse.json(
      { error: "That isn't in your October." },
      { status: 404 },
    );
  }
  return NextResponse.json(thing);
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { entityId } = await params;
  await forgetThing(auth.user, entityId);
  return new NextResponse(null, { status: 204 });
}
