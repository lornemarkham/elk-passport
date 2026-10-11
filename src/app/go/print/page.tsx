import type { Metadata } from "next";
import { readBrief } from "@/domain/day/brief";
import { buildDay } from "@/domain/day/build";
import { resolvePrintDay } from "@/lib/go/printDay";
import { PrintableAdventure } from "@/components/adventure/PrintableAdventure";
import { printableFromDay } from "@/lib/analog/printable";
import {
  isTravelMode,
  type Journey,
  type TravelMode,
} from "@/lib/routing/journey";
import { isPlaced, travelTotal } from "@/lib/routing/legs";
import { dayLegs, unknownsWithTravel } from "@/lib/routing/dayLegs";
import type { RouteOptions } from "@/lib/analog/route";
import { printTravel } from "./travel";
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
 *
 * ## The layout
 *
 * `components/adventure/PrintableAdventure` takes the day and adds a
 * checklist, time and money at a glance, side quests and room to write.
 * `printableFromDay` is the adapter, and the layout depends on nothing else.
 */
type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PrintPage({ searchParams }: Props) {
  const resolved = await resolvePrintDay((await searchParams) ?? {});
  if (resolved.kind === "unreachable") {
    // As before: with Atlas down there is no honest paper to print.
    throw new Error("Atlas is unreachable; the day cannot be printed");
  }
  if (resolved.kind === "none") {
    return (
      <PrintableAdventure
        adventure={printableFromDay(
          buildDay({ pool: [], brief: readBrief(resolved.query.say) }),
        )}
      />
    );
  }
  const { day, query } = resolved;
  const by = query.by;
  const mode = isTravelMode(by) ? by : "driving";

  const travel = await printedTravel(day, mode);
  return (
    <PrintableAdventure
      adventure={printableFromDay(
        { ...day, unknowns: travel.unknowns },
        travel.options,
      )}
    />
  );
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
): Promise<{ options: RouteOptions; unknowns: readonly string[] }> {
  const { legs } = dayLegs(day);
  const journeys: (Journey | undefined)[] = legs.map(() => undefined);
  const placed = legs.flatMap((leg, i) => (isPlaced(leg) ? [{ leg, i }] : []));
  let status: TravelStatus = "idle";
  if (placed.length > 0) {
    try {
      const answer = await travelLegsFromAtlas(
        placed.map(({ leg }) => leg),
        mode,
        { timeoutMs: PRINT_TRAVEL_TIMEOUT_MS },
      );
      if (answer.state === "not-served") status = "not-served";
      else {
        placed.forEach(({ i }, k) => {
          journeys[i] = answer.journeys[k] ?? undefined;
        });
        status = "ready";
      }
    } catch {
      console.error("[atlas] travel legs unavailable for a printed guide");
      status = "failed";
    }
  }
  return {
    options: printTravel(
      legs,
      journeys,
      status,
      mode,
      day.stops.reduce((sum, stop) => sum + stop.minutes, 0),
    ),
    unknowns: unknownsWithTravel(
      day.unknowns,
      status,
      travelTotal(legs, journeys, mode),
    ),
  };
}
