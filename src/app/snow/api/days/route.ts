import { NextResponse } from "next/server";
import {
  answer,
  badRequest,
  bodyOf,
  requireAdventureSession,
} from "@/lib/adventures/server";
import { isAbility, isDiscipline } from "@/domain/snow/ability";
import { clean } from "@/domain/snow/day";
import { startDay } from "../../_server/shared";

/**
 * Start a snow day together: `{ title, name, discipline, ability, ownGear?,
 * note? }`. Signed in is required; the caller becomes the host.
 */
export async function POST(request: Request) {
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;

  const b = (await bodyOf(request)) as Record<string, unknown> | null;
  const name = typeof b?.name === "string" ? clean(b.name, 30) : "";
  if (!name) return badRequest("Everyone needs a name.");
  if (!isAbility(b?.ability) || !isDiscipline(b?.discipline))
    return badRequest("Pick a level and what you're riding.");

  return answer(async () => {
    const id = await startDay(session.db, session.user.id, {
      title:
        (typeof b?.title === "string" ? clean(b.title, 60) : "") ||
        "Our snow day",
      name,
      discipline: b.discipline as never,
      ability: b.ability as never,
      ownGear: b.ownGear !== false,
      note: typeof b?.note === "string" ? clean(b.note, 80) : undefined,
    });
    return NextResponse.json({ id });
  });
}
