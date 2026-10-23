import { NextResponse } from "next/server";
import { gate, NO_STORE } from "@/lib/conference/request";
import { react, readRoom, say, unsay } from "@/lib/conference-chat/service";
import { chatDeps } from "@/lib/conference-together/request";
import { body, notFound, reply } from "@/lib/conference-together/respond";

type Ctx = { params: Promise<{ id: string }> };

/** `?room=<planId>` for a plan's thread; no room for the conference's. */
export async function GET(request: Request, { params }: Ctx) {
  const g = await gate("existing");
  if ("response" in g) return g.response;
  const room = new URL(request.url).searchParams.get("room");
  const view = await readRoom(chatDeps(), g.identity, (await params).id, room);
  return view
    ? NextResponse.json({ ok: true, room: view }, { headers: NO_STORE })
    : notFound();
}

/** `{action: "say", body, planId?}` · `{action: "unsay", room, messageId}` · `{action: "react", room, messageId, emoji}` */
export async function POST(request: Request, { params }: Ctx) {
  const g = await gate("existing");
  if ("response" in g) return g.response;
  const id = (await params).id;
  const b = await body(request);
  const d = chatDeps();
  switch (b.action) {
    case "say":
      return reply(await say(d, g.identity, id, b));
    case "unsay":
      return reply(await unsay(d, g.identity, id, b));
    case "react":
      return reply(await react(d, g.identity, id, b));
    default:
      return reply({ ok: false, error: "invalid" });
  }
}
