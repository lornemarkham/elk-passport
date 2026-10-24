import { NextResponse } from "next/server";
import {
  answer,
  badRequest,
  bodyOf,
  requireAdventureSession,
} from "@/lib/adventures/server";
import { Refused, roleIn, swapDays } from "@/lib/adventures/store";

type Params = { params: Promise<{ id: string }> };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** **Swap two days' plans** — stops and sentences both. Owner only. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  const body = (await bodyOf(request)) as { days?: unknown } | null;
  const days = Array.isArray(body?.days) ? body.days : [];
  if (
    days.length !== 2 ||
    !days.every((d): d is string => typeof d === "string" && DAY.test(d)) ||
    days[0] === days[1]
  )
    return badRequest("Say which two days to swap.");

  return answer(async () => {
    if ((await roleIn(session.db, id)) !== "owner") throw new Refused();
    await swapDays(session.db, id, session.user.id, days[0], days[1]);
    return NextResponse.json({ swapped: days });
  });
}
