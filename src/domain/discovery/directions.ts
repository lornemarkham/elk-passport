import type { Experience } from "@/domain/experience/types";
import { SECTION_PAGES, SECTION_SIZE, type DiscoverySection } from "./compose";

/**
 * **"What could you do?" answered in verbs, from Atlas's own words.**
 *
 * The page has asked that question at the top since Discovery was composed,
 * and then answered it with nouns: *Stuart Park Ice Rink*, *Kalamoir Park*,
 * *Marshall Field*. Those are records that satisfy a query. **Skating** and
 * **finding a playground** are two different afternoons, and no amount of
 * ranking the records says so.
 *
 * `candidate-knowledge/1` states the verb. Measured on the production corpus
 * on 2026-10-10 — 2,683 candidates, 224 of them carrying 682 affordances:
 *
 * ```
 * hiking 64 · swimming 33 · fishing 29 · cycling 20 · canoeing 16
 * playground 16 · kayaking 13 · mountain biking 13 · snowshoeing 13
 * ```
 *
 * These are genuinely distinct days rather than synonyms of one another, and
 * each has real, inspectable places behind it — Kalamoir Park, Kekuli Bay,
 * Otter Lake, The Grouse Grind.
 *
 * ## Nothing here is written by Passport
 *
 * The label is Atlas's own affordance name, in Atlas's own spelling. Passport
 * does not translate `Playground` into "let the kids run around", does not
 * group `mountain biking` under `cycling`, and does not decide that `Hiking`
 * and `walking/hiking` are the same thing. Every one of those would be the
 * taxonomy this deliberately is not — and the corpus is full of reasons to
 * distrust one: `Pets on leash` (10) and `Winter recreation` (8) sit in the
 * same field as `Swimming`, because Atlas records what a publisher listed.
 *
 * What keeps that honest is the **cut**, not a curated vocabulary. Only the
 * few best-evidenced verbs are offered, and measured over all four real cases
 * — a person in Vernon, in Kelowna, in Vancouver, and one who declined — the
 * top four are clean every time and never contain two spellings of one idea:
 *
 * ```
 * Vernon      hiking 35 · swimming 21 · playground 15 · fishing 14
 * Kelowna     hiking 45 · swimming 24 · fishing 19 · playground 16
 * Vancouver   cycling 3 · fishing 3 · hiking 3 · winter recreation 2
 * declined    hiking 64 · swimming 33 · fishing 29 · cycling 20
 * ```
 *
 * ## Affordances only — a washroom is not an invitation
 *
 * `knowledge.features` is deliberately not read here, though it holds
 * `Playground` 21 times. It also holds `Pit or flush toilets`, `Drinking
 * water`, `ATM` and `Vending machines`. A list of things to do today is not
 * the place to find out that somewhere has benches.
 */
export interface Invitation {
  /** Atlas's own word for it — `Hiking`, `Swimming`, `Playground`. */
  readonly doing: string;
  /** Everything that states it, which is the evidence and not a ranking. */
  readonly places: readonly Experience[];
  /**
   * Two of them to name on the tile, chosen to differ from the other tiles'.
   *
   * Dogfooded in Vernon, three invitations in a row read *Otter Lake Park ·
   * Okanagan Mountain Provincial Park*, because one large provincial park
   * genuinely offers swimming and fishing and cycling. True, and flat: four
   * distinct afternoons all looked like the same two places.
   *
   * So a later invitation prefers a place no earlier one has already named.
   * That is a choice **among** things Atlas states, never a claim beyond them
   * — the full evidence is still `places`, and the section behind the tile
   * shows all of it.
   */
  readonly examples: readonly Experience[];
}

/** How many places a tile names as proof. */
const EXAMPLES = 2;

/**
 * How many are offered.
 *
 * Four, because the cut is what keeps the offer honest: past it the corpus's
 * near-synonyms start arriving — `walking/hiking` under `hiking`, `biking`
 * beside `cycling` — and a page offering both reads as broken rather than as
 * generous. Four also fits a phone without scrolling, which is where this
 * question gets asked.
 */
export const MAX_INVITATIONS = 4;

/** The verbs Atlas states for one subject, deduplicated and in its own words. */
function affordancesOf(experience: Experience): readonly string[] {
  const stated = experience.knowledge?.affordances ?? [];
  const seen = new Map<string, string>();
  for (const { name } of stated) {
    const key = name?.trim().toLowerCase();
    if (key && !seen.has(key)) seen.set(key, name.trim());
  }
  return [...seen.values()];
}

/**
 * The few things a person could actually do here, best-evidenced first.
 *
 * `pool` is whatever the surface is honestly talking about — what Atlas has
 * placed near the reader once they have shared where they are, and the whole
 * feed until then. The distinction matters: built over everything, a person in
 * Vancouver would be invited to go swimming in the Okanagan.
 */
export function invitations(
  pool: readonly Experience[],
  limit: number = MAX_INVITATIONS,
): readonly Invitation[] {
  const byDoing = new Map<string, { label: string; places: Experience[] }>();
  for (const experience of pool) {
    for (const doing of affordancesOf(experience)) {
      const key = doing.toLowerCase();
      const row = byDoing.get(key);
      if (row) row.places.push(experience);
      else byDoing.set(key, { label: doing, places: [experience] });
    }
  }

  const ranked = [...byDoing.values()]
    .sort(
      (a, b) =>
        b.places.length - a.places.length || a.label.localeCompare(b.label),
    )
    .slice(0, limit);

  const spoken = new Set<string>();
  return ranked.map(({ label, places }) => {
    const fresh = places.filter((place) => !spoken.has(place.id));
    // Falls back to repeating rather than naming fewer: a tile with one
    // example is still better than a tile with none, and a verb backed by a
    // single place has nothing else to offer.
    const examples = [...fresh, ...places].slice(0, EXAMPLES);
    for (const place of examples) spoken.add(place.id);
    return { doing: label, places, examples };
  });
}

/**
 * The places behind one invitation, as a section of the same page.
 *
 * Every direction leads to real, inspectable candidates — the ones that stated
 * the verb, and nothing else. No ranking, no scoring, no second list: these
 * are the records whose evidence produced the invitation in the first place.
 */
export function invitationSection(
  invitation: Invitation,
  /** Said only where the pool genuinely is near the reader. */
  near: boolean,
): DiscoverySection {
  const count = invitation.places.length;
  return {
    id: `doing-${invitation.doing.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    title: invitation.doing,
    note: `${count} ${count === 1 ? "place says" : "places say"} you can, ${
      near ? "within reach of where you are" : "somewhere Passport knows about"
    }. Atlas states it; Passport is repeating it.`,
    items: invitation.places.slice(0, SECTION_SIZE * SECTION_PAGES),
    size: SECTION_SIZE,
    total: count,
    shape: "intent",
  };
}
