import type { Experience } from "@/domain/experience/types";
import { normaliseSubtype } from "./defaultFeed";

/**
 * **What a person wants to do, in their words rather than Atlas's.**
 *
 * Discovery's chips were `Places`, `Food & business`, `Things to do`, `Events`,
 * `Experiences` — Atlas's `ExperienceKind`, printed. That taxonomy is correct
 * and nobody thinks in it. *"I want to get outside"* and *"feed me"* are what
 * people actually arrive with, and both of those cut straight across kind: a
 * winery is an Organization, a provincial park is a Place, a farmers' market is
 * whichever the publisher happened to be.
 *
 * ## Membership is read, never guessed
 *
 * An intent owns a closed, explicit set of **subtypes Atlas already states**.
 * No prose matching, no keyword search over descriptions, no scoring — the same
 * discipline `defaultFeed` applies, for the same reason: a regex over a
 * description silently reclassifies a place the day somebody rewrites its
 * sentence.
 *
 * Every set below was derived by counting the live corpus (2,681 candidates on
 * 2026-10-10) rather than imagined, which is also why there is no *"Something
 * weird"* or *"Free tonight"* intent: nothing Atlas states would populate them
 * honestly, and an empty chip is worse than an absent one.
 *
 * The kind chips are not deleted. They move to a secondary control, because
 * "show me only Events" is a real thing to want — just not the first question
 * to put in front of somebody.
 */
export type IntentKey = "outside" | "eat" | "culture" | "local" | "stay";

export interface DiscoveryIntentOption {
  readonly key: IntentKey;
  /** What the chip says. Written as a person would say it. */
  readonly label: string;
  /** Passport's heading when this intent composes a section. */
  readonly section: string;
  /** One line of framing under the heading. Never a claim about a subject. */
  readonly note: string;
  readonly subtypes: ReadonlySet<string>;
}

/**
 * The five intents the corpus can actually fill.
 *
 * Ordered as a person's day tends to be asked about, not by size. `stay` is
 * last and smallest on purpose: it exists because "somewhere to stay" is a
 * genuinely different question from "something to do", and 100-odd hotels
 * sitting inside *Eat and drink* was one of the reasons the old feed read as a
 * directory.
 */
export const INTENTS: readonly DiscoveryIntentOption[] = [
  {
    key: "outside",
    label: "Get outside",
    section: "Get outside",
    note: "Parks, trails, beaches and water, from what Atlas has placed.",
    subtypes: new Set([
      "park",
      "provincial park",
      "regional park",
      "national park",
      "trail",
      "trail network",
      "hiking",
      "hiking spot",
      "beach",
      "lake",
      "river",
      "waterfall",
      "mountain",
      "mountain range",
      "campground",
      "rv park",
      "marina",
      "boat launch",
      "golf course",
      "golf club",
      "ski resort",
      "ski hill",
      "viewpoint",
      "garden",
      "botanical garden",
      "nature reserve",
      "conservation area",
      "wildlife area",
      "provincial recreation area",
      "recreation area",
      "island",
      "canyon",
      "cave",
      "hot spring",
    ]),
  },
  {
    key: "eat",
    label: "Eat & drink",
    section: "Eat and drink",
    note: "Kitchens, tasting rooms and coffee, as the places themselves describe them.",
    subtypes: new Set([
      "restaurant",
      "bistro",
      "cafe",
      "café",
      "coffee shop",
      "coffee roaster",
      "bakery",
      "bar",
      "pub",
      "brewery",
      "brew pub",
      "winery",
      "cidery",
      "distillery",
      "meadery",
      "food truck",
      "diner",
      "steakhouse",
      "pizzeria",
      "ice cream shop",
      "tasting room",
      "wine bar",
      "lounge",
      "deli",
      "butcher",
      "juice bar",
      "tea house",
    ]),
  },
  {
    key: "culture",
    label: "See something",
    section: "See something",
    note: "Museums, galleries, theatres and the places that keep them.",
    subtypes: new Set([
      "museum",
      "art gallery",
      "gallery",
      "theatre",
      "theater",
      "performing arts centre",
      "arts centre",
      "cultural centre",
      "heritage site",
      "historic site",
      "historical society",
      "library",
      "cinema",
      "movie theatre",
      "arena",
      "stadium",
      "observatory",
      "planetarium",
      "aquarium",
      "zoo",
      "place of worship",
      "monument",
      "landmark",
    ]),
  },
  {
    key: "local",
    label: "Farms & markets",
    section: "Farms and markets",
    note: "Growers, orchards and the markets they sell at.",
    subtypes: new Set([
      "farm",
      "farm market",
      // Both spellings Atlas holds flatten to the same thing once the
      // apostrophe goes, so one entry covers them.
      "farmers market",
      "market",
      "orchard",
      "vineyard",
      "u pick",
      "u pick farm",
      "ranch",
      "nursery",
      "garden centre",
      "creamery",
      "dairy",
      "apiary",
    ]),
  },
  {
    key: "stay",
    label: "Somewhere to stay",
    section: "Somewhere to stay",
    note: "For a trip that needs a bed, not an afternoon.",
    subtypes: new Set([
      "hotel",
      "motel",
      "resort",
      "inn",
      "lodge",
      "bed and breakfast",
      "guest house",
      "hostel",
      "cabin",
      "cottage",
      "vacation rental",
      "glamping",
    ]),
  },
] as const;

/**
 * **Every set is normalised the way a subject's own subtype will be.**
 *
 * `normaliseSubtype` lowercases and replaces anything outside `[a-z0-9]` with a
 * space, so Atlas's `café` — 38 records — arrives as `caf`, and a set entry
 * spelled `café` could never match it. Writing the entries naturally above and
 * normalising them here once means the comparison is between two values that
 * went through the same function, rather than between one that did and one
 * somebody typed carefully and got wrong anyway.
 */
const NORMALISED: ReadonlyMap<string, IntentKey> = new Map(
  INTENTS.flatMap((intent) =>
    [...intent.subtypes].map(
      (subtype) => [normaliseSubtype(subtype), intent.key] as const,
    ),
  ),
);

const BY_KEY = new Map(INTENTS.map((i) => [i.key, i]));

export const intentByKey = (key: IntentKey): DiscoveryIntentOption =>
  BY_KEY.get(key)!;

/**
 * Which intent claims this, or `undefined` for the large remainder.
 *
 * **One intent at most.** A winery with a restaurant is one card, and showing
 * it under both *Eat and drink* and *Farms and markets* would make a page of
 * five sections feel like a page of two — the same reason `inspirationShelves`
 * claims once.
 *
 * `undefined` is an ordinary answer and the most common one: roughly half the
 * corpus is an Organization whose subtype says `unknown`, `shop`, `non-profit
 * organization` or `company`. Those are real knowledge and still searchable;
 * they are simply not an answer to "what do you feel like doing".
 */
export function intentOf(experience: Experience): IntentKey | undefined {
  const subtype = normaliseSubtype(experience.subtype);
  return subtype ? NORMALISED.get(subtype) : undefined;
}

/** Everything one intent claims, in the order it arrived. */
export function withIntent(
  experiences: readonly Experience[],
  key: IntentKey,
): Experience[] {
  return experiences.filter((experience) => intentOf(experience) === key);
}

/**
 * The intents worth offering over this pool, with how many each would show.
 *
 * A chip that leads to nothing is a dead control, so an intent the current pool
 * cannot fill is not offered at all. The count is returned rather than printed
 * by this module — whether a number belongs on a chip is a presentation
 * decision, and this file does not make those.
 */
export function availableIntents(experiences: readonly Experience[]): readonly {
  readonly intent: DiscoveryIntentOption;
  readonly count: number;
}[] {
  const counts = new Map<IntentKey, number>();
  for (const experience of experiences) {
    const key = intentOf(experience);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return INTENTS.flatMap((intent) => {
    const count = counts.get(intent.key) ?? 0;
    return count > 0 ? [{ intent, count }] : [];
  });
}
