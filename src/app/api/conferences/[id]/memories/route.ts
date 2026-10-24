import { NextResponse } from "next/server";
import { gate, NO_STORE } from "@/lib/conference/request";
import { addPhoto, readAlbum } from "@/lib/conference-memories/service";
import { memoriesDeps } from "@/lib/conference-together/request";
import { body, notFound, reply } from "@/lib/conference-together/respond";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const g = await gate("existing");
  if ("response" in g) return g.response;
  const album = await readAlbum(memoriesDeps(), g.identity, (await params).id);
  return album
    ? NextResponse.json({ ok: true, album }, { headers: NO_STORE })
    : notFound();
}

/** `{data, caption?, planId?}`: a JPEG the phone already shrank, base64. */
export async function POST(request: Request, { params }: Ctx) {
  const g = await gate("existing");
  if ("response" in g) return g.response;
  return reply(
    await addPhoto(
      memoriesDeps(),
      g.identity,
      (await params).id,
      await body(request),
    ),
  );
}
