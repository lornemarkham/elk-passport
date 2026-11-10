import type { Experience } from "@/domain/experience/types";
import type { DiscoveryTown } from "@/domain/discovery/towns";
import { DISCOVERY_TOWNS } from "@/domain/discovery/towns";
import { distanceKm } from "@/lib/environment/geo";

/**
 * **Where the places a person chose actually are.**
 *
 * A day built from a Pocket of places in Vernon *and* Vancouver used to be one
 * day with a 234 km hop in the middle and a footnote. A person who saved
 * places in two parts of the province has not asked for a day that crosses the
 * province; they have two days, or a weekend.
 *
 * Chosen places are grouped by **stated coordinates only**: two places belong
 * together when a chain of places, each within {@link DAY_REACH_KM} of the
 * next, joins them (Vernon–Kelowna is one day out; Vernon–Penticton is not).
 * A place with no stated position is *unplaced*: it joins no group and is
 * never guessed into one. Nothing here is a road distance.
 *
 * Doctrine §7 (location and distance are core) and §2.4 (a person may collect
 * across places; the plan is where reality bites).
 */

/** How far apart two chosen places can be and still be one day's outing. */
export const DAY_REACH_KM = 60;

/** The named town this far or nearer is "where a group is". */
const TOWN_KM = 60;

export interface PlaceGroup {
  /** Chosen ids in this group, in the order they were chosen. */
  readonly ids: readonly string[];
  readonly titles: readonly string[];
  /** The nearest named town to the middle of the group, where there is one. */
  readonly town?: DiscoveryTown;
}

export interface ChosenPlaces {
  /** Groups, ordered by their first-chosen member. */
  readonly groups: readonly PlaceGroup[];
  /** Chosen ids Atlas states no position for. */
  readonly unplaced: readonly string[];
}

const point = (e: Experience) => {
  const c = e.geography?.coordinates;
  return c ? { latitude: c[1], longitude: c[0] } : undefined;
};

export function groupChosen(
  chosen: readonly Experience[],
  reachKm = DAY_REACH_KM,
): ChosenPlaces {
  const placed = chosen.flatMap((e) => {
    const at = point(e);
    return at ? [{ e, at }] : [];
  });
  const unplaced = chosen.filter((e) => !point(e)).map((e) => e.id);

  // Single linkage: union everything within reach of anything already in.
  const parent = placed.map((_, i) => i);
  const find = (i: number): number =>
    parent[i] === i ? i : (parent[i] = find(parent[i]!));
  for (let i = 0; i < placed.length; i += 1)
    for (let j = i + 1; j < placed.length; j += 1)
      if (distanceKm(placed[i]!.at, placed[j]!.at) <= reachKm)
        parent[find(i)] = find(j);

  const byRoot = new Map<number, typeof placed>();
  for (const [i, item] of placed.entries()) {
    const root = find(i);
    byRoot.set(root, [...(byRoot.get(root) ?? []), item]);
  }
  const groups: PlaceGroup[] = [...byRoot.values()].map((members) => {
    const middle = {
      latitude:
        members.reduce((sum, m) => sum + m.at.latitude, 0) / members.length,
      longitude:
        members.reduce((sum, m) => sum + m.at.longitude, 0) / members.length,
    };
    let best: { town: DiscoveryTown; km: number } | undefined;
    for (const town of DISCOVERY_TOWNS) {
      const km = distanceKm(middle, town);
      if (!best || km < best.km) best = { town, km };
    }
    return {
      ids: members.map((m) => m.e.id),
      titles: members.map((m) => m.e.title),
      ...(best && best.km <= TOWN_KM ? { town: best.town } : {}),
    };
  });
  // Chosen order decides which group leads, not the order they were found in.
  const rank = (g: PlaceGroup) =>
    Math.min(...g.ids.map((id) => chosen.findIndex((e) => e.id === id)));
  groups.sort((a, b) => rank(a) - rank(b));
  return { groups, unplaced };
}

/** A town's plain name — "Vernon", not "Vernon, BC". */
export const townName = (town: DiscoveryTown): string =>
  town.name.replace(/,\s*BC$/i, "");

/** "Vernon", "Vernon and Vancouver", "Vernon, Kelowna and Vancouver". */
export function placesPhrase(groups: readonly PlaceGroup[]): string {
  const names = groups.map((g) => (g.town ? townName(g.town) : "elsewhere"));
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * **Share chosen places across a trip's days without crossing the province.**
 *
 * Each group of places gets its own run of days (a group never shares a day
 * with another), the days divided between groups by how many places they
 * hold, at least one each. With more groups than days the groups are merged
 * in order and `merged` says so, so the caller can say it out loud rather
 * than quietly build a day that spans them. Unplaced ids go to the largest
 * group's first day.
 */
export function shareAcrossDays(
  places: ChosenPlaces,
  days: number,
): {
  readonly perDay: readonly {
    readonly ids: readonly string[];
    readonly town?: DiscoveryTown;
  }[];
  readonly merged: boolean;
} {
  const { groups, unplaced } = places;
  if (days <= 0) return { perDay: [], merged: false };
  if (groups.length === 0)
    return {
      perDay: Array.from({ length: days }, (_, i) => ({
        ids: i === 0 ? unplaced : [],
      })),
      merged: false,
    };

  const merged = groups.length > days;
  // More groups than days: nothing sensible keeps them apart, so the surplus
  // is folded into the last day's group and the caller is told.
  const usable = merged
    ? [
        ...groups.slice(0, days - 1),
        {
          ids: groups.slice(days - 1).flatMap((g) => g.ids),
          titles: groups.slice(days - 1).flatMap((g) => g.titles),
          ...(groups[days - 1]!.town ? { town: groups[days - 1]!.town! } : {}),
        },
      ]
    : groups;

  // Days per group: one each, the rest to whoever holds the most places per day.
  const count = usable.map(() => 1);
  for (let spare = days - usable.length; spare > 0; spare -= 1) {
    let pick = 0;
    for (let i = 1; i < usable.length; i += 1)
      if (
        usable[i]!.ids.length / count[i]! >
        usable[pick]!.ids.length / count[pick]!
      )
        pick = i;
    count[pick]! += 1;
  }

  const largest = usable.reduce(
    (top, g, i) => (g.ids.length > usable[top]!.ids.length ? i : top),
    0,
  );
  const perDay: { ids: string[]; town?: DiscoveryTown }[] = [];
  for (const [g, group] of usable.entries()) {
    const slots: string[][] = Array.from({ length: count[g]! }, () => []);
    for (const [i, id] of group.ids.entries())
      slots[i % slots.length]!.push(id);
    if (g === largest) slots[0]!.push(...unplaced);
    for (const ids of slots)
      perDay.push({ ids, ...(group.town ? { town: group.town } : {}) });
  }
  return { perDay, merged };
}
