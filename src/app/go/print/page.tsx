import type { Metadata } from "next";
import { listDiscoveryCandidates } from "@/lib/data/atlas-repo";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import { readBrief } from "@/domain/day/brief";
import { buildDay } from "@/domain/day/build";
import { AnalogGuide } from "@/components/go/AnalogGuide";
import { townById } from "@/domain/discovery/towns";
import {
  isTravelMode,
  type Journey,
  type TravelMode,
} from "@/lib/routing/journey";
import { isPlaced } from "@/lib/routing/legs";
import { dayLegs } from "@/lib/routing/dayLegs";
import { travelLegsFromAtlas } from "@/lib/routing/atlasLegs.server";
import type { TravelStatus } from "@/lib/routing/useTravelTimes";

export const metadata: Metadata = {
  title: "Your adventure — Go have a day",
};

/**
 * **`/go/print` — the thing you fold and put in the truck.**
 *
 * `ANALOG_PHILOSOPHY` in the Idea Atlas has been sitting in this repository
 * as a list of instructions nobody could follow: *print it, fold it, put it
 * in the truck. Use a real paper map. Circle things. Write notes. Go
 * somewhere with no cell service.* This is the page that makes that possible.
 *
 * ## It renders the day that was on screen, not a fresh one
 *
 * The stops arrive as **ids** in `?stops=`, and the builder is re-run only to
 * recover the reasons and the notes — then the order and membership from the
 * URL win. Re-planning here could hand somebody a different afternoon between
 * pressing print and the paper coming out, which is a small betrayal and a
 * completely avoidable one.
 *
 * ## No live connection is assumed past this point
 *
 * Everything needed is on the paper: addresses, the towns, Atlas's routed
 * travel time for each leg (or a straight line, labelled as one), what is published about hours and prices, what is not, the rules
 * worth knowing, and a map link for the drive **before** you leave. Nothing
 * on the guide requires a phone once it is printed, which is the entire idea.
 */
type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const one = (v: string | string[] | undefined) =>
  typeof v === "string" ? v : undefined;

export default async function PrintPage({ searchParams }: Props) {
  const query = (await searchParams) ?? {};
  const ids = (one(query.stops) ?? "").split(",").filter(Boolean);
  const askedAge = Number(one(query.age));
  const childAge =
    Number.isInteger(askedAge) && askedAge >= 0 && askedAge <= 17
      ? askedAge
      : undefined;

  const candidates = await listDiscoveryCandidates(childAge);
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const chosen = ids
    .map((id) => byId.get(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map(candidateToExperience);

  const hours = Number(one(query.hours));
  const brief = readBrief(one(query.say) ?? "", {
    ...(Number.isFinite(hours) ? { hours } : {}),
    ...(childAge !== undefined ? { childAge } : {}),
    ...(townById(one(query.at)) ? { town: townById(one(query.at))! } : {}),
    ...(one(query.on) ? { on: one(query.on)! } : {}),
  });

  // Re-run over exactly the chosen subjects: the builder is what knows how to
  // say why a stop is there and what its rules are, and running it over this
  // pool alone cannot change which places are on the paper.
  const day = buildDay({ pool: chosen, brief });
  const by = one(query.by);
  const mode = isTravelMode(by) ? by : "driving";

  return <AnalogGuide day={day} travel={await printedTravel(day, mode)} />;
}

/** Long enough for a cached answer; short enough not to hold up the paper. */
const PRINT_TRAVEL_TIMEOUT_MS = 5_000;

/**
 * **Travel for the paper, asked once.** The start is a town centre, never the
 * reader's position — this page is rendered on the server, which does not
 * have one. A failure prints straight lines, labelled, and says so.
 */
async function printedTravel(
  day: ReturnType<typeof buildDay>,
  mode: TravelMode,
): Promise<{
  mode: TravelMode;
  status: TravelStatus;
  journeys: (Journey | undefined)[];
}> {
  const { legs } = dayLegs(day);
  const journeys: (Journey | undefined)[] = legs.map(() => undefined);
  const placed = legs.flatMap((leg, i) => (isPlaced(leg) ? [{ leg, i }] : []));
  if (placed.length === 0) return { mode, status: "idle", journeys };
  try {
    const answer = await travelLegsFromAtlas(
      placed.map(({ leg }) => leg),
      mode,
      { timeoutMs: PRINT_TRAVEL_TIMEOUT_MS },
    );
    if (answer.state === "not-served") {
      return { mode, status: "not-served", journeys };
    }
    placed.forEach(({ i }, k) => {
      journeys[i] = answer.journeys[k];
    });
    return { mode, status: "ready", journeys };
  } catch {
    console.error("[atlas] travel legs unavailable for a printed guide");
    return { mode, status: "failed", journeys };
  }
}
