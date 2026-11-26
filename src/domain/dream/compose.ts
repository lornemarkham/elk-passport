import type { Experience } from "@/domain/experience/types";
import { readBrief, reviseBrief, type DayBrief } from "@/domain/day/brief";
import {
  buildDay,
  defaultRadiusKm,
  MAX_STOPS,
  type DayPlanned,
} from "@/domain/day/build";
import { readAsk } from "@/lib/ai/ask/read";
import { dayHref, substantial } from "@/lib/ai/ask/answer";
import { townById, type DiscoveryTown } from "@/domain/discovery/towns";
import { destinationFor } from "@/domain/experience/destination";
import { cardPictures } from "@/lib/media/cardPicture";
import { directionsOf, priceOf } from "@/domain/christmas/discover";
import { readWhen } from "@/domain/christmas/when";
import { usefulFacts } from "@/domain/occasion/ideas";
import {
  ingredientsIn,
  isAccommodation,
  occasionWords,
  special,
  type Ingredient,
  type Role,
} from "./ingredients";

/**
 * **Dream — one conversation, answered from Atlas, unfolded as scenes.**
 *
 * The Labs experiment behind `/labs/dream` (mission 1130, *Discover when you
 * know. Dream when you don't. Go when you're ready.*). It builds nothing that
 * Passport already has:
 *
 * - the sentence is read by `/go`'s `readBrief` and revised by `reviseBrief`
 *   (§2.5: change what was mentioned, leave the rest alone), and its day by
 *   Discovery's `readAsk`, so "tomorrow" means the same thing on all three;
 * - the day is `buildDay`, the one planner, built *around* what the scenes
 *   chose (`keep`), so "Go" opens `/go` on the same day, not a different one;
 * - places, photographs, hours, prices and distances are Atlas's — a card
 *   says what Atlas states and nothing it does not.
 *
 * What is new is the shape: each thing the person named is answered on its
 * own (*the rinks, the lights, the cafés*) before the day joins them, and a
 * person who named nothing is either surprised (`surprise`) or helped to
 * find out (`unsure`, see `figure.ts`) — never sent a form.
 *
 * ## The rules it does not bend
 *
 * - **Never invents.** Nothing near → the scene says so (`gap`), with the
 *   nearest real one further away where Atlas has one, labelled as further.
 * - **Never substitutes.** A spa is not a hot spring; a café is not dinner.
 * - **Silence removes nothing** but what was asked: a stated price over the
 *   budget is out, an unstated price is said to be unstated.
 * - **Deterministic.** No model, no key, no spend (see the AI cost
 *   assessment in `docs/product/dream/README.md`).
 */

export type DreamMode = "ask" | "surprise" | "unsure";

export interface DreamInput {
  readonly pool: readonly Experience[];
  /** Everything the person said, first to last. */
  readonly turns: readonly string[];
  /** A `towns.ts` id: where they are looking from. */
  readonly townId: string;
  /** `YYYY-MM-DD` where the subjects are. */
  readonly today: string;
  /** Another throw of the dice for *surprise me* — 0 is the first. */
  readonly seed?: number;
  /** Places the person reached for (a photograph picked, "I want this"). */
  readonly keep?: readonly string[];
  /** Places the person said no to. Out of every scene and the day. */
  readonly without?: readonly string[];
}

export interface DreamPhoto {
  readonly src: string;
  /** Said on the picture when it is not a picture of this very thing. */
  readonly label?: string;
}

export interface DreamCard {
  readonly id: string;
  readonly title: string;
  readonly kind: string;
  readonly subtype?: string;
  readonly photo?: DreamPhoto;
  /** Straight-line km from the town. Never a drive time. */
  readonly km?: number;
  readonly locality?: string;
  /** The Atlas words that put it here, quoted. */
  readonly listed: readonly string[];
  /** Practical facts, each in Atlas's or the publisher's own words. */
  readonly facts: readonly string[];
  readonly free: boolean;
  /** The one Passport page for this place (`/places/…`, `/passport/…`). */
  readonly href?: string;
  readonly directions?: string;
  /** A short line under the title: what it is, one sentence. */
  readonly line?: string;
  /** A dated thing whose dates miss the day asked about — said, not hidden. */
  readonly notOnDay?: boolean;
}

export interface DreamScene {
  readonly id: string;
  /** "Skating", "Christmas lights" — or, for a surprise, "The big thing". */
  readonly label: string;
  readonly role: Role;
  /** Within the radius, best first. At most six. */
  readonly near: readonly DreamCard[];
  /** Beyond the radius, labelled so. Only when near is thin. */
  readonly further: readonly DreamCard[];
  /** When nothing near has it, why — never filled with something else. */
  readonly gap?: string;
}

export interface DreamStop {
  readonly id: string;
  readonly title: string;
  readonly minutes: number;
  readonly km?: number;
  readonly because: string;
  readonly cost?: string;
  readonly photo?: DreamPhoto;
  readonly href?: string;
  readonly directions?: string;
}

export interface DreamDay {
  readonly title: string;
  readonly opening: string;
  readonly stops: readonly DreamStop[];
  /** Said first: what the plan could not do, and what it could not know. */
  readonly honest: readonly string[];
  /** `/go`, carrying the sentence, the town, the day and the chosen places. */
  readonly goHref: string;
  /** The printable guide for the same day. */
  readonly printHref: string;
}

/** One thing the reading heard, said back so it can be corrected. */
export interface Heard {
  readonly label: string;
  /** Where it came from: the person's words, or Passport's assumption. */
  readonly from: "said" | "assumed";
}

export interface DreamAnswer {
  readonly mode: DreamMode;
  readonly town: { readonly id: string; readonly name: string };
  readonly on: string;
  readonly radiusKm: number;
  readonly heard: readonly Heard[];
  readonly scenes: readonly DreamScene[];
  readonly day?: DreamDay;
  /** Sentences to tap, each one a refinement the reader understands. */
  readonly next: readonly string[];
  /** How many places this answer was chosen from. */
  readonly considered: number;
}

/** How far a *worth the drive* card may be, straight-line. */
export const FURTHER_KM = 200;
const NEAR_LIMIT = 6;
const FURTHER_LIMIT = 3;

const UNSURE =
  /\b(don'?t know|do not know|no idea|not sure|help me (figure|decide|choose|pick)|can'?t decide|undecided|no clue|inspire me|dream)\b/i;
const SURPRISE =
  /\b(surprise me|i'?m bored|bored|anything|whatever|random|dealer'?s choice|you pick|you choose)\b/i;
const IMPRESS =
  /\b(impress|romantic|a date|date night|anniversary|propos\w*|my (wife|husband|partner|girlfriend|boyfriend))\b/i;
const LAVISH =
  /\b(money (isn'?t|is not|is no) (an )?(issue|object|problem)|no budget|splurge|spare no expense|treat (ourselves|myself|us)|the best|incredible|luxur\w*|fancy|fine dining|five[- ]star)\b/i;
const DROP = /\b(no|skip|without|forget|drop|not|lose|minus)\b/i;

const pointOf = (e: Experience) => {
  const c = e.geography?.coordinates;
  return c && typeof c[0] === "number" && typeof c[1] === "number"
    ? { latitude: c[1], longitude: c[0] }
    : undefined;
};

function km(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371;
  const r = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(r(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(r(a.latitude)) *
      Math.cos(r(b.latitude)) *
      Math.sin(r(b.longitude - a.longitude) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** The lowest dollar figure a price states, where it states one. */
export function lowestDollars(price: string | undefined): number | undefined {
  if (!price) return undefined;
  const all = [...price.matchAll(/\$\s?(\d+(?:\.\d+)?)/g)].map((m) =>
    Number(m[1]),
  );
  return all.length ? Math.min(...all) : undefined;
}

/** The picture of this thing, its venue or its organiser — never a stand-in. */
/**
 * An image Atlas calls the place's own, whose address says it is a logo or an
 * icon — a council crest standing in for a trail. Passport shows no picture
 * rather than that one, and the handoff asks Atlas to stop offering it.
 */
export const NOT_A_PHOTOGRAPH =
  /logo|favicon|placeholder|wordmark|\.svg(\?|$)|_brand_|[/_-]icons?[/_.-]/i;

export function photoOf(e: Experience): DreamPhoto | undefined {
  const picture = cardPictures(e).find(
    (p) =>
      !/^(Illustrative|Representative)/.test(p.label ?? "") &&
      !NOT_A_PHOTOGRAPH.test(p.src),
  );
  if (!picture) return undefined;
  return {
    src: picture.src,
    ...(picture.label ? { label: picture.label } : {}),
  };
}

const firstSentence = (text: string | undefined): string | undefined => {
  const t = text?.trim();
  if (!t) return undefined;
  const one = /^(.{20,180}?[.!?])(\s|$)/.exec(t)?.[1] ?? t.slice(0, 160);
  return one.length < t.length && !/[.!?]$/.test(one) ? `${one}…` : one;
};

const roundKm = (n: number) => Math.round(n * 10) / 10;

/** A card: what Atlas states, in its own words, and the ways to go. */
export function cardFor(
  e: Experience,
  origin: { latitude: number; longitude: number } | undefined,
  today: string,
  on: string,
  listed: readonly string[] = [],
  options: { readonly budget?: number } = {},
): DreamCard {
  const here = pointOf(e);
  const away = origin && here ? roundKm(km(origin, here)) : undefined;
  const { price, free } = priceOf(e);
  const facts: string[] = [];
  let notOnDay = false;
  if (e.kind === "Event" && e.startTime) {
    const when = readWhen(e, today);
    if (when.line) facts.push(when.line);
    notOnDay = Boolean(
      when.from && when.to && (on < when.from || on > when.to),
    );
  }
  const onDate = e.schedule?.onDate;
  if (onDate?.reading === "on" && onDate.date === on)
    facts.push("Atlas says it's open that day.");
  if (price) facts.push(price);
  else if (free) facts.push("Free, by its own listing.");
  else if (options.budget === 0)
    facts.push("No price listed — check before you count on free.");
  // Hours, admission, rentals — the publisher's own words, never parsed.
  for (const fact of usefulFacts(e).slice(0, 2))
    facts.push(`${fact.label}: ${fact.value}`);
  const visit = e.visitDuration?.text;
  if (visit) facts.push(visit);
  const href = destinationFor(e);
  const directions = directionsOf(e);
  const photo = photoOf(e);
  const line = firstSentence(e.shortDescription || e.description);
  return {
    id: e.id,
    title: e.title,
    kind: e.kind,
    ...(e.subtype ? { subtype: e.subtype.replace(/_/g, " ") } : {}),
    ...(photo ? { photo } : {}),
    ...(away !== undefined ? { km: away } : {}),
    ...(e.geography?.locality ? { locality: e.geography.locality } : {}),
    listed,
    facts: facts.slice(0, 3),
    free,
    ...(href ? { href } : {}),
    ...(directions ? { directions } : {}),
    ...(line ? { line } : {}),
    ...(notOnDay ? { notOnDay } : {}),
  };
}

/** The day a conversation is about: the last turn that names one, else today. */
export function dayAsked(turns: readonly string[], today: string): string {
  let on = today;
  for (const turn of turns) {
    const day = readAsk(turn, { today }).on;
    if (day) on = day;
  }
  return on;
}

interface Reading {
  readonly brief: DayBrief;
  readonly ingredients: readonly Ingredient[];
  readonly mode: DreamMode;
  readonly on: string;
  readonly lavish: boolean;
  readonly town: DiscoveryTown;
  readonly today: string;
}

/** The conversation, read: the brief, the things named, and what kind of ask. */
export function readDream(
  turns: readonly string[],
  town: DiscoveryTown,
  today: string,
): Reading {
  const said = turns.map((t) => t.trim()).filter(Boolean);
  // The day: the last turn that names one wins ("actually, Saturday").
  const on = dayAsked(said, today);
  let brief: DayBrief = readBrief(said[0] ?? "", { town, on });
  for (const turn of said.slice(1)) brief = reviseBrief(brief, turn);
  brief = { ...brief, on };
  // A town named later moves the start (reviseBrief), and the search with it.
  const whereFrom = brief.town ?? town;

  // What they named, minus what a later turn took away.
  let ingredients: Ingredient[] = [];
  for (const [i, turn] of said.entries()) {
    const named = ingredientsIn(turn);
    if (i > 0 && DROP.test(turn)) {
      const dropped = new Set(named.map((n) => n.id));
      ingredients = ingredients.filter((n) => !dropped.has(n.id));
      continue;
    }
    for (const n of named)
      if (!ingredients.some((x) => x.id === n.id)) ingredients.push(n);
  }

  const all = said.join(". ");
  const lavish = LAVISH.test(all);
  if (!brief.party && IMPRESS.test(all)) brief = { ...brief, party: "couple" };

  const first = said[0] ?? "";
  const mode: DreamMode =
    ingredients.length > 0
      ? "ask"
      : UNSURE.test(first)
        ? "unsure"
        : SURPRISE.test(first) || readAsk(first, { today }).lens === "surprise"
          ? "surprise"
          : "ask";
  return { brief, ingredients, mode, on, lavish, town: whereFrom, today };
}

interface Scored {
  readonly e: Experience;
  readonly km?: number;
  readonly listed: readonly string[];
  readonly score: number;
}

/** Everything in the pool that answers one ingredient, scored for this ask. */
function answersFor(
  ingredient: Ingredient,
  pool: readonly Experience[],
  reading: Reading,
  origin: { latitude: number; longitude: number },
  today: string,
  without: ReadonlySet<string>,
): Scored[] {
  const { brief, lavish, on } = reading;
  const out: Scored[] = [];
  for (const e of pool) {
    if (without.has(e.id)) continue;
    if (ingredient.role !== "stay" && isAccommodation(e)) continue;
    const listed = ingredient.evidence(e);
    if (listed.length === 0) continue;
    // What is over is over; an earlier year is not this one.
    if (e.kind === "Event" && e.startTime) {
      const when = readWhen(e, today);
      if (when.phase === "finished" || when.confidence === "past") continue;
    }
    if (on && e.schedule?.onDate?.reading === "not-on") continue;
    const { price, free } = priceOf(e);
    const dollars = lowestDollars(price);
    if (brief.budget !== undefined && dollars !== undefined) {
      if (brief.budget === 0 && !free) continue;
      if (dollars > brief.budget) continue;
    }
    const here = pointOf(e);
    const away = here ? km(origin, here) : undefined;
    if (away === undefined && !substantial(e)) continue;

    let score = 0;
    if (photoOf(e)) score += 4;
    if (substantial(e)) score += 1;
    if ((e.shortDescription ?? "").length >= 80) score += 1;
    if (e.kind === "Event" && e.startTime) {
      const when = readWhen(e, today);
      const covers = when.from && when.to && when.from <= on && on <= when.to;
      score += covers ? 3 : -1;
    }
    if (e.schedule?.onDate?.reading === "on") score += 1;
    if (brief.budget === 0 && free) score += 2;
    if (ingredient.prefer?.test(`${e.subtype ?? ""} ${e.title}`)) score += 3;
    const occasion = ingredient.role === "meal" ? occasionWords(e) : [];
    if (lavish && ingredient.role === "meal")
      score += (special(e) ? 2 : -4) + 2 * occasion.length;
    if (lavish && ingredient.role === "stay")
      score += /resort|lodge|boutique|inn|chalet/i.test(e.subtype ?? "")
        ? 2
        : 0;
    if (!lavish && brief.party === "family" && ingredient.role === "stay")
      score += /motel|inn/i.test(e.subtype ?? "") ? 1 : 0;
    // Nearer is better, gently: a pictured rink 4 km off beats a bare one at 1.
    if (away !== undefined) score -= away / 8;
    else score -= 3;
    out.push({
      e,
      ...(away !== undefined ? { km: away } : {}),
      listed: lavish && occasion.length ? [...occasion, ...listed] : listed,
      score,
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** One per name — Atlas sometimes holds a venue twice. */
function distinct(scored: readonly Scored[], limit: number): Scored[] {
  const seen = new Set<string>();
  const out: Scored[] = [];
  for (const s of scored) {
    const key = s.e.title.toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

/** Answer one ingredient: near first, then further, then the honest gap. */
export function sceneFor(
  ingredient: Ingredient,
  pool: readonly Experience[],
  reading: Reading,
  radiusKm: number,
  today: string,
  without: ReadonlySet<string>,
): DreamScene {
  const origin = {
    latitude: reading.town.latitude,
    longitude: reading.town.longitude,
  };
  const all = answersFor(ingredient, pool, reading, origin, today, without);
  const inTown = (s: Scored) =>
    s.km === undefined &&
    (s.e.geography?.locality ?? "").toLowerCase() ===
      reading.town.name.toLowerCase();
  const near = distinct(
    all.filter((s) => (s.km !== undefined && s.km <= radiusKm) || inTown(s)),
    NEAR_LIMIT,
  );
  const further =
    near.length >= 2
      ? []
      : distinct(
          all
            .filter(
              (s) =>
                s.km !== undefined && s.km > radiusKm && s.km <= FURTHER_KM,
            )
            .sort((a, b) => (a.km ?? 0) - (b.km ?? 0)),
          FURTHER_LIMIT,
        );
  const budget = reading.brief.budget;
  const card = (s: Scored) =>
    cardFor(s.e, origin, today, reading.on, s.listed, {
      ...(budget !== undefined ? { budget } : {}),
    });
  return {
    id: ingredient.id,
    label: ingredient.label,
    role: ingredient.role,
    near: near.map(card),
    further: further.map(card),
    ...(near.length === 0
      ? {
          gap:
            further.length > 0
              ? `Nothing within ${radiusKm} km. The nearest Atlas knows is further out — said as further, so you can decide.`
              : ingredient.none,
        }
      : {}),
  };
}

// ------------------------------------------------------------ surprise me

/** Kinds that are real but are nobody's surprise. */
const NOBODYS_SURPRISE =
  /\b(playground|tot lot|school|office|church|parking|private|community hall|meeting|clinic|hospital|services?|association|society|club|league|government|bank|store|shop|retail|gas|pharmacy|dog park|cemetery|boat launch|sports field|ball ?park|tennis|pickleball|venue)\b/i;

const SURPRISE_ROLES: readonly {
  readonly id: string;
  readonly label: string;
  readonly role: Role;
  readonly takes: (e: Experience) => boolean;
}[] = [
  {
    id: "big",
    label: "The big thing",
    role: "do",
    takes: (e) =>
      (e.kind === "Event" && Boolean(e.startTime)) ||
      /\b(museum|gallery|theatre|rink|arena|climbing|ski|resort|zoo|farm|winery|observatory|science|heritage|castle|garden|market|cinema|bowling|escape|axe|golf|gondola|zipline|tour)\b/i.test(
        `${e.subtype ?? ""} ${e.title}`,
      ),
  },
  {
    id: "outside",
    label: "Then get outside",
    role: "outside",
    takes: (e) =>
      /\b(park|trail|viewpoint|lake|beach|falls|waterfall|canyon|forest|provincial park|regional park|greenway|lookout|mountain|nature)\b/i.test(
        `${e.subtype ?? ""} ${e.title}`,
      ),
  },
  {
    id: "after",
    label: "And to finish",
    role: "meal",
    takes: (e) =>
      /\b(restaurant|bistro|brewery|brewpub|winery|cidery|distillery|pub|tap ?room|wine bar|cafe|café|bakery|chocolat\w*)\b/i.test(
        `${e.subtype ?? ""} ${e.title}`,
      ) && !/fast[ _]?food/i.test(e.subtype ?? ""),
  },
];

/** A small, honest shuffle: the same day and seed give the same surprise. */
function shuffled<T>(items: readonly T[], seed: string): T[] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function surpriseScenes(
  pool: readonly Experience[],
  reading: Reading,
  radiusKm: number,
  today: string,
  seed: number,
  without: ReadonlySet<string>,
): DreamScene[] {
  const origin = {
    latitude: reading.town.latitude,
    longitude: reading.town.longitude,
  };
  const eligible = pool.filter((e) => {
    if (without.has(e.id) || isAccommodation(e)) return false;
    if (!photoOf(e) || !substantial(e)) return false;
    if (NOBODYS_SURPRISE.test(`${e.subtype ?? ""} ${e.title}`)) return false;
    const here = pointOf(e);
    if (!here || km(origin, here) > radiusKm) return false;
    if (e.kind === "Event" && e.startTime) {
      const when = readWhen(e, today);
      if (when.phase !== "now" && !(when.from && when.from <= reading.on))
        return false;
      if (when.to && when.to < reading.on) return false;
    }
    return e.schedule?.onDate?.reading !== "not-on";
  });
  const used = new Set<string>();
  return SURPRISE_ROLES.map((slot) => {
    const fits = eligible.filter((e) => slot.takes(e) && !used.has(e.id));
    // Today's dated things first, then the rest, each shuffled by the seed.
    const dated = fits.filter((e) => e.kind === "Event" && e.startTime);
    const rest = fits.filter((e) => !(e.kind === "Event" && e.startTime));
    const order = [
      ...shuffled(dated, `${today}:${slot.id}:${seed}`),
      ...shuffled(rest, `${today}:${slot.id}:${seed}`),
    ];
    const picks = order.slice(0, 4);
    for (const p of picks.slice(0, 1)) used.add(p.id);
    return {
      id: slot.id,
      label: slot.label,
      role: slot.role,
      near: picks.map((e) => cardFor(e, origin, today, reading.on)),
      further: [],
      ...(picks.length === 0
        ? {
            gap: `Nothing pictured within ${radiusKm} km fits this part of the day.`,
          }
        : {}),
    };
  });
}

// ------------------------------------------------------------------- the day

const TIME_OF_DAY: Readonly<Record<Role, number>> = {
  outside: 0,
  do: 1,
  drink: 2,
  lights: 4,
  meal: 3,
  night: 5,
  stay: 6,
};

function dayFrom(
  planned: DayPlanned,
  reading: Reading,
  origin: { latitude: number; longitude: number },
  today: string,
  sentence: string,
  reasons: ReadonlyMap<string, string>,
): DreamDay {
  const honest = [
    ...(planned.conflicts ?? []),
    ...(planned.leftOut ?? []),
    ...(planned.occasion?.missing ?? []),
    ...(planned.unmet ?? []).map(
      (u) =>
        `${u.activity[0]!.toUpperCase()}${u.activity.slice(1)} — nothing Atlas holds offers it within the circle.`,
    ),
  ];
  const ids = planned.stops.map((s) => s.experience.id);
  const goHref = dayHref({
    say: sentence,
    with: ids.slice(0, 5),
    at: reading.town.id,
    ...(reading.brief.childAge !== undefined
      ? { age: reading.brief.childAge }
      : {}),
    on: reading.on,
  });
  return {
    title: planned.title,
    opening: planned.opening,
    stops: planned.stops.map((s) => {
      const card = cardFor(s.experience, origin, today, reading.on);
      return {
        id: s.experience.id,
        title: s.experience.title,
        minutes: s.minutes,
        ...(s.km !== undefined ? { km: roundKm(s.km) } : {}),
        because:
          reasons.get(s.experience.id) && /^Close to the rest/.test(s.because)
            ? reasons.get(s.experience.id)!
            : s.because,
        ...(s.cost ? { cost: s.cost } : {}),
        ...(card.photo ? { photo: card.photo } : {}),
        ...(card.href ? { href: card.href } : {}),
        ...(card.directions ? { directions: card.directions } : {}),
      };
    }),
    honest: [...new Set(honest)].slice(0, 4),
    goHref,
    printHref: goHref.replace(/^\/go/, "/go/print"),
  };
}

// ------------------------------------------------------------- the answer

/** What the reading heard, in the words a person would use. */
function heardFrom(reading: Reading, radiusKm: number, today: string): Heard[] {
  const { brief, lavish, on } = reading;
  const out: Heard[] = [];
  if (brief.party === "family")
    out.push({
      label: brief.childAge !== undefined ? `kids (${brief.childAge})` : "kids",
      from: "said",
    });
  if (brief.party === "couple") out.push({ label: "for two", from: "said" });
  if (brief.party === "friends") out.push({ label: "friends", from: "said" });
  if (brief.hours) out.push({ label: `${brief.hours} hours`, from: "said" });
  if (brief.budget === 0) out.push({ label: "free", from: "said" });
  else if (brief.budget !== undefined)
    out.push({ label: `$${brief.budget}`, from: "said" });
  if (lavish) out.push({ label: "no budget", from: "said" });
  out.push({
    label: `within ${radiusKm} km of ${reading.town.name}`,
    from: brief.withinKm !== undefined || radiusKm === 100 ? "said" : "assumed",
  });
  out.push({
    label: on === today ? "today" : dayWords(on, today),
    from: on === today ? "assumed" : "said",
  });
  if (brief.shelter === "indoor") out.push({ label: "indoors", from: "said" });
  if (brief.shelter === "outdoor") out.push({ label: "outside", from: "said" });
  if (brief.appetite === "adventurous")
    out.push({ label: "adventurous", from: "said" });
  for (const mood of brief.occasion?.moods ?? [])
    if (!out.some((h) => h.label === mood) && mood !== "family")
      out.push({ label: mood, from: "said" });
  return out;
}

function dayWords(on: string, today: string): string {
  const t = new Date(`${today}T12:00:00Z`).getTime();
  const d = new Date(`${on}T12:00:00Z`);
  const diff = Math.round((d.getTime() - t) / 86_400_000);
  if (diff === 1) return "tomorrow";
  return d.toLocaleDateString("en-CA", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Refinements to tap — each a sentence `reviseBrief` or the reader knows. */
function nextFor(reading: Reading, scenes: readonly DreamScene[]): string[] {
  const { brief, mode, ingredients, lavish } = reading;
  const out: string[] = [];
  if (mode === "surprise") out.push("Surprise me again");
  const thin = scenes.filter((s) => s.near.length === 0).length;
  if (thin > 0) out.push("Worth the drive — look further");
  if ((brief.withinKm ?? 30) > 10 && thin === 0) out.push("Closer to home");
  if (brief.budget === undefined && !lavish) out.push("Make it free");
  if (brief.shelter !== "indoor") out.push("Keep us indoors");
  if (brief.shelter !== "outdoor") out.push("Get us outside");
  const has = (id: string) => ingredients.some((i) => i.id === id);
  if (!has("dinner") && !has("warm-drink"))
    out.push("Add somewhere warm to drink");
  if (!has("dinner")) out.push("Add dinner");
  if (reading.on === reading.today) out.push("Make it tomorrow instead");
  return out.slice(0, 5);
}

export function dream(input: DreamInput): DreamAnswer {
  const town = townById(input.townId) ?? townById("vernon")!;
  const reading = readDream(input.turns, town, input.today);
  const without = new Set(input.without ?? []);
  const look = input.turns.some((t) =>
    /\b(worth the drive|look further|further afield|road trip)\b/i.test(t),
  );
  const radiusKm =
    reading.brief.withinKm ??
    (look ? 100 : defaultRadiusKm(reading.brief.hours));
  const origin = {
    latitude: reading.town.latitude,
    longitude: reading.town.longitude,
  };
  const base: Omit<DreamAnswer, "scenes" | "next"> = {
    mode: reading.mode,
    town: { id: reading.town.id, name: reading.town.name },
    on: reading.on,
    radiusKm,
    heard: heardFrom(reading, radiusKm, input.today),
    considered: input.pool.length,
  };
  if (reading.mode === "unsure") return { ...base, scenes: [], next: [] };

  const scenes =
    reading.mode === "surprise"
      ? surpriseScenes(
          input.pool,
          reading,
          radiusKm,
          input.today,
          input.seed ?? 0,
          without,
        )
      : reading.ingredients.map((i) =>
          sceneFor(i, input.pool, reading, radiusKm, input.today, without),
        );

  // The day is built around the first near answer of every scene, in the
  // order a day is lived — outside in daylight, dinner, the lights, a bed.
  // A dated thing on other days stays in its scene, said so, and out of the
  // day; the bed is where the day ends, so it is added after the builder.
  const kept = new Set(input.keep ?? []);
  const leadOf = (s: DreamScene) =>
    [...s.near, ...s.further].find((c) => kept.has(c.id)) ??
    s.near.find((c) => !c.notOnDay);
  const lead = scenes
    .filter((s) => s.role !== "stay" && leadOf(s))
    .sort((a, b) => TIME_OF_DAY[a.role] - TIME_OF_DAY[b.role])
    .map((s) => leadOf(s)!.id);
  const stayScene = scenes.find((s) => s.role === "stay");
  const bed = stayScene ? leadOf(stayScene) : undefined;
  const reasons = new Map<string, string>();
  for (const scene of scenes) {
    const card = leadOf(scene);
    if (!card) continue;
    const word = card.listed[0];
    reasons.set(
      card.id,
      reading.mode === "surprise"
        ? `${scene.label} — a surprise, picked from what Atlas has pictured near you.`
        : `${scene.label}${word ? ` — Atlas lists “${word}”.` : "."}`,
    );
  }
  const keep = [...new Set([...lead, ...(input.keep ?? [])])]
    .filter((id) => !without.has(id) && id !== bed?.id)
    .slice(0, MAX_STOPS);
  const sentence = input.turns.join(" — ");
  const planned = buildDay({
    pool: input.pool,
    brief: reading.brief,
    keep,
    order: keep,
    without: [...without, ...(bed ? [bed.id] : [])],
    ...(keep.length > 0 ? { count: Math.max(keep.length, 2) } : {}),
  });
  const built =
    planned.stops.length > 0
      ? dayFrom(planned, reading, origin, input.today, sentence, reasons)
      : undefined;
  const day =
    built && bed
      ? {
          ...built,
          stops: [
            ...built.stops,
            {
              id: bed.id,
              title: bed.title,
              minutes: 0,
              ...(bed.km !== undefined ? { km: bed.km } : {}),
              because:
                "Where the night ends — you asked for somewhere beautiful to stay. Atlas lists no rates or rooms; book it yourself.",
              ...(bed.photo ? { photo: bed.photo } : {}),
              ...(bed.href ? { href: bed.href } : {}),
              ...(bed.directions ? { directions: bed.directions } : {}),
            },
          ],
        }
      : built;
  return {
    ...base,
    scenes,
    ...(day ? { day } : {}),
    next: nextFor(reading, scenes),
  };
}
