import { townById } from "@/domain/discovery/towns";
import { addDays, type Confidence } from "./when";
import { hasChristmasPicture } from "./pictures";
import type { Answer, Find } from "./discover";
import type { ThemeId } from "./themes";
import { metres } from "./lights/actions";
import type { Kind, PinView } from "./lights/model";

/**
 * **Christmas Around You** — the Christmas front page, as sections of real
 * things rather than a list of themes.
 *
 * Each section is a question a family has ("what's on soon?", "where are the
 * lights?"), answered only from what Atlas holds; a section with nothing to
 * show is left out (`sections` returns only the full ones) rather than
 * filled. Three rules decide who gets in and in what order:
 *
 * 1. **Where.** Every section holds only what Atlas places within the asked
 *    distance of the town. A find Atlas hasn't placed, or places further out,
 *    is never claimed as "near you": nothing on the front page is "worth the
 *    drive" past the radius somebody chose.
 * 2. **Sure first.** `dated` (Atlas holds this season's days) before `check`
 *    (a window, or the organiser's own words) before `unconfirmed` (Christmas
 *    evidence, no dates this season). Last year's finds (`past`) are not on the
 *    front page at all; `answer` already shelves them apart.
 * 3. **Once.** A find sits in the first section that wants it, so the page
 *    doesn't say the same market three times. Happening Soon is a lens on
 *    time, so it goes first and the category sections take what is left.
 */

export type SectionId = "soon" | "lights" | "markets" | "santa" | "festive";

export interface AroundSection {
  readonly id: SectionId;
  readonly title: string;
  readonly line: string;
  /** What Atlas holds. */
  readonly finds: readonly Find[];
  /**
   * Local listings from the community lights map (`Pin the Magic`): Passport's
   * own, reviewed by a person, and **shown apart from Atlas's finds** — the
   * doctrine's rule for local listings (§12) — never mixed into the row.
   */
  readonly pins: readonly PinView[];
  /** How many were left out of the row to keep it short. */
  readonly more: number;
  /** Of the row: how many have Atlas's dates this season. */
  readonly confirmed: number;
}

/** How far ahead "soon" looks, in days. */
export const SOON_DAYS = 28;
/** Cards a row shows. */
export const ROW = 8;

const SURE: Readonly<Record<Confidence, number>> = {
  dated: 0,
  check: 1,
  unconfirmed: 2,
  past: 3,
};

/** Only a picture of the thing itself counts — never its venue's. */
const hasPicture = (f: Find) => hasChristmasPicture(f.experience);

/** Verified first; then ones with a picture; then the nearest; then the soonest. */
function byWorth(a: Find, b: Find): number {
  return (
    SURE[a.when.confidence] - SURE[b.when.confidence] ||
    Number(hasPicture(b)) - Number(hasPicture(a)) ||
    (a.km ?? Infinity) - (b.km ?? Infinity) ||
    (a.when.from ?? "9999").localeCompare(b.when.from ?? "9999") ||
    a.experience.title.localeCompare(b.experience.title)
  );
}

/** Soonest first (a run that has begun counts from today). */
function bySoonest(a: Find, b: Find): number {
  return (
    (a.when.from ?? "9999").localeCompare(b.when.from ?? "9999") ||
    (a.km ?? Infinity) - (b.km ?? Infinity) ||
    a.experience.title.localeCompare(b.experience.title)
  );
}

/** A thing a family can go to: real Christmas evidence, not a rink that is only winter. */
const christmasy = (f: Find) => f.reading.christmas;

const FAMILY: readonly ThemeId[] = ["santa", "winter"];
const FESTIVE: readonly ThemeId[] = ["festivals", "shows", "food"];

function row(
  id: SectionId,
  title: string,
  line: (shown: readonly Find[], confirmed: number) => string,
  finds: readonly Find[],
  pins: readonly PinView[] = [],
): AroundSection | null {
  if (finds.length === 0 && pins.length === 0) return null;
  const shown = finds.slice(0, ROW);
  const shownPins = pins.slice(0, ROW);
  const confirmed = shown.filter((f) => f.when.confidence === "dated").length;
  return {
    id,
    title,
    line: line(shown, confirmed),
    finds: shown,
    pins: shownPins,
    more: finds.length - shown.length + (pins.length - shownPins.length),
    confirmed,
  };
}

const sureLine = (shown: readonly Find[], confirmed: number) =>
  shown.length === 0
    ? "From local listings, checked by a person."
    : confirmed === shown.length
      ? "All with this season's dates confirmed."
      : confirmed === 0
        ? "None has this season's dates confirmed yet — check before you go."
        : `${confirmed} with this season's dates confirmed first; the rest say what's missing.`;

/** Lit-and-on first, then the most loved, then the nearest. */
function pinOrder(a: PinView, b: PinView): number {
  const live = (p: PinView) =>
    Number(p.season === "lit" && p.running !== "over") * 2 +
    Number(p.running === "on");
  return live(b) - live(a) || b.total - a.total || a.name.localeCompare(b.name);
}

const LIGHT_KINDS: readonly Kind[] = [
  "home",
  "public-display",
  "neighbourhood",
  "community-tree",
];

/** How far a community pin counts as "around you" when no distance is said. */
export const PIN_KM = 30;

/**
 * The page's sections for one answer, in the order a family would look.
 * `answer` must have been made from the same finds and ask.
 */
export function around(
  answered: Answer,
  today: string,
  allPins: readonly PinView[] = [],
  km: number = PIN_KM,
): readonly AroundSection[] {
  const by = (id: string) =>
    answered.shelves.find((s) => s.id === id)?.finds ?? [];
  // "Here" is what Atlas places within the distance, or names the town's area
  // for; with no town the page has no "here", so every placed find is local.
  const here = answered.town
    ? by("near")
    : answered.shelves
        .filter((s) => s.id.startsWith("area-"))
        .flatMap((s) => s.finds);
  const seen = new Set<string>();
  const take = (list: readonly Find[]) => {
    const fresh = list.filter((f) => !seen.has(f.experience.id));
    for (const f of fresh) seen.add(f.experience.id);
    return fresh;
  };

  // Community pins near the town: published, not dark, not finished.
  const centre = answered.town
    ? { lat: answered.town.latitude, lng: answered.town.longitude }
    : undefined;
  const pinsHere = centre
    ? allPins.filter(
        (p) =>
          p.status === "approved" &&
          p.season !== "dark" &&
          p.running !== "over" &&
          metres(centre, p.at) / 1000 <= km,
      )
    : [];
  const horizon = addDays(today, SOON_DAYS);
  const pinsSoon = pinsHere
    .filter(
      (p) =>
        p.season === "lit" &&
        p.dates &&
        p.dates.to >= today &&
        p.dates.from <= horizon,
    )
    .sort((a, b) => a.dates!.from.localeCompare(b.dates!.from));
  const pinsShownSoon = new Set(pinsSoon.slice(0, ROW).map((p) => p.id));
  // A market or a festival is said once (Happening soon takes it); a lit
  // display also stays under Lights, because "where are the lights?" is the
  // question that section answers whatever night they switch on.
  const pinsOf = (kinds: readonly Kind[], again = false) =>
    pinsHere
      .filter(
        (p) => kinds.includes(p.kind) && (again || !pinsShownSoon.has(p.id)),
      )
      .sort(pinOrder);

  const soon = here
    .filter(
      (f) =>
        christmasy(f) &&
        f.when.confidence === "dated" &&
        f.when.to! >= today &&
        f.when.from! <= horizon,
    )
    .sort(bySoonest);
  const shownSoon = take(soon.slice(0, ROW));

  // Winter fun that is not Christmas (a rink, a sleigh ride) is welcome in
  // the family row only with days or a window behind it — an undated arena
  // is not a Santa activity.
  const inThemes = (ids: readonly ThemeId[]) => (f: Find) =>
    ids.some((t) => f.reading.themes.includes(t)) &&
    (christmasy(f) ||
      f.when.confidence === "dated" ||
      f.when.confidence === "check") &&
    f.when.confidence !== "past";

  const lights = take(
    here
      .filter(
        (f) =>
          christmasy(f) &&
          f.reading.themes.includes("lights") &&
          !f.reading.themes.includes("markets") &&
          f.when.confidence !== "past",
      )
      .sort(byWorth),
  );
  const markets = take(
    here
      .filter((f) => christmasy(f) && f.reading.themes.includes("markets"))
      .filter((f) => f.when.confidence !== "past")
      .sort(byWorth),
  );
  const santa = take(here.filter(inThemes(FAMILY)).sort(byWorth));
  const festive = take(here.filter(inThemes(FESTIVE)).sort(byWorth));

  const placeName = answered.town?.name.replace(/,\s*BC$/, "");
  const near = placeName ? `near ${placeName}` : "near you";
  const sections = [
    row(
      "soon",
      "Happening soon",
      (shown) =>
        `${shown.length > 0 ? "Confirmed dates" : "Dates from the organisers' own pages"}, soonest first, ${near} over the next ${SOON_DAYS / 7} weeks.`,
      shownSoon,
      pinsSoon,
    ),
    row(
      "lights",
      `Christmas lights ${near}`,
      (shown) =>
        shown.length === 0
          ? "Pinned by locals and checked by a person. Last year's lights aren't promised — each says if it's confirmed this year."
          : sureLine(
              shown,
              shown.filter((f) => f.when.confidence === "dated").length,
            ),
      lights,
      pinsOf(LIGHT_KINDS, true),
    ),
    row("markets", "Christmas markets", sureLine, markets, pinsOf(["market"])),
    row("santa", "Santa & family activities", sureLine, santa),
    row(
      "festive",
      "Festive events",
      sureLine,
      festive,
      pinsOf(["festive-attraction"]),
    ),
  ];
  return sections.filter((s): s is AroundSection => s !== null);
}

/** Whether a town is one Passport can place (so "near you" means something). */
export const knownTown = (id: string | undefined) =>
  Boolean(id && townById(id));

/**
 * **The front page's few strongest finds** (`NearYou`): `around`'s order,
 * each find once, except that a year-long run does not lead (`longRun`) and,
 * since mission 1126, a find Christmas can show a picture of comes before one
 * it cannot — the same "pictured" step Christmas's own recommendation order
 * takes (`byStrength`). Only the order changes: nothing here is near unless
 * `around` placed it, and with too few pictured finds the rest are text cards.
 */
export function strongest(
  sections: readonly AroundSection[],
  n: number,
  longRun: (f: Find) => boolean,
): Find[] {
  const seen = new Set<string>();
  return sections
    .flatMap((s) => s.finds)
    .filter((f) => !seen.has(f.experience.id) && seen.add(f.experience.id))
    .map((f, i) => ({ f, i }))
    .sort(
      (a, b) =>
        Number(longRun(a.f)) - Number(longRun(b.f)) ||
        Number(hasPicture(b.f)) - Number(hasPicture(a.f)) ||
        a.i - b.i,
    )
    .map(({ f }) => f)
    .slice(0, n);
}
