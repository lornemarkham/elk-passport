/**
 * Passport-side presentation vocabulary and grouping tables.
 *
 * **Removed 2026-08-12 (Milestone 0): `PERFECT_DAY_TEMPLATE` and
 * `COME_HERE_IF_FALLBACK`.** Both were static, place-independent text
 * rendered on every Place as though it were knowledge about that place —
 * a five-step "A Perfect Day" itinerary identical on every entity in the
 * corpus, and a `["Nature", "Fresh Air", ...]` list padding out "Come
 * Here If...". Both were added deliberately and defended here as "safe,
 * broadly-true filler."
 *
 * That defence was wrong, and the reason is now a durable rule
 * (`project-management/passport-page-quality-standard.md` §9a, "Passport
 * never invents content to fill a section"): the harm is not that a
 * specific claim is false — it's that the reader cannot tell which parts
 * of the page are evidence and which are padding, so one paragraph of
 * filler makes every real, sourced fact on the page feel like it might
 * also be filler. Atlas now carries per-fact provenance on everything it
 * knows; unsourced editorial rendered indistinguishably beside it
 * silently discards the value of all of that attribution.
 *
 * Nothing replaced them. Honest absence is the correct behaviour — the
 * same rule every other section on this page already follows.
 */

export type PlanningCategory = "before" | "during" | "after";

export const PLANNING_CATEGORY_LABEL: Record<PlanningCategory, string> = {
  before: "Before You Go",
  during: "While You're Here",
  after: "Afterwards",
};

/**
 * Phase 8.1 — Passport's own "what is my day" grouping. Atlas states
 * `placeType` as a fact (`cafe`, `parking`, `brewery`, ...); classifying
 * a place type as something useful *before*, *during*, or *after* a trip
 * is an editorial judgment, not something Atlas confirmed — the exact
 * "Atlas identifies place type, Passport determines emotional tone"
 * pattern from `docs/future/future-passport-experience.md` §7, reapplied
 * here rather than reinvented. This table is deliberately small and only
 * covers the `placeType` values `OSMNearbyPoiLoader`'s own allow-list
 * produces (`atlas/src/ingestion/loaders/osmPoiAllowList.ts`) — a related
 * place whose type isn't in this table simply doesn't get grouped into
 * Before/During/After (see `PlaceKeepExploring.tsx`), it stays in the
 * general "Keep Exploring" list. No relationship type change, no new
 * Atlas concept — this table is the entire feature on Passport's side.
 */
export const PLANNING_CATEGORY_BY_PLACE_TYPE: Record<string, PlanningCategory> =
  {
    cafe: "before",
    convenience_store: "before",
    supermarket: "before",
    gas_station: "before",

    parking: "during",
    restroom: "during",
    drinking_water: "during",
    beach: "during",
    boat_launch: "during",
    viewpoint: "during",
    picnic_area: "during",
    campground: "during",

    restaurant: "after",
    brewery: "after",
    winery: "after",
  };

/**
 * Phase 7.5 — "Should I Come?" signal groups. Deliberately small and
 * generic (not Ellison-specific), because this drives a deterministic
 * recommendation composed from real `place.activities` /
 * `place.facilities`, never AI-generated free text — the same discipline
 * `BCParksSourceLoader.fireBanSentence()` already follows: selection of a
 * fact the source already states, phrased as a sentence, nothing invented.
 *
 * Two paired vocabularies, not a single "good/bad" score: an easy-access
 * signal set (activities and facilities that suggest a developed,
 * family-friendly, low-effort day) and a wilderness signal set (activities
 * that suggest a remote, self-sufficient, higher-effort day). A place can
 * match either, both, or neither — `PlaceShouldICome` reads the *shape* of
 * the match, not a single number, so the same logic produces a sensible
 * recommendation for a busy day-use park and a backcountry trail alike.
 */
export const EASY_ACCESS_ACTIVITY_SIGNALS = [
  "Swimming",
  "Picnicking",
  "Interpretive programs",
  "Pets on leash",
  "Cycling",
  "E-Biking",
  "Playground",
];

export const DEVELOPED_FACILITY_SIGNALS = [
  "Parking",
  "Pit or flush toilets",
  "Flush toilets",
  "Showers",
  "Playground",
  "Drinking water",
  "Picnic areas",
];

export const WILDERNESS_ACTIVITY_SIGNALS = [
  "Backcountry camping",
  "Wilderness camping",
  "Mountaineering",
  "Multi-day hiking",
  "Backcountry skiing",
];

/** Case-insensitive overlap between a place's real, confirmed values and one of the signal lists above — never a fuzzy or partial match, so this stays honest about what Atlas actually confirmed. */
export function matchSignals(
  values: readonly string[] | undefined,
  signals: readonly string[],
): string[] {
  if (!values || values.length === 0) return [];
  const lowerSignals = new Set(signals.map((s) => s.toLowerCase()));
  return values.filter((v) => lowerSignals.has(v.trim().toLowerCase()));
}

/** "Swimming, Cycling, Pets on leash" -> "swimming, cycling, and pets on leash" — lowercases only the first character of each item (not the whole string, since some real activity names may already contain meaningful capitalization) and joins as a natural list. Deliberately does not attempt idiomatic rewording ("Pets on leash" -> "bringing the dog") — a bespoke phrase table would only ever cover activity names seen so far and could read wrong for anything else Atlas learns later. */
export function toPhraseList(items: readonly string[]): string {
  const phrased = items.map((item) =>
    item.length > 0 ? item[0]!.toLowerCase() + item.slice(1) : item,
  );
  if (phrased.length === 1) return phrased[0]!;
  if (phrased.length === 2) return `${phrased[0]} and ${phrased[1]}`;
  return `${phrased.slice(0, -1).join(", ")}, and ${phrased[phrased.length - 1]}`;
}

/**
 * Phase 7.6 — reversal of a Phase 7.5 decision, on explicit product
 * direction: "Atlas doesn't yet know enough..." and `WHAT_TO_BRING_COVERAGE_NOTE`
 * (the Phase 7.5 versions of this file) were removed entirely, not
 * softened. A traveler-facing page should never expose Atlas's
 * uncertainty — that belongs in admin tooling. `placeholderNote()` and
 * `WHAT_TO_BRING_COVERAGE_NOTE` used to exist here; every section that
 * used them now returns `null` when it doesn't have enough real evidence,
 * the same "hide, don't apologize" rule every other section on this page
 * already followed. See `docs/content-model/future.md` for the full
 * reasoning and why this isn't a contradiction of "clearly marked
 * placeholders rather than inventing facts" (Phase 7.5's brief) — a
 * missing recommendation is marked by *absence*, not by apology text.
 */

/**
 * Phase 7.6 — the one shared computation behind both the Hero's short mood
 * line and "Should I Come?"'s full recommendation, so the two can never
 * quietly disagree with each other. Same signal groups as Phase 7.5,
 * factored out once a second real consumer (the Hero) needed the same
 * evidence.
 */
export interface FitSignals {
  readonly easyMatches: string[];
  readonly wildernessMatches: string[];
  readonly developedMatches: string[];
}

export function computeFitSignals(
  activities: readonly string[] | undefined,
  facilities: readonly string[] | undefined,
): FitSignals {
  const cleanActivities = activities?.filter((a) => a.trim()) ?? [];
  const cleanFacilities = facilities?.filter((f) => f.trim()) ?? [];
  return {
    easyMatches: matchSignals(cleanActivities, EASY_ACCESS_ACTIVITY_SIGNALS),
    wildernessMatches: matchSignals(
      cleanActivities,
      WILDERNESS_ACTIVITY_SIGNALS,
    ),
    developedMatches: matchSignals(cleanFacilities, DEVELOPED_FACILITY_SIGNALS),
  };
}

/**
 * A short (4-8 word), confident feeling-line for the Hero — never a
 * restated fact, never hedged. Only renders for the two cases with a
 * clear evidentiary lean (easy-access or wilderness); a neutral or empty
 * signal set means the Hero simply shows no mood line at all rather than
 * a generic, opinion-free filler sentence — "become less opinionated"
 * taken to its natural endpoint above the fold, not just lower down.
 */
export function deriveMoodLine(signals: FitSignals): string | undefined {
  if (signals.easyMatches.length > 0)
    return "An easy day, exactly when you need one.";
  if (signals.wildernessMatches.length > 0)
    return "A quieter, more rugged day than most.";
  return undefined;
}
