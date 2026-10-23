import { NextResponse } from "next/server";
import { conferenceContext, gate, NO_STORE } from "@/lib/conference/request";
import {
  answer,
  cancelPlan,
  chooseVenue,
  createPlan,
  readPlans,
  suggestVenue,
  updatePlan,
  vote,
  withdrawVenue,
} from "@/lib/conference-plans/service";
import { plansDeps } from "@/lib/conference-together/request";
import { body, notFound, reply } from "@/lib/conference-together/respond";

type Ctx = { params: Promise<{ id: string }> };

/** Every plan you may see, with who's coming to each occurrence. */
export async function GET(_request: Request, { params }: Ctx) {
  const g = await gate("existing");
  if ("response" in g) return g.response;
  const id = (await params).id;
  const ctx = await conferenceContext(id);
  if (!ctx) return notFound();
  const board = await readPlans(
    await plansDeps(ctx.conference),
    g.identity,
    id,
  );
  return board
    ? NextResponse.json({ ok: true, board }, { headers: NO_STORE })
    : notFound();
}

/**
 * Everything a member does to plans: `{action, ...}` with action one of
 * create · update · cancel · answer · suggest · withdraw · vote · choose.
 */
export async function POST(request: Request, { params }: Ctx) {
  const g = await gate("existing");
  if ("response" in g) return g.response;
  const id = (await params).id;
  const ctx = await conferenceContext(id);
  if (!ctx) return notFound();
  const b = await body(request);
  const d = await plansDeps(ctx.conference);
  switch (b.action) {
    case "create":
      return reply(await createPlan(d, g.identity, id, b.plan));
    case "update":
      return reply(await updatePlan(d, g.identity, id, b.planId, b.plan));
    case "cancel":
      return reply(await cancelPlan(d, g.identity, id, b.planId));
    case "answer":
      return reply(await answer(d, g.identity, id, b));
    case "suggest":
      return reply(await suggestVenue(d, g.identity, id, b));
    case "withdraw":
      return reply(await withdrawVenue(d, g.identity, id, b));
    case "vote":
      return reply(await vote(d, g.identity, id, b));
    case "choose":
      return reply(await chooseVenue(d, g.identity, id, b));
    default:
      return reply({ ok: false, error: "invalid" });
  }
}
