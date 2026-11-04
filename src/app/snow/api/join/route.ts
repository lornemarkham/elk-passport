import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/currentUser";
import {
  answer,
  badRequest,
  bodyOf,
  requireAdventureSession,
  visitorDb,
} from "@/lib/adventures/server";
import { describeInvite } from "@/lib/adventures/store";
import { TOKEN_PATTERN } from "@/lib/adventures/rules";
import { isAbility, isDiscipline } from "@/domain/snow/ability";
import { clean } from "@/domain/snow/day";
import { SNOW_KIND, joinDay } from "../../_server/shared";

/** Whether a link still works, for the page that asks before joining. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("t") ?? "";
  if (!TOKEN_PATTERN.test(token)) return badRequest("That isn't a link.");
  return answer(async () => {
    const described = await describeInvite(await visitorDb(), token);
    if (!described || described.kind !== SNOW_KIND)
      return NextResponse.json({ state: "none", signedIn: false });
    return NextResponse.json({
      state: described.state,
      signedIn: Boolean(await currentUser().catch(() => null)),
    });
  });
}

/** Join from a link as yourself: `{ token, name, discipline, ability, ownGear? }`. */
export async function POST(request: Request) {
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;

  const b = (await bodyOf(request)) as Record<string, unknown> | null;
  const token = typeof b?.token === "string" ? b.token : "";
  if (!TOKEN_PATTERN.test(token)) return badRequest("That isn't a link.");
  const name = typeof b?.name === "string" ? clean(b.name, 30) : "";
  if (!name) return badRequest("Everyone needs a name.");
  if (!isAbility(b?.ability) || !isDiscipline(b?.discipline))
    return badRequest("Pick a level and what you're riding.");

  return answer(async () => {
    const id = await joinDay(session.db, session.user.id, token, {
      name,
      discipline: b.discipline as never,
      ability: b.ability as never,
      ownGear: b.ownGear !== false,
    });
    if (!id)
      return NextResponse.json(
        { error: "This link is no longer good." },
        { status: 410 },
      );
    return NextResponse.json({ id });
  });
}
