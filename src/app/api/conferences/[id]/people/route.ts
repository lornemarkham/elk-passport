import { NextResponse } from "next/server";
import { gate, NO_STORE } from "@/lib/conference/request";
import { move, readPeople, share, stop } from "@/lib/conference-people/service";
import { peopleDeps } from "@/lib/conference-together/request";
import { body, notFound, reply } from "@/lib/conference-together/respond";

type Ctx = { params: Promise<{ id: string }> };

/** Coworkers sharing where they are right now (unexpired, seen, members only). */
export async function GET(_request: Request, { params }: Ctx) {
  const g = await gate("existing");
  if ("response" in g) return g.response;
  const view = await readPeople(peopleDeps(), g.identity, (await params).id);
  return view
    ? NextResponse.json({ ok: true, people: view }, { headers: NO_STORE })
    : notFound();
}

/** `{action: "share", lat, lon, accuracy?, minutes, note?}` · `{action: "move", lat, lon, accuracy?}` */
export async function POST(request: Request, { params }: Ctx) {
  const g = await gate("existing");
  if ("response" in g) return g.response;
  const id = (await params).id;
  const b = await body(request);
  if (b.action === "share")
    return reply(await share(peopleDeps(), g.identity, id, b));
  if (b.action === "move")
    return reply(await move(peopleDeps(), g.identity, id, b));
  return reply({ ok: false, error: "invalid" });
}

/** Stop sharing. The position is deleted, not hidden. */
export async function DELETE(_request: Request, { params }: Ctx) {
  const g = await gate("existing");
  if ("response" in g) return g.response;
  return reply(await stop(peopleDeps(), g.identity, (await params).id));
}
