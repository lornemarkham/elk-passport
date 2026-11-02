import { NextResponse } from "next/server";
import { answer, requireAdventureSession } from "@/lib/adventures/server";
import { adventureFor, Refused } from "@/lib/adventures/store";
import { listDiscoveryCandidates } from "@/lib/data/atlas-repo";
import { dayPool } from "@/lib/go/pool";
import { townById } from "@/domain/discovery/towns";
import { todayIn } from "@/lib/adventures/overview";
import { findPlacesFor } from "@/domain/occasion/ideas";
import type { Experience } from "@/domain/experience/types";

type Params = { params: Promise<{ id: string }> };

/**
 * **Real places for an idea** — `?q=go ice skating`.
 *
 * Any member may ask (Postgres decides who is one: an adventure this person
 * can't read is a 404). The adventure's own town and first day frame the
 * answer; Atlas's words decide which places belong (`findPlacesFor`).
 * Nothing is written: choosing a place is the ordinary `POST …/items`.
 */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  const q = (new URL(request.url).searchParams.get("q") ?? "")
    .trim()
    .slice(0, 120);
  if (!q) return NextResponse.json({ error: "Say what." }, { status: 400 });

  return answer(async () => {
    const view = await adventureFor(session.db, id, session.user.id);
    if (!view) throw new Refused();
    const town = townById(view.destinationTownId ?? undefined);
    const on = view.startsOn ?? todayIn();
    let candidates;
    try {
      candidates = await listDiscoveryCandidates(undefined, on);
    } catch {
      return NextResponse.json(
        { error: "Atlas can't be reached right now.", atlasDown: true },
        { status: 503 },
      );
    }
    const found = findPlacesFor(q, dayPool(candidates, []), {
      ...(town
        ? {
            origin: { latitude: town.latitude, longitude: town.longitude },
            town: town.name.replace(/,\s*BC$/, ""),
          }
        : {}),
      on,
    });
    // The browser needs a card, not the whole record.
    const slim = (e: Experience): Experience => ({
      ...e,
      description: undefined,
      knowledge: e.knowledge
        ? { ...e.knowledge, practical: undefined }
        : undefined,
      schedule: undefined,
      suitability: undefined,
      environment: undefined,
    });
    return NextResponse.json({
      ...found,
      options: found.options.map((o) => ({
        ...o,
        experience: slim(o.experience),
      })),
      further: found.further.map((o) => ({
        ...o,
        experience: slim(o.experience),
      })),
    });
  });
}
