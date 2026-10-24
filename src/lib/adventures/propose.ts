import "server-only";
import { listDiscoveryCandidates } from "@/lib/data/atlas-repo";
import type { DiscoveryCandidate } from "@/lib/data/types";
import {
  heardIn,
  readBrief,
  removedStop,
  replacedStop,
  reviseBrief,
  stopCountChange,
  type DayBrief,
} from "@/domain/day/brief";
import { uncarryBrief } from "@/domain/day/carry";
import { buildDay, MAX_STOPS, type DayPlanned } from "@/domain/day/build";
import { timelineFor } from "@/domain/day/timeline";
import { townById } from "@/domain/discovery/towns";
import type { Experience } from "@/domain/experience/types";
import { dayPool } from "@/lib/go/pool";
import { resolvePrintDay } from "@/lib/go/printDay";
import {
  dayQueryFor,
  readDayQuery,
  writeDayQuery,
} from "@/lib/domains/integration/dayQuery";
import { askFrom, daysBetween, MAX_SEED } from "./days";
import { readChange } from "./sentence";
import type { AdventureView } from "./store";

/**
 * **Passport's half of shaping an adventure — with the Day Builder's own
 * engine** (ADR 012).
 *
 * There is still one planner. Every day here is `readBrief` → `buildDay`
 * over `dayPool`, exactly what `/go` runs in the browser, and every change
 * is `reviseBrief` → `buildDay`, exactly what `/go` runs when somebody types
 * under a day. The only things this module adds are the things an adventure
 * has and a single day does not: several days that should not repeat each
 * other, stops somebody kept, and a preview before anything is written.
 *
 * Nothing is invented. Every stop is an Atlas subject from
 * `/discovery/candidates`; a day Atlas cannot fill is shorter, and says why.
 */

/** Atlas could not be asked. The adventure still works; this part does not. */
export class AtlasUnavailable extends Error {
  constructor() {
    super("Atlas can't be reached right now.");
    this.name = "AtlasUnavailable";
  }
}

async function candidatesFor(
  age: number | undefined,
  on: string,
): Promise<DiscoveryCandidate[]> {
  try {
    return await listDiscoveryCandidates(age, on);
  } catch {
    throw new AtlasUnavailable();
  }
}

// ------------------------------------------------------------------ sketch

export interface SketchInput {
  /** The adventure's days, in order. */
  readonly days: readonly string[];
  readonly townId: string;
  /** The sentence the guided start wrote. */
  readonly say: string;
  readonly childAge?: number;
  /** Saved places the person chose: kept on the days first. */
  readonly seeds?: readonly string[];
}

export interface SketchedDay {
  readonly onDay: string;
  /** The day query, as `/go` would write it — what `saveDay` keeps. */
  readonly query: string;
  readonly stops: readonly string[];
}

/**
 * **The first meaningful result**: a day built for each of the adventure's
 * days. Chosen places are shared out across the days (at most `MAX_SEED` a
 * day); a place used on one day is not offered again on the next.
 */
export async function sketchDays(input: SketchInput): Promise<SketchedDay[]> {
  const town = townById(input.townId);
  if (!town) return [];
  const seeds = [...new Set(input.seeds ?? [])];
  const used: string[] = [];
  const out: SketchedDay[] = [];
  for (const [index, onDay] of input.days.entries()) {
    const candidates = await candidatesFor(input.childAge, onDay);
    const mine = seeds
      .filter((_, i) => i % input.days.length === index)
      .slice(0, MAX_SEED);
    const pool = dayPool(candidates, seeds);
    const brief = readBrief(input.say, {
      town,
      on: onDay,
      ...(input.childAge !== undefined ? { childAge: input.childAge } : {}),
    });
    const day = buildDay({
      pool,
      brief,
      keep: mine,
      picked: mine,
      without: used,
    });
    const stops = day.stops.map((s) => s.experience.id);
    if (stops.length === 0) continue;
    used.push(...stops);
    out.push({ onDay, query: writeDayQuery(dayQueryFor(brief, day)), stops });
  }
  return out;
}

// ---------------------------------------------------------------- the page

/** What the adventure page shows about one stop, beyond its Atlas card. */
export interface StopDetail {
  /** Why it is here, in the builder's words. */
  readonly because: string;
  /** Minutes the plan sets aside — arithmetic, not a claim. */
  readonly minutes: number;
  /** Atlas's word on the chosen date, where it states one. */
  readonly open?: string;
  /** Published hours, quoted. */
  readonly hours?: string;
  /** Published price, quoted. */
  readonly cost?: string;
  readonly notes: readonly string[];
  readonly fit?: string;
  readonly challenge?: string;
  readonly rain?: "stands" | "exposed" | "may-not-run";
  readonly rainPlan?: { readonly id: string; readonly title: string };
  /** About when, from a stated start — minutes after midnight. */
  readonly arrive?: number;
  readonly leave?: number;
}

export interface DayDetail {
  readonly onDay: string;
  /** The builder's name for the day ("A slow morning by the lake"). */
  readonly title?: string;
  readonly opening?: string;
  readonly stops: Readonly<Record<string, StopDetail>>;
  /** What Passport could not find out, named. */
  readonly unknowns: readonly string[];
  readonly leftOut: readonly string[];
  /** The day's clock is from a time somebody said. */
  readonly clocked: boolean;
}

/**
 * The reasons, hours and durations for each planned day, recovered the way
 * the printed day recovers them (`resolvePrintDay`): the stops are the ones
 * on the adventure, in its order, and the builder is re-run only to say why.
 * A day with no kept sentence (placed by hand) has none to recover.
 */
export async function dayDetails(
  view: AdventureView,
): Promise<Record<string, DayDetail>> {
  const asks = new Map(view.days.map((d) => [d.onDay, d.ask]));
  const byDay = new Map<string, string[]>();
  for (const item of [...view.items].sort((a, b) => a.position - b.position)) {
    if (!item.onDay || !item.atlasRef) continue;
    byDay.set(item.onDay, [...(byDay.get(item.onDay) ?? []), item.atlasRef]);
  }
  const out: Record<string, DayDetail> = {};
  await Promise.all(
    [...byDay].map(async ([onDay, stops]) => {
      const ask = asks.get(onDay) ?? defaultAsk(view, onDay);
      if (!ask) return;
      const raw = Object.fromEntries(new URLSearchParams(ask));
      const resolved = await resolvePrintDay({
        ...raw,
        on: onDay,
        stops: stops.slice(0, MAX_STOPS).join(","),
      }).catch(() => null);
      if (!resolved || resolved.kind !== "day") return;
      out[onDay] = detailOf(onDay, resolved.day);
    }),
  );
  return out;
}

/** A day placed by hand still has a town and a date to be read against. */
function defaultAsk(view: AdventureView, onDay: string): string | null {
  if (!view.destinationTownId) return null;
  return new URLSearchParams({
    say: "a good day out",
    at: view.destinationTownId,
    on: onDay,
  }).toString();
}

function detailOf(onDay: string, day: DayPlanned): DayDetail {
  const timeline = timelineFor(day, [], "driving");
  return {
    onDay,
    ...(day.title ? { title: day.title } : {}),
    ...(day.opening ? { opening: day.opening } : {}),
    stops: Object.fromEntries(
      day.stops.map((stop, i) => {
        const clock = timeline?.stops[i];
        const detail: StopDetail = {
          because: stop.because,
          minutes: stop.minutes,
          notes: stop.notes,
          ...(stop.open ? { open: stop.open } : {}),
          ...(stop.hours ? { hours: stop.hours } : {}),
          ...(stop.cost ? { cost: stop.cost } : {}),
          ...(stop.fit ? { fit: stop.fit } : {}),
          ...(stop.challenge ? { challenge: stop.challenge } : {}),
          ...(stop.rain ? { rain: stop.rain } : {}),
          ...(stop.rainPlan
            ? {
                rainPlan: {
                  id: stop.rainPlan.experience.id,
                  title: stop.rainPlan.experience.title,
                },
              }
            : {}),
          ...(clock ? { arrive: clock.arrive, leave: clock.leave } : {}),
        };
        return [stop.experience.id, detail];
      }),
    ),
    unknowns: day.unknowns,
    leftOut: day.leftOut ?? [],
    clocked: Boolean(timeline),
  };
}

// --------------------------------------------------------------- changing

export interface PreviewStop {
  readonly id: string;
  readonly title: string;
  readonly kept: boolean;
}

export interface DayChange {
  readonly onDay: string;
  readonly before: readonly PreviewStop[];
  readonly after: readonly PreviewStop[];
  /** What the reader understood, in its own words. */
  readonly heard: readonly string[];
  /** The new day, ready for `saveDay` in `propose` mode. */
  readonly query: string;
  /** The day as it is now — Undo posts this back. */
  readonly undo: string | null;
}

export type ChangePreview =
  | { readonly kind: "days"; readonly changes: readonly DayChange[] }
  | {
      readonly kind: "swap";
      readonly days: readonly [string, string];
      readonly heard: readonly string[];
    }
  | { readonly kind: "none"; readonly reply: string };

/**
 * **"Make Saturday more adventurous."** Reads which days the sentence is
 * about, rebuilds only those with the same reviser `/go` uses, holds every
 * stop somebody kept, keeps out what the other days already use, and returns
 * before → after. Writes nothing: the person applies it, or doesn't.
 */
export async function previewChange(
  view: AdventureView,
  said: string,
  today: string,
): Promise<ChangePreview> {
  const days = adventureDays(view);
  const change = readChange(said, days, today);
  if (change.kind === "none") return change;
  if (change.kind === "swap") {
    const label = (d: string) =>
      new Date(`${d}T12:00:00Z`).toLocaleDateString("en-CA", {
        weekday: "long",
        timeZone: "UTC",
      });
    return {
      kind: "swap",
      days: change.days,
      heard: [
        `${label(change.days[0])}'s plan moves to ${label(change.days[1])}, and ${label(change.days[1])}'s to ${label(change.days[0])}.`,
      ],
    };
  }

  const changes: DayChange[] = [];
  let reply: string | null = null;
  for (const onDay of change.days) {
    const result = await reviseOneDay(view, onDay, change.said, change.fewer);
    if ("reply" in result) reply ??= result.reply;
    else changes.push(result);
  }
  if (changes.length === 0)
    return {
      kind: "none",
      reply:
        reply ??
        "I didn't catch a change in that. Try “more adventurous”, “cheaper”, “we're bringing a five-year-old”, “out of the rain”, “home by 5”, “swap the second” or “swap Saturday and Sunday”.",
    };
  return { kind: "days", changes };
}

/** Every day the adventure covers, and any other day an item names. */
export function adventureDays(view: AdventureView): string[] {
  const named = new Set(daysBetween(view.startsOn, view.endsOn));
  for (const item of view.items) if (item.onDay) named.add(item.onDay);
  return [...named].sort();
}

async function reviseOneDay(
  view: AdventureView,
  onDay: string,
  said: string,
  fewer: boolean,
): Promise<DayChange | { reply: string }> {
  const town = townById(view.destinationTownId ?? undefined);
  const onThisDay = view.items
    .filter((i) => i.onDay === onDay && i.atlasRef)
    .sort((a, b) => a.position - b.position);
  const current = onThisDay.map((i) => i.atlasRef!);
  const kept = onThisDay
    .filter((i) => i.status === "confirmed")
    .map((i) => i.atlasRef!);
  const elsewhere = view.items
    .filter((i) => i.onDay && i.onDay !== onDay && i.atlasRef)
    .map((i) => i.atlasRef!);
  const ask =
    view.days.find((d) => d.onDay === onDay)?.ask ??
    (town
      ? new URLSearchParams({ say: "a good day out", at: town.id }).toString()
      : null);
  if (!ask)
    return {
      reply:
        "Passport needs to know where this adventure starts before it can change a day. Open the day in Go Have a Day to choose a town.",
    };

  const asked = readDayQuery(ask);
  const startTown = townById(asked.at) ?? town;
  const before: DayBrief = {
    ...readBrief(asked.say, {
      ...(asked.hours !== undefined ? { hours: asked.hours } : {}),
      ...(asked.age !== undefined ? { childAge: asked.age } : {}),
      ...(startTown ? { town: startTown } : {}),
      on: onDay,
    }),
    ...uncarryBrief(asked.b),
  };

  // Structural changes first, as `/go` reads them: replace, remove, more, fewer.
  const n = current.length;
  const swap = replacedStop(said);
  const drop = removedStop(said, n);
  const more = stopCountChange(said);
  let brief = before;
  let heard: string[] = [];
  let without = [...elsewhere];
  let keep = [...kept];
  let count: number | undefined;

  if (swap !== undefined && swap <= n) {
    without.push(current[swap - 1]!);
    keep = current.filter((_, i) => i !== swap - 1);
    heard = [`Finding something else for stop ${swap}.`];
  } else if (drop !== undefined && drop <= n && n > 1) {
    without.push(current[drop - 1]!);
    keep = current.filter((_, i) => i !== drop - 1);
    count = n - 1;
    heard = [`Taking out stop ${drop}.`];
  } else if (more !== undefined) {
    count = Math.min(MAX_STOPS, Math.max(1, n + more));
    keep = more > 0 ? current : kept;
    heard = [more > 0 ? "One more stop." : "One stop fewer."];
  } else {
    brief = reviseBrief(before, said);
    heard = heardIn(before, brief);
    // An empty day asked to be filled needs no change to be heard.
    if (n === 0 && heard.length === 0) heard = ["A first sketch of the day."];
    if (fewer && n > 1) {
      count = n - 1;
      heard = [...heard, "One stop fewer."];
    }
  }
  if (heard.length === 0)
    return {
      reply:
        "I didn't catch a change in that. Try “more adventurous”, “cheaper”, “we're bringing a five-year-old”, “out of the rain”, “home by 5”, “swap the second” or “swap Saturday and Sunday”.",
    };

  // A kept stop is never taken away by a revision, even one that names it.
  without = without.filter((id) => !kept.includes(id));
  const candidates = await candidatesFor(brief.childAge, onDay);
  const pool = dayPool(candidates, [...current, ...keep]);
  const titleOf = new Map<string, string>(
    pool.map((e: Experience) => [e.id, e.title]),
  );
  const day = buildDay({
    pool,
    brief,
    keep,
    without,
    ...(count !== undefined ? { count } : {}),
  });
  const after = day.stops.map((s) => s.experience.id);

  // **A request nothing offers must not wipe a day that works** (`/go`'s rule).
  const unmet = day.unmet ?? [];
  if (
    unmet.length > 0 &&
    after.length < n &&
    after.every((id) => keep.includes(id))
  )
    return {
      reply: `${unmet
        .map(
          (u) =>
            `Nothing Atlas holds says it offers ${u.activity} within reach of ${brief.town?.name.replace(/,\s*BC$/, "") ?? "the start"}.`,
        )
        .join(" ")} I've left the day as it was.`,
    };
  if (after.length === 0)
    return {
      reply: "That would leave nothing on the day. I've left it as it was.",
    };

  const stop = (id: string): PreviewStop => ({
    id,
    title: titleOf.get(id) ?? "A place Passport can't name right now",
    kept: kept.includes(id),
  });
  const currentAsk = view.days.find((d) => d.onDay === onDay)?.ask ?? null;
  return {
    onDay,
    before: current.map(stop),
    after: after.map(stop),
    heard,
    query: writeDayQuery({ ...dayQueryFor(brief, day), on: onDay }),
    undo:
      current.length > 0 && currentAsk
        ? `${new URLSearchParams({ stops: current.join(",") }).toString()}&${currentAsk}`
        : null,
  };
}

/** The ask a day query keeps — re-exported for the routes that save one. */
export { askFrom };
