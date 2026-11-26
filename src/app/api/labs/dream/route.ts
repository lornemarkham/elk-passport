import { NextResponse } from "next/server";
import { z } from "zod";
import { dreamEnabled } from "@/lib/dream/flag";
import { dreamPool } from "@/lib/dream/server";
import { dayAsked, dream } from "@/domain/dream/compose";
import { figureRounds } from "@/domain/dream/figure";
import { reelFor } from "@/domain/dream/reel";
import { townById } from "@/domain/discovery/towns";
import { zoneDay } from "@/domain/discovery/hygiene";

/**
 * **`POST /api/labs/dream` — one conversation in, a few kilobytes out.**
 *
 * `{ turns }` answers what was said; `{ figure: true }` deals four pairs of
 * photographs for *help me figure it out*; `{ reel: true }` the opening
 * frames. Deterministic and keyless: there is no model call anywhere on this
 * route, so it costs nothing per request but a cached corpus read.
 *
 * 404 unless `dreamEnabled()` — the Labs flag.
 */
const body = z.object({
  turns: z.array(z.string().max(400)).max(8).optional(),
  at: z.string().max(40).optional(),
  seed: z.number().int().min(0).max(1000).optional(),
  keep: z.array(z.string().max(80)).max(6).optional(),
  without: z.array(z.string().max(80)).max(30).optional(),
  figure: z.boolean().optional(),
  reel: z.boolean().optional(),
});

export async function POST(request: Request) {
  if (!dreamEnabled()) return new NextResponse(null, { status: 404 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  const ask = parsed.data;
  const townId = ask.at && townById(ask.at) ? ask.at : "vernon";
  const started = performance.now();
  const turns = (ask.turns ?? []).map((t) => t.trim()).filter(Boolean);

  const read = await dreamPool(
    turns.length ? dayAsked(turns, zoneDay(new Date())) : undefined,
  );
  if (read.atlas !== "ok")
    return NextResponse.json({ atlas: "unreachable" }, { status: 503 });
  const atlasMs = Math.round(performance.now() - started);

  const result = ask.reel
    ? { reel: reelFor({ pool: read.pool, townId, today: read.today }) }
    : ask.figure
      ? {
          rounds: figureRounds({
            pool: read.pool,
            townId,
            today: read.today,
            ...(ask.seed !== undefined ? { seed: ask.seed } : {}),
          }),
        }
      : turns.length === 0
        ? { error: "say something" }
        : {
            answer: dream({
              pool: read.pool,
              turns,
              townId,
              today: read.today,
              ...(ask.seed !== undefined ? { seed: ask.seed } : {}),
              ...(ask.keep ? { keep: ask.keep } : {}),
              ...(ask.without ? { without: ask.without } : {}),
            }),
          };
  const totalMs = Math.round(performance.now() - started);
  return NextResponse.json(result, {
    status: "error" in result ? 400 : 200,
    headers: {
      // How long Atlas (normally the cache) and the composition took.
      "server-timing": `atlas;dur=${atlasMs}, compose;dur=${totalMs - atlasMs}`,
      "cache-control": "no-store",
    },
  });
}
