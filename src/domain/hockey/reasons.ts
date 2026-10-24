import type { NearbyPlace } from "./nearby";

/**
 * **A playful reason to go — made only of things Atlas holds.**
 *
 * A venue card sells the place to a group of friends, and "popular with
 * locals" is how a recommendation turns into a lie. So every line here is
 * assembled from a field the place actually carries — a fact Atlas lists
 * (happy hour, screens, a patio…), the straight-line walk compared with the
 * other cards, what Atlas files the place as, whether it quotes hours — and
 * nothing else. No ratings, no "best", no "locals love", no price, no
 * claim about food or atmosphere. The playfulness is in the telling.
 *
 * One reason per card, the strongest first, so three cards read as three
 * different arguments rather than one sentence three times.
 */

export type Moment = "pregame" | "postgame";

export interface ReasonContext {
  readonly moment: Moment;
  /** The arena's name, for the fallback line. */
  readonly venue: string;
  /** This card has the shortest walk of the cards shown together. */
  readonly shortest?: boolean;
  /** …or the longest. */
  readonly longest?: boolean;
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

const article = (word: string) => (/^[aeiou]/i.test(word) ? "an" : "a");

const isDrink = (subtype?: string) =>
  /bar|pub|lounge|brew|tap|tavern|saloon|wine|cocktail/i.test(subtype ?? "");

/** The kind of place, in Atlas's word, or nothing when it says "unknown". */
function kindWord(subtype?: string): string | undefined {
  const s = subtype?.trim();
  return s && s.toLowerCase() !== "unknown" ? s.toLowerCase() : undefined;
}

export function reasonToVisit(place: NearbyPlace, ctx: ReasonContext): string {
  const facts = place.facts ?? [];
  const find = (re: RegExp) => facts.find((f) => re.test(f));
  const post = ctx.moment === "postgame";

  const happy = find(/happy hour/i);
  if (happy)
    return post
      ? "Atlas lists a happy hour. Check the clock before the walk over."
      : "Atlas lists a happy hour, which makes this pregame maths.";
  if (find(/screens?/i))
    return post
      ? "Atlas lists screens, so the replay is on."
      : "Atlas lists screens, so the score travels with you.";
  if (find(/patio/i)) return "Atlas lists a patio. Weather permitting.";
  if (find(/reservations?/i))
    return "Atlas mentions reservations. Worth a text before the whole group turns up.";
  const other = facts[0];
  if (other) return `Atlas lists: ${lower(other)}. Something to argue about.`;

  if (post) {
    if (place.gameDay?.said)
      return "Atlas quotes hours for game day. Check them against the final horn.";
    if (ctx.shortest)
      return `Shortest walk after the horn: ${place.walkMinutes}+ min.`;
    if (!place.gameDay)
      return "Atlas has no hours on file for this one. Worth a quick check before everyone walks over.";
  }

  if (ctx.shortest && !post)
    return `Shortest walk of the lot at ${place.walkMinutes}+ min, which buys time at the table.`;
  if (ctx.longest && place.walkMinutes >= 8)
    return `The longest walk here at ${place.walkMinutes}+ min. Leave the table early.`;

  const kind = kindWord(place.subtype);
  if (kind) {
    if (isDrink(place.subtype))
      return post
        ? `Atlas files it as ${article(kind)} ${kind}. The lie of "one last drink" starts here.`
        : `Atlas files it as ${article(kind)} ${kind}. The traditional way to start a hockey night.`;
    return post
      ? `Atlas files it as ${article(kind)} ${kind}. Food, immediately.`
      : `Atlas files it as ${article(kind)} ${kind}. Real food before the puck drops.`;
  }
  return `${place.walkMinutes}+ min from ${ctx.venue}. Somebody will have opinions.`;
}

/** The shortest and longest walk among cards shown together; ties get neither. */
export function walkExtremes(places: readonly Pick<NearbyPlace, "km">[]): {
  shortest: number;
  longest: number;
} {
  if (places.length < 2) return { shortest: -1, longest: -1 };
  const kms = places.map((p) => p.km);
  const min = Math.min(...kms);
  const max = Math.max(...kms);
  if (min === max) return { shortest: -1, longest: -1 };
  return { shortest: kms.indexOf(min), longest: kms.indexOf(max) };
}
