import type { Experience } from "@/domain/experience/types";
import { doesActivity } from "@/domain/discovery/activities";
import { distanceKm } from "@/lib/environment/geo";
import type { ResortFacts } from "./resorts";

/**
 * **What Atlas actually holds around a mountain, sorted the way a snow day
 * needs it.**
 *
 * Every pick is a real Atlas entity, and it is in a category only because
 * Atlas's own words put it there (an affordance, a subtype — the activity
 * explorer's rule, `doesActivity`, reused, plus one Snow rule for tubing,
 * which the explorer has no activity for). A title is never evidence: "Tube
 * Town" is tubing because Atlas lists "Tubing", not because of its name.
 *
 * Nothing here claims an opening hour, a price or an age limit Atlas did not
 * state. Where Atlas states nothing the pick says so, and where Atlas holds
 * nothing for a category the answer is a gap — which becomes an acquisition
 * request (`acquisitionRequest`), never an invented place.
 */
export const CATEGORIES = [
  "lunch",
  "apres",
  "skating",
  "tubing",
  "snowshoe",
  "spa",
  "family",
  "events",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  lunch: "Lunch & cafés",
  apres: "Après",
  skating: "Skating",
  tubing: "Tubing",
  snowshoe: "Snowshoe & Nordic",
  spa: "Spa & warm-up",
  family: "Family",
  events: "Events",
};

export interface Pick {
  readonly id: string;
  readonly title: string;
  readonly kind: string;
  readonly subtype?: string;
  readonly description: string;
  readonly categories: readonly Category[];
  /** Straight line from the resort's point. Not a drive. */
  readonly km: number;
  readonly onMountain: boolean;
  /** Atlas's own words that put it in its categories. */
  readonly evidence: readonly string[];
  /** Only a picture Atlas says is of this thing. */
  readonly image?: string;
  readonly attribution?: string;
  /** Events: when Atlas says it happens. `YYYY-MM-DD` or undefined. */
  readonly date?: string;
  readonly locality?: string;
  /** Atlas stated a children's suitability. */
  readonly kids?: "suitable" | "not-suitable";
}

const TUBING = /\b(inner[- ]?)?tubing\b|\btube park\b/i;

function atlasWords(e: Experience): string[] {
  return [
    ...(e.knowledge?.affordances ?? []).map((a) => a.name),
    ...(e.subtype ? [e.subtype] : []),
  ];
}

const ACTIVITY_OF: Record<
  Exclude<Category, "tubing" | "events" | "family">,
  string[]
> = {
  lunch: ["restaurants", "coffee", "eat"],
  apres: ["bars", "breweries", "wineries"],
  skating: ["skating"],
  snowshoe: ["snowshoeing", "cross-country-skiing"],
  spa: ["spa"],
};

export function categoriesOf(e: Experience): {
  categories: Category[];
  evidence: string[];
} {
  const categories = new Set<Category>();
  const words = atlasWords(e);
  for (const [cat, keys] of Object.entries(ACTIVITY_OF) as [
    Category,
    string[],
  ][])
    if (keys.some((k) => doesActivity(e, k))) categories.add(cat);
  if (words.some((w) => TUBING.test(w))) categories.add("tubing");
  if (String(e.kind).toLowerCase() === "event") categories.add("events");
  if (
    categories.has("tubing") ||
    categories.has("skating") ||
    doesActivity(e, "playgrounds")
  )
    categories.add("family");
  // Après also means dinner: a restaurant is an après option, ranked after bars.
  if (categories.has("lunch") && doesActivity(e, "restaurants"))
    categories.add("apres");
  return { categories: [...categories], evidence: [...new Set(words)] };
}

/**
 * What Atlas states about who it is for. `adults-only` is the only answer
 * that removes a pick for a crew with kids; `all-ages` is shown as such;
 * anything else (or nothing) is "not stated".
 */
function kidsOf(e: Experience): Pick["kids"] {
  const says = (e.suitability?.statements ?? []).map((s) => s.says);
  if (says.includes("adults-only")) return "not-suitable";
  if (says.includes("all-ages")) return "suitable";
  return undefined;
}

export function picksNear(
  pool: readonly Experience[],
  at: { latitude: number; longitude: number },
  opts: { withinKm?: number; onMountainKm?: number } = {},
): Pick[] {
  const within = opts.withinKm ?? 40;
  const onKm = opts.onMountainKm ?? 4;
  const out: Pick[] = [];
  const seen = new Set<string>();
  for (const e of pool) {
    // Organisations carry their point under geography (derived from where
    // they are), places under location.
    const g = e.geography?.coordinates;
    const lat = e.location?.latitude ?? g?.[1];
    const lng = e.location?.longitude ?? g?.[0];
    if (lat === undefined || lng === undefined) continue;
    const km = distanceKm(at, { latitude: lat, longitude: lng });
    if (km > within) continue;
    const { categories, evidence } = categoriesOf(e);
    if (categories.length === 0) continue;
    // Atlas sometimes holds one thing twice ("Spirit Lodge", "Spirit Lodge at
    // Silver Star"); same name + same spot is shown once.
    const key = `${e.title.toLowerCase()}@${km.toFixed(1)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const img = e.presentationImage;
    const date = e.startTime?.slice(0, 10);
    out.push({
      id: e.id,
      title: e.title,
      kind: String(e.kind),
      subtype: e.subtype,
      description: e.shortDescription,
      categories,
      km: Math.round(km * 10) / 10,
      onMountain: km <= onKm,
      evidence,
      ...(img?.relationship === "exact" && img.depictsEntity
        ? { image: img.url, attribution: img.attribution }
        : {}),
      ...(date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? { date } : {}),
      locality: e.geography?.locality ?? e.location?.region,
      kids: kidsOf(e),
    });
  }
  return rank(out);
}

/** On the mountain first, then nearer, then the ones with a real photo. */
function rank(picks: Pick[]): Pick[] {
  return [...picks].sort(
    (a, b) =>
      Number(b.onMountain) - Number(a.onMountain) ||
      a.km - b.km ||
      Number(!!b.image) - Number(!!a.image),
  );
}

export interface PickFilter {
  readonly category?: Category;
  readonly maxKm?: number;
  readonly onMountainOnly?: boolean;
  /** For someone who isn't skiing: anything but the skiing itself. */
  readonly nonSkier?: boolean;
  /** Leave out what Atlas says is not for children. */
  readonly kids?: boolean;
  /** Events on another date are left out; undated events stay, marked. */
  readonly date?: string;
  /** Events Atlas dates before this day are over and left out. */
  readonly from?: string;
}

export function filterPicks(picks: readonly Pick[], f: PickFilter): Pick[] {
  return picks.filter(
    (p) =>
      (!f.category || p.categories.includes(f.category)) &&
      (f.maxKm === undefined || p.km <= f.maxKm) &&
      (!f.onMountainOnly || p.onMountain) &&
      (!f.kids || p.kids !== "not-suitable") &&
      (!f.nonSkier ||
        p.categories.some((c) =>
          ["skating", "tubing", "snowshoe", "spa", "family", "events"].includes(
            c,
          ),
        )) &&
      (!f.date ||
        !p.categories.includes("events") ||
        !p.date ||
        p.date === f.date) &&
      (!f.from ||
        !p.categories.includes("events") ||
        !p.date ||
        p.date >= f.from),
  );
}

/** A meal place for after the lifts: bars first, then restaurants. */
export function apresRank(picks: readonly Pick[]): Pick[] {
  const bar = (p: Pick) =>
    p.evidence.some((w) =>
      /\b(bar|pub|brew|cider|distill|winery|lounge)/i.test(w),
    );
  return [...picks]
    .filter((p) => p.categories.includes("apres"))
    .sort(
      (a, b) =>
        Number(b.onMountain) - Number(a.onMountain) ||
        Number(bar(b)) - Number(bar(a)) ||
        a.km - b.km,
    );
}

export interface Gap {
  readonly category: Category;
  /** `mountain`: nothing within the on-mountain radius; `area`: nothing at all. */
  readonly where: "mountain" | "area";
}

/** What a snow day needs that Atlas does not hold near this mountain. */
export function gapsIn(picks: readonly Pick[]): Gap[] {
  const gaps: Gap[] = [];
  for (const c of [
    "lunch",
    "apres",
    "skating",
    "tubing",
    "snowshoe",
    "events",
  ] as const) {
    const any = picks.filter((p) => p.categories.includes(c));
    if (any.length === 0) gaps.push({ category: c, where: "area" });
    else if ((c === "lunch" || c === "apres") && !any.some((p) => p.onMountain))
      gaps.push({ category: c, where: "mountain" });
  }
  return gaps;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/^the /, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * **An Atlas acquisition request**, in words an Atlas mission can act on:
 * which names the resort itself lists that Atlas does not hold, and which
 * categories have nothing on the mountain. Passport never adds these places
 * itself — Atlas owns knowledge.
 */
export function acquisitionRequest(
  mountainName: string,
  facts: ResortFacts | undefined,
  pool: readonly Pick[],
  gaps: readonly Gap[],
): { missingDining: string[]; missingActivities: string[]; text: string } {
  const held = new Set(pool.map((p) => norm(p.title)));
  // Held when an Atlas title contains the resort's whole name for it
  // as whole words ("Long John's Pub" in "Long John's Pub SilverStar"); never
  // the reverse, or "Tube Town" would pass for "Tube Town Café & Bar", and
  // never inside a word, or "The Den" would pass for any garden.
  const has = (name: string) => {
    const n = norm(name);
    return [...held].some((h) => ` ${h} `.includes(` ${n} `));
  };
  const missingDining = (facts?.listsOnSite?.dining ?? []).filter(
    (n) => !has(n),
  );
  // An activity is held when Atlas holds the place the resort runs it at.
  const missingActivities = (facts?.listsOnSite?.activities ?? [])
    .filter((a) => !a.atlasPlace || !has(a.atlasPlace))
    .map((a) => a.name);
  const lines = [
    `Atlas acquisition request: ${mountainName}`,
    ...gaps.map(
      (g) =>
        `- ${CATEGORY_LABEL[g.category]}: nothing ${g.where === "mountain" ? "on the mountain (within the village radius)" : "in the area"}.`,
    ),
  ];
  if (facts?.listsOnSite) {
    lines.push(
      `- The resort lists ${facts.listsOnSite.dining.length} dining venues (${facts.listsOnSite.source.dining}, checked ${facts.listsOnSite.checked}); Atlas holds ${facts.listsOnSite.dining.length - missingDining.length}. Missing: ${missingDining.join(", ") || "none"}.`,
      `- The resort lists ${facts.listsOnSite.activities.length} winter activities (${facts.listsOnSite.source.activities}); no Atlas entity for: ${missingActivities.join(", ") || "none"}.`,
    );
  }
  return { missingDining, missingActivities, text: lines.join("\n") };
}
