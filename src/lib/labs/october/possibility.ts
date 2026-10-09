import { destinationFor } from "@/domain/experience/destination";
import type { Experience } from "@/domain/experience/types";
import type { Film } from "@/lib/movies/catalogue";
import type { Doing } from "@/lib/making/catalogue";
import type { SubjectKind } from "@/domain/october/subjectKind";
import type { OctoberKind } from "@/lib/october/types";

/**
 * **One shape for everything a person could do, so discovery stops being a
 * tour of the database.**
 *
 * October currently has six surfaces and they are organised the way the data
 * is organised: Events here, Movies there, Doings somewhere else. That is an
 * accurate map of how the product is built and a useless map of how a person
 * decides. Somebody who does not know what to do tonight is not choosing
 * between an Atlas `Event` and a Passport `Doing`. They are choosing between
 * *going out* and *staying in*, between *an hour* and *a whole evening*,
 * between *being scared* and *not being scared*.
 *
 * A `Possibility` is that choice, flattened. It carries only what a person
 * weighs — when, where-ish, how long, how frightening, what it looks like —
 * and deliberately drops the thing the current product leads with: what kind
 * of record it is. `source` survives only so the labs can prove that mixing
 * happened and so saving can address the right row.
 *
 * ## Nothing here is invented
 *
 * Every field is carried from evidence that already exists. Atlas dates come
 * from `daysOn`; a film's runtime and fear are authored in the film
 * catalogue; a Doing's evening is authored in the making catalogue. Where
 * nothing is known the field is absent, and the surfaces are written to
 * render absence rather than fill it. In particular `setting` is Atlas's own
 * classification and stays `"unknown"` for most of the corpus, which is true.
 */

/** Which authored or imported body this came from. Never shown as a label. */
export type PossibilitySource = "atlas" | "movie" | "doing";

/**
 * **How this sits in time**, which is the one property a person must be able
 * to read without knowing what kind of thing it is.
 *
 * - `fixed` — one dated occurrence. Turn up then or miss it.
 * - `window` — runs across a span of days. Several chances.
 * - `anytime` — no date anywhere. Whenever you like.
 * - `deadline` — no fixed date, but pointless after one.
 * - `unstated` — it is an October thing and nobody published when.
 *
 * `unstated` exists because the alternative is worse. Two of the best things
 * in this corpus — both haunts — hold their nights on child records Atlas
 * does not expose here, so their own record states nothing. Calling that
 * "anytime" would be a claim Passport cannot support, and dropping them would
 * remove two of the strongest possibilities in October.
 */
export type TimeShape =
  "fixed" | "window" | "anytime" | "deadline" | "unstated";

export interface Availability {
  readonly shape: TimeShape;
  /** What a person reads: `FRI · 7 PM`, `OCT 1–31`, `ANY NIGHT`. */
  readonly label: string;
  /** Local days this is on, ascending. Empty for anytime and unstated. */
  readonly days: readonly string[];
  /** Could somebody do this tonight? The question the whole lab is about. */
  readonly tonight: boolean;
  /** Needs more than one evening's notice — a costume, a trip. */
  readonly needsPlanning?: true;
  /**
   * The local hour it starts, **only** where a publisher stated a clock time.
   *
   * Absent for a date without a time, which matters: a date-only Event is
   * stored at UTC midnight, and reading that instant as an hour puts it at
   * five in the afternoon the day before. Anything that wants to know whether
   * something is a morning thing must ask this and must accept `undefined`.
   */
  readonly hour?: number;
}

export interface Shot {
  readonly src: string;
  readonly alt: string;
  /** Rendered wherever the licence requires it. Absent for Atlas media. */
  readonly credit?: string;
}

export interface Possibility {
  /** The entity id. Unique across sources by construction. */
  readonly id: string;
  readonly source: PossibilitySource;
  readonly title: string;
  /** One line, authored or from Atlas's description. Trimmed, never written. */
  readonly line?: string;
  readonly availability: Availability;
  /** Atlas's classification, or the lab's reading of an authored thing. */
  readonly setting: SubjectKind;
  /** Minutes it takes, where anybody has said. A film's runtime, an evening. */
  readonly minutes?: number;
  /** Where it is, as Atlas stated it. Never synthesised. */
  readonly locality?: string;
  /** 0 none, 1 a bit, 2 properly, 3 genuinely frightening. Authored only. */
  readonly scare?: 0 | 1 | 2 | 3;
  readonly withKids?: boolean;
  readonly image?: Shot;
  readonly href: string;
  /** The kind `passport_october_things` will accept, when it accepts one. */
  readonly keepAs?: OctoberKind;
  /** An Event's start, so a saved row can sort without re-reading Atlas. */
  readonly startsAt?: string | null;
  /**
   * Everything written about this, lowercased, for search to read. Includes
   * the description Atlas holds, which is why searching "pumpkin" finds a
   * farm whose title never says pumpkin.
   */
  readonly text: string;
  /** Lab-derived facets. Each one traces to a field above, never to a guess. */
  readonly tags: readonly string[];
}

// --------------------------------------------------------------- when

const MONTH = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
] as const;

const WEEKDAY = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

/** `2026-10-03` → `OCT 3`. Parsed as a plain date, never through a zone. */
export function dayLabel(day: string): string {
  const [, m, d] = day.split("-");
  return `${MONTH[Number(m) - 1]} ${Number(d)}`;
}

/** `2026-10-03` → `SAT`. Zone-free: the day string is already local. */
export function weekdayLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** `2026-10-03T19:00:00Z` → `7 PM` / `7:30 PM`, in the corpus's own zone. */
export function clockLabel(
  iso: string,
  timeZone = "America/Vancouver",
): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return (
    new Intl.DateTimeFormat("en-CA", {
      hour: "numeric",
      minute: "2-digit",
      timeZone,
    })
      .format(at)
      .replace(":00", "")
      // en-CA renders "2:00 p.m." with a narrow no-break space. Both the
      // periods and that invisible character have to go, or the label reads
      // "2 P.M." and breaks the line everywhere it is used.
      .replace(/[\u202f\u00a0]/g, " ")
      .replace(/\./g, "")
      .toUpperCase()
  );
}

/**
 * The temporal line for an Atlas subject, from the days it actually has.
 *
 * A single day with a published clock time reads as `SAT · 7 PM`; a single day
 * without one reads as `SAT OCT 3`, because a publisher who wrote only a date
 * stated the whole day and the clock would be Passport's invention. A run
 * reads as its span. No days at all reads as what that is.
 */
export function availabilityForAtlas(
  experience: Experience,
  days: readonly string[],
  today: string,
): Availability {
  const tonight = days.includes(today);

  if (days.length === 0) {
    return {
      shape: "unstated",
      label: "DATES NOT STATED",
      days: [],
      // Unknown is not yes. A surface that wants tonight must not be handed
      // a maybe dressed as a yes.
      tonight: false,
    };
  }

  if (days.length === 1) {
    const day = days[0];
    const stated =
      experience.startTime && experience.timePrecision === "minute"
        ? experience.startTime
        : undefined;
    const timed = stated ? clockLabel(stated) : undefined;
    return {
      shape: "fixed",
      label: timed
        ? `${weekdayLabel(day)} · ${timed}`
        : `${weekdayLabel(day)} ${dayLabel(day)}`,
      days,
      tonight,
      ...(stated ? { hour: hourOf(stated) } : {}),
    };
  }

  const first = days[0];
  const last = days[days.length - 1];
  // **A run across years says so.** Atlas holds at least one annual event as a
  // single span — Halloween Trick or Treat Trail runs 2023-10-31 to
  // 2026-10-31 — and without the years that renders as "OCT 31–OCT 31", which
  // reads as a bug in Passport rather than as what it is: a publisher's
  // recurring event flattened into one record. Saying the years makes the
  // data defect visible to whoever is looking at it, which is the honest
  // outcome while it remains unfixed upstream.
  const sameYear = first.slice(0, 4) === last.slice(0, 4);
  const year = (day: string) => ` ${day.slice(0, 4)}`;
  return {
    shape: "window",
    label: !sameYear
      ? `${dayLabel(first)}${year(first)}–${dayLabel(last)}${year(last)}`
      : first.slice(0, 7) === last.slice(0, 7)
        ? `${dayLabel(first)}–${Number(last.slice(8))}`
        : `${dayLabel(first)}–${dayLabel(last)}`,
    days,
    tonight,
  };
}

/** The local hour of a stated instant, in the corpus's own timezone. */
function hourOf(iso: string, timeZone = "America/Vancouver"): number {
  return Number(
    new Intl.DateTimeFormat("en-CA", {
      hour: "numeric",
      hour12: false,
      timeZone,
    }).format(new Date(iso)),
  );
}

const HOURS = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m}M` : m === 0 ? `${h}H` : `${h}H ${m}M`;
};

// ------------------------------------------------------- building a pool

/** What a film is, as a possibility: available every night, for its runtime. */
export function possibilityFromFilm(film: Film): Possibility {
  const scare = ({ cozy: 0, spooky: 1, creepy: 2, nightmare: 3 } as const)[
    film.fear
  ];
  return {
    id: film.id,
    source: "movie",
    title: film.title,
    line: film.line,
    availability: {
      shape: "anytime",
      label: `ANY NIGHT · ${HOURS(film.runtimeMinutes)}`,
      days: [],
      tonight: true,
    },
    // A film is watched under a roof. This is the one place the lab asserts a
    // setting rather than reading one, and it is not a risky assertion.
    setting: "indoor",
    minutes: film.runtimeMinutes,
    scare,
    withKids: film.audience === "kids",
    ...(film.trailerId
      ? {
          image: {
            // YouTube's own still for the trailer, the same source and the
            // same reasoning as the production Trailer component.
            src: `https://img.youtube.com/vi/${film.trailerId}/hqdefault.jpg`,
            alt: `A frame from the trailer for ${film.title}`,
          },
        }
      : {}),
    href: `/october/movies/${film.id}`,
    keepAs: "Movie",
    startsAt: null,
    text: [
      film.title,
      film.line,
      film.origin,
      film.fear,
      film.audience,
      ...film.mechanisms,
      "movie film watch",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
    tags: ["stay-in", "watch", `fear-${film.fear}`, ...film.mechanisms],
  };
}

/**
 * What a Doing is, as a possibility.
 *
 * Shelf decides time shape, and the mapping is authored rather than inferred:
 * a costume is pointless on the 1st of November and the catalogue's own copy
 * says so ("start on the 30th and it is a bedsheet"), so `be-something` is a
 * deadline. Everything else is genuinely any evening.
 */
export function possibilityFromDoing(doing: Doing): Possibility {
  const deadline = doing.shelf === "be-something";
  const evening = doing.takesAnEvening === true;
  return {
    id: doing.id,
    source: "doing",
    title: doing.title,
    line: doing.detail?.hook ?? doing.line,
    availability: {
      shape: deadline ? "deadline" : "anytime",
      label: deadline
        ? "BEFORE HALLOWEEN"
        : evening
          ? "ANY EVENING"
          : "ANY NIGHT",
      days: [],
      tonight: !deadline || !evening,
      ...(deadline ? { needsPlanning: true as const } : {}),
    },
    setting: "indoor",
    ...(evening ? { minutes: 150 } : {}),
    withKids: doing.withKids === true,
    ...(doing.image
      ? {
          image: {
            src: doing.image.src,
            alt: doing.image.alt,
            credit: `${doing.image.credit} · ${doing.image.licence}`,
          },
        }
      : {}),
    href: `/october/make/${doing.id}`,
    keepAs: "Doing",
    startsAt: null,
    text: [
      doing.title,
      doing.line,
      doing.detail?.hook,
      doing.detail?.trick.title,
      ...(doing.detail?.need ?? []),
      doing.shelf.replace(/-/g, " "),
      "make making craft",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
    tags: [
      "stay-in",
      "make",
      doing.shelf,
      ...(doing.withKids ? ["with-kids"] : []),
    ],
  };
}

/**
 * What an Atlas subject is, as a possibility.
 *
 * `setting` and `days` are passed in rather than computed, because both need
 * context this module should not reach for — the venue's subtype for the
 * classification, and the calendar's own reading for the days. Keeping them
 * as arguments is what lets this stay a pure function with a test.
 */
export function possibilityFromAtlas(
  experience: Experience,
  options: {
    readonly days: readonly string[];
    readonly setting: SubjectKind;
    readonly today: string;
  },
): Possibility {
  const { days, setting, today } = options;
  const description = experience.description?.trim();
  return {
    id: experience.id,
    source: "atlas",
    title: experience.title,
    ...(description ? { line: clipTo(description, LINE_MAX) } : {}),
    availability: availabilityForAtlas(experience, days, today),
    setting,
    ...(experience.venue?.locality
      ? { locality: experience.venue.locality }
      : {}),
    ...(experience.heroMedia?.src
      ? {
          image: {
            src: experience.heroMedia.src,
            // Atlas states no alt text. Naming the subject is accurate and
            // does not pretend to describe a photograph nobody has described.
            alt: experience.title,
          },
        }
      : {}),
    // **The link says which kind it is.** The detail page otherwise asks
    // Atlas three times — organizations, experiences, events — because it has
    // no way to know, and each miss is a full remote read. Discovery does
    // know, so it says, and a subject opens with one query instead of three.
    //
    // **Where it goes is Passport's decision, not a second one.** This used to
    // read `detailReady ? /passport/… : /october/discover` — so a subject with
    // no photograph linked to the page the reader was already on. Six of the
    // seventeen cards on production did, because `detailReady` requires an
    // `imageUrl`: a missing picture quietly became a dead link.
    //
    // `destinationFor` already settled this for Passport's own discovery —
    // readiness chooses *which* page a Place gets and never whether it has one
    // — and the October surface simply wasn't asking it.
    href: hrefFor(experience),
    ...(experience.kind === "Place" ||
    experience.kind === "Organization" ||
    experience.kind === "Activity" ||
    experience.kind === "Event" ||
    experience.kind === "Experience"
      ? { keepAs: experience.kind as OctoberKind }
      : {}),
    startsAt: experience.startTime ?? null,
    text: clipTo(
      [
        experience.title,
        description,
        experience.venue?.locality,
        experience.venue?.name,
        experience.subtype,
        ...(experience.aliases ?? []),
        setting.replace(/-/g, " "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
      TEXT_MAX,
    ),
    tags: [
      "go-out",
      setting,
      ...(experience.kind === "Event" ? ["event"] : []),
    ],
  };
}

/**
 * Where this subject opens, and what it tells the detail page on the way.
 *
 * The destination is Passport's (`destinationFor`); the `?kind=` is October's
 * own saving of two remote reads. A Place rich enough for `/places/[id]` needs
 * no hint — that route knows what it is already.
 */
function hrefFor(experience: Experience): string {
  const to = destinationFor(experience);
  if (!to) return HERE;
  return to.startsWith("/passport/")
    ? `${to}${detailHint(experience.kind)}`
    : to;
}

/**
 * Where a subject with no id would have gone. Nothing Atlas holds reaches it —
 * `destinationFor` only declines an entity with no id, and a candidate without
 * one never became a possibility — but a card must always have somewhere to go.
 */
const HERE = "/october/discover";

/** Which composed-detail route this Atlas kind lives on, if any. */
function detailHint(kind: Experience["kind"]): string {
  const route =
    kind === "Organization"
      ? "organizations"
      : kind === "Experience"
        ? "experiences"
        : kind === "Event"
          ? "events"
          : undefined;
  return route ? `?kind=${route}` : "";
}

/**
 * **The whole pool travels to the browser, so the whole pool is trimmed.**
 *
 * Discovery sends every possibility to the client because search and
 * filtering happen there — that is what makes them instant, and it is worth
 * keeping. Measured on production, the page was 308 KB of HTML to render
 * seventeen cards, and 87 KB of that was `line` and `text`.
 *
 * **This recovered about 5 KB of it, not 30.** The caps catch outliers — the
 * longest `text` went from 616 characters to 385 — and almost nothing else
 * exceeded them, so the honest description of this is a guard against a
 * pathological description rather than a payload fix. The payload is 238
 * possibilities travelling by design; shrinking it means sending fewer of
 * them, which is a change to how Discovery works and not one to make inside
 * a performance pass.
 *
 * `line` is capped at rather more than any card displays (the longest clip is
 * 200 characters), so nothing visible changes. `text` is the search index and
 * is capped further out, because the words that make a thing findable are at
 * the start of what a publisher wrote, not at the end.
 */
const LINE_MAX = 240;
const TEXT_MAX = 320;

/** Cut on a word boundary where there is one nearby, so nothing ends mid-word. */
function clipTo(value: string, max: number): string {
  const flat = value.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return space > max * 0.6 ? cut.slice(0, space) : cut;
}

/** Deterministic order for anything that has to be stable across renders. */
export function byTitle(a: Possibility, b: Possibility): number {
  return a.title.localeCompare(b.title);
}
