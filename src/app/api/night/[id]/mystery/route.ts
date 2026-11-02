import { NextResponse } from "next/server";
import { requireAdventureSession } from "@/lib/adventures/server";
import { addItem, adventureFor, Refused } from "@/lib/adventures/store";
import { nightForTitle, pickMystery } from "@/domain/date-night/adventures";
import { night } from "../../_http";

type Params = { params: Promise<{ id: string }> };

/**
 * Passport reveals a mystery: one real Atlas place, from the night's list,
 * that is not already on the plan, put forward as a proposal to vote on.
 */
export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  return night(async () => {
    const view = await adventureFor(session.db, id, session.user.id);
    if (!view) throw new Refused();
    const config = nightForTitle(view.title);
    const held = new Set(
      view.items.flatMap((i) => (i.atlasRef ? [i.atlasRef] : [])),
    );
    const pick = config ? pickMystery(config, held) : null;
    if (!pick)
      return NextResponse.json(
        { error: "Passport is out of surprises for now." },
        { status: 404 },
      );
    const itemId = await addItem(session.db, id, session.user.id, {
      atlasRef: pick,
      label: null,
      note: "Mystery pick from Passport.",
      status: "proposed",
      onDay: null,
      startsAt: null,
    });
    return NextResponse.json({ id: itemId, atlasRef: pick }, { status: 201 });
  });
}
