import { NextResponse } from "next/server";
import {
  answer,
  badRequest,
  bodyOf,
  requireAdventureSession,
} from "@/lib/adventures/server";
import { parseShare } from "@/domain/snow/location";
import { Off, readCrew, share, stop } from "../../../_server/location";

const ID = /^[a-f0-9]{32}$/;
type Ctx = { params: Promise<{ id: string }> };
const NO_STORE = { "Cache-Control": "no-store" };

/** Run `work`, turning "the table isn't there yet" into an honest 501. */
async function guarded(work: () => Promise<NextResponse>) {
  return answer(async () => {
    try {
      return await work();
    } catch (e) {
      if (e instanceof Off)
        return NextResponse.json(
          { error: "off" },
          { status: 501, headers: NO_STORE },
        );
      throw e;
    }
  });
}

/** Who has chosen to be seen, if you have too. Never carries an account id. */
export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  if (!ID.test(id))
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  return guarded(async () =>
    NextResponse.json(await readCrew(session.db, id, session.user.id), {
      headers: NO_STORE,
    }),
  );
}

/**
 * `{ lat, lng, accuracyM?, minutes? }` — with `minutes` (30/60/120/240) it
 * begins a share; without, it moves the dot of a share already running.
 */
export async function PUT(request: Request, { params }: Ctx) {
  const { id } = await params;
  if (!ID.test(id))
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  const parsed = parseShare(await bodyOf(request));
  if (!parsed) return badRequest("That position wasn't understood.");
  return guarded(async () => {
    await share(session.db, id, parsed.fix, parsed.minutes);
    return NextResponse.json(await readCrew(session.db, id, session.user.id), {
      headers: NO_STORE,
    });
  });
}

/** Stop sharing now. */
export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params;
  if (!ID.test(id))
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  return guarded(async () => {
    await stop(session.db, id);
    return NextResponse.json(
      { sharing: null, others: [] },
      { headers: NO_STORE },
    );
  });
}
