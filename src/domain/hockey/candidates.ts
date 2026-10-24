import { sameName } from "@/domain/collections/places";
import type { NearbyPlace } from "./nearby";

/**
 * **Which places a group should meet first.**
 *
 * Passport offers; the group chooses. These pick the handful of cards that
 * lead a vote — never a ranking of the city, and never a place Atlas's own
 * hours say is shut on game day. Order comes from the server's window
 * (photographed first, then nearest); postgame leads with the places that
 * state hours, because "is it still open" is the question at 9:45 p.m.
 */

export const FIRST_LOOK = 3;

const isDrink = (p: NearbyPlace) =>
  /bar|pub|lounge|brew|tap|tavern|saloon|wine|cocktail/i.test(p.subtype ?? "");

function onList(names: ReadonlySet<string>, place: NearbyPlace): boolean {
  if (names.has(place.name)) return true;
  for (const n of names) if (sameName(n, place.name)) return true;
  return false;
}

/** Places nobody has put on the vote yet and Atlas does not say are shut. */
function fresh(
  places: readonly NearbyPlace[],
  onBallot: ReadonlySet<string>,
): NearbyPlace[] {
  return places.filter(
    (p) => !onList(onBallot, p) && p.gameDay?.reading !== "not-on",
  );
}

/** Pregame: the window's own order — photographs first, then the shortest walk. */
export function pregameBets(
  places: readonly NearbyPlace[],
  onBallot: ReadonlySet<string>,
  count = FIRST_LOOK,
): NearbyPlace[] {
  return fresh(places, onBallot).slice(0, Math.max(0, count));
}

/**
 * Postgame: places that state their hours first, then a photograph, then a
 * bar or restaurant (either is a fine answer), then the shortest walk.
 */
export function postgameBets(
  places: readonly NearbyPlace[],
  onBallot: ReadonlySet<string>,
  count = FIRST_LOOK,
): NearbyPlace[] {
  const score = (p: NearbyPlace) =>
    (p.gameDay?.said ? 0 : 4) + (p.image ? 0 : 2) + (isDrink(p) ? 0 : 1);
  return fresh(places, onBallot)
    .map((p, i) => ({ p, i }))
    .sort((a, b) => score(a.p) - score(b.p) || a.p.km - b.p.km || a.i - b.i)
    .map(({ p }) => p)
    .slice(0, Math.max(0, count));
}

export interface BallotOption {
  readonly optionId: string;
  readonly label: string;
  readonly voters: readonly unknown[];
}

/**
 * What leads the vote as cards: the options Passport can show as a place,
 * most votes first (ties keep the order they were added), capped at `count`;
 * everything else — a typed name, the concourse, a fourth place — stays a row.
 */
export function splitBallot<T extends BallotOption>(
  options: readonly T[],
  hasPlace: (option: T) => boolean,
  count = FIRST_LOOK,
): { cards: T[]; rows: T[] } {
  const placed = options
    .map((o, i) => ({ o, i }))
    .filter(({ o }) => hasPlace(o))
    .sort((a, b) => b.o.voters.length - a.o.voters.length || a.i - b.i)
    .map(({ o }) => o);
  const cards = placed.slice(0, count);
  return {
    cards,
    rows: options.filter((o) => !cards.includes(o)),
  };
}
