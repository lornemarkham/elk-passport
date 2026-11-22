import "server-only";
import { todayIn } from "@/lib/adventures/overview";
import { townById } from "@/domain/discovery/towns";
import { readAsk } from "@/domain/christmas/discover";
import { readRequest, type Request } from "@/domain/christmas/request";
import {
  planItinerary,
  readEdits,
  type Itinerary,
} from "@/domain/christmas/itinerary";
import type { AtlasFailure } from "@/lib/data/atlasAuth";
import { christmasPool } from "./corpus";
import { lightsFor, viewer } from "./lights";
import { whereAreWe } from "./where";

type Params = Readonly<Record<string, string | string[] | undefined>>;

/**
 * **One plan from one address** — the itinerary page and the save route both
 * read the plan this way, so what is saved is what was shown: recomputed on
 * the server from the sentence and the edits, never taken from the browser.
 */
export async function planFor(params: Params): Promise<{
  readonly say: string;
  readonly request: Request;
  readonly itinerary: Itinerary;
  readonly town: { readonly id: string; readonly name: string };
  readonly outage?: AtlasFailure;
} | null> {
  const say =
    typeof params.say === "string" ? params.say.trim().slice(0, 240) : "";
  if (!say) return null;
  const today = todayIn();
  const request = readRequest(say, today);
  const asked = typeof params.at === "string" ? params.at : undefined;
  const where = await whereAreWe(townById(asked)?.id ?? request.at);
  const town = townById(where.at)!;
  // How far somebody said they will go (2 / 5 / 10 / 20 / 30 / 50, thirty by
  // default) is how far the plan reaches, unless the sentence itself says
  // "within 10 km".
  const { km } = readAsk(params);
  const [pool, lights] = await Promise.all([
    christmasPool({ at: town.id, km, ages: [] }),
    viewer().then((v) => lightsFor(v)),
  ]);
  const name = town.name.replace(/,\s*BC$/, "");
  const itinerary = planItinerary(
    request,
    {
      experiences: pool.experiences,
      pins: lights.pins,
      origin: {
        id: town.id,
        name,
        latitude: town.latitude,
        longitude: town.longitude,
      },
      today,
      reachKm: km,
    },
    readEdits(params),
  );
  return {
    say,
    request,
    itinerary,
    town: { id: town.id, name },
    ...(pool.outage ? { outage: pool.outage } : {}),
  };
}
