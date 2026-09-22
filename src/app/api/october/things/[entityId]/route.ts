import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import {
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
