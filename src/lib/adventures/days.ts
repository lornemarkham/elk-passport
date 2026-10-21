import { ATLAS_REF } from "./rules";

/**
 * **An adventure's days: Saved's raw material, shaped by Go Have a Day.**
 *
 * An adventure holds one list of items (`passport_adventure_items`). An item
 * with an `on_day` belongs to that day, in `position` order; one without is
 * an idea nobody has put on a day yet. Planning a day does not happen here:
 * the Day Builder (`/go`) does it, with the same reader, the same Atlas
 * subjects, the same travel legs and the same honesty it has everywhere
 * else. This module is only the seam both ways:
 *
 * - **out** — `planHref` opens `/go` seeded with the day's stops (or the
 *   ideas still waiting), the sentence it was last asked with, and the
 *   adventure, so the result can come back;
 * - **back** — `dayWrites` says what saving a built day changes: its stops
 *   take the day and the order the Day Builder gave them, and a stop the new
 *   day dropped goes back to the ideas rather than being deleted (doctrine
 *   §2.4: a thing excluded from one plan is still wanted).
 *
 * Pure, so the rules are pinned without a database.
 */

/** As many stops as one Go Have a Day takes (`MAX_STOPS`). */
export const MAX_DAY_STOPS = 6;
/** As many as `/go?with=` keeps (`src/app/go/page.tsx`). */
export const MAX_SEED = 5;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export interface PlannableItem {
  readonly id: string;
  readonly atlasRef: string | null;
  readonly onDay: string | null;
  readonly position: number;
}

export interface DayGroup<T extends PlannableItem> {
  readonly onDay: string;
  readonly items: readonly T[];
}

/** Every calendar day from start to end, inclusive; capped at two weeks. */
export function daysBetween(
  startsOn: string | null,
  endsOn: string | null,
): string[] {
  if (!startsOn || !DAY.test(startsOn)) return [];
  const last = endsOn && DAY.test(endsOn) ? endsOn : startsOn;
  const out: string[] = [];
  const at = new Date(`${startsOn}T00:00:00Z`);
  while (out.length < 14) {
    const iso = at.toISOString().slice(0, 10);
    if (iso > last) break;
    out.push(iso);
    at.setUTCDate(at.getUTCDate() + 1);
  }
  return out;
}

const byPosition = <T extends PlannableItem>(a: T, b: T) =>
  a.position - b.position;

/**
 * The adventure's days, in calendar order — every day of its dates, and any
 * other day an item names — and the ideas not on a day yet.
 */
export function groupByDay<T extends PlannableItem>(
  items: readonly T[],
  startsOn: string | null,
  endsOn: string | null,
): { days: DayGroup<T>[]; ideas: T[] } {
  const named = new Set(daysBetween(startsOn, endsOn));
  for (const item of items) if (item.onDay) named.add(item.onDay);
  const days = [...named].sort().map((onDay) => ({
    onDay,
    items: items.filter((i) => i.onDay === onDay).sort(byPosition),
  }));
  const ideas = items.filter((i) => !i.onDay).sort(byPosition);
  return { days, ideas };
}

/** The Atlas ids a day should start from: its own stops, else waiting ideas. */
export function seedFor(
  day: readonly PlannableItem[],
  ideas: readonly PlannableItem[],
): string[] {
  const refs = (list: readonly PlannableItem[]) =>
    list.flatMap((i) => (i.atlasRef ? [i.atlasRef] : []));
  const own = refs(day);
  const seed = own.length > 0 ? own : refs(ideas);
  return [...new Set(seed)].slice(0, MAX_SEED);
}

/**
 * How a day was asked for, kept on the adventure: the `/go` day query
 * without its stops. Returns `null` for anything that is not a day query
 * Passport wrote (no sentence, or too long to keep).
 */
export function askFrom(query: string): string | null {
  const params = new URLSearchParams(query);
  params.delete("stops");
  params.delete("adventure");
  if (!params.get("say")) return null;
  const ask = params.toString();
  return ask.length <= 2000 ? ask : null;
}

/** The stops of a day query, in order, if every one is an Atlas id. */
export function stopsFrom(query: string): string[] | null {
  const raw = new URLSearchParams(query).get("stops") ?? "";
  const stops = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (stops.length === 0 || stops.length > MAX_DAY_STOPS) return null;
  if (!stops.every((s) => ATLAS_REF.test(s))) return null;
  return [...new Set(stops)];
}

export interface PlanLinkInput {
  readonly adventureId: string;
  readonly onDay: string;
  readonly seed: readonly string[];
  /** The kept `ask`, when the day has been planned before. */
  readonly ask: string | null;
  readonly townId: string | null;
}

/**
 * `/go` for one day of an adventure. A day planned before reopens with the
 * sentence and the town it was built with; a new day starts from the ideas,
 * with the Day Builder's own default sentence and its own question about
 * where the day begins (ADR 003).
 */
export function planHref(input: PlanLinkInput): string {
  const asked = new URLSearchParams(input.ask ?? "");
  const params = new URLSearchParams();
  const say = asked.get("say");
  if (say) params.set("say", say);
  const age = asked.get("age");
  if (age) params.set("age", age);
  const at = asked.get("at") ?? input.townId;
  if (at) params.set("at", at);
  params.set("on", input.onDay);
  if (input.seed.length > 0)
    params.set("with", input.seed.slice(0, MAX_SEED).join(","));
  params.set("adventure", input.adventureId);
  return `/go?${params.toString()}`;
}

/**
 * The printable, shareable day: `/go/print`, which re-reads Atlas for every
 * stop and needs no account. `null` until the day has stops and a sentence.
 */
export function printHref(
  stops: readonly string[],
  ask: string | null,
): string | null {
  if (stops.length === 0 || !ask) return null;
  const params = new URLSearchParams(ask);
  params.delete("stops");
  return `/go/print?${new URLSearchParams([
    ["stops", stops.join(",")],
    ...params.entries(),
  ]).toString()}`;
}

export interface DayWrites {
  /** Existing items that become this day's stops, with their new order. */
  readonly place: readonly { id: string; position: number }[];
  /** Stops the adventure did not hold yet. */
  readonly add: readonly { atlasRef: string; position: number }[];
  /** This day's stops the new plan left out: back to the ideas. */
  readonly release: readonly string[];
}

/**
 * What saving a built day changes. Each stop takes, in order of preference,
 * the item already on this day, an idea not on any day, or a new item. Items
 * on other days are left alone — the same place can be on Saturday and
 * Sunday. Nothing is deleted.
 */
export function dayWrites(
  items: readonly PlannableItem[],
  onDay: string,
  stops: readonly string[],
): DayWrites {
  const used = new Set<string>();
  const place: { id: string; position: number }[] = [];
  const add: { atlasRef: string; position: number }[] = [];
  stops.forEach((ref, position) => {
    const pick =
      items.find(
        (i) => i.atlasRef === ref && i.onDay === onDay && !used.has(i.id),
      ) ?? items.find((i) => i.atlasRef === ref && !i.onDay && !used.has(i.id));
    if (pick) {
      used.add(pick.id);
      place.push({ id: pick.id, position });
    } else {
      add.push({ atlasRef: ref, position });
    }
  });
  const release = items
    .filter((i) => i.onDay === onDay && !used.has(i.id) && i.atlasRef)
    .map((i) => i.id);
  return { place, add, release };
}

/**
 * Moving one item up or down within its own group (a day, or the ideas).
 * Returns the positions to write — only those that change, numbering the
 * group 0…n-1 so items added in one go (equal positions) still move — or
 * `null` at either end.
 */
export function moveWithin<T extends PlannableItem>(
  group: readonly T[],
  id: string,
  direction: -1 | 1,
): { id: string; position: number }[] | null {
  const sorted = [...group].sort(byPosition);
  const at = sorted.findIndex((i) => i.id === id);
  if (at < 0 || !sorted[at + direction]) return null;
  [sorted[at], sorted[at + direction]] = [sorted[at + direction]!, sorted[at]!];
  return sorted.flatMap((item, position) =>
    item.position === position ? [] : [{ id: item.id, position }],
  );
}
