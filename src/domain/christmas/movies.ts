import { filmById, type Audience, type Film } from "@/lib/movies/catalogue";

/**
 * **Christmas movies** (owner brief M1064, priority 4) — a small, hand-made
 * list of well-known Christmas films for a night in, shelved the way a family
 * actually chooses: family, comedies, romance, classics, animated.
 *
 * ## The facts, and what is not here
 *
 * The shape is October's `Film` (`src/lib/movies/catalogue.ts`), minus its
 * fear axis: id, title, year, runtime, an MPA certification **only where it is
 * known** (several of these were made for television and the MPA never rated
 * them, so the field is absent and the page says nothing), Passport's own
 * audience ceiling, and one authored line. The Nightmare Before Christmas is
 * October's own entry, read from its catalogue, verified trailer and all.
 *
 * **There is no streaming availability.** Passport has no licensing feed for
 * Canada, and which app carries a film changes every season; a guess would be
 * an invented fact. The page says so, and points at the apps a person already
 * has, the library, or a cinema stop on a planned night out (Atlas finds the
 * cinema; showtimes are the cinema's own).
 *
 * Runtimes are rounded to the minute as commonly published and shown as
 * "about"; an edition can differ by a few minutes.
 */
export type Kind = "family" | "comedy" | "romance" | "classic" | "animated";

export interface ChristmasFilm extends Pick<
  Film,
  "id" | "title" | "year" | "runtimeMinutes" | "certification" | "trailerId"
> {
  /** Passport's own ceiling: who it suits, authored, never derived. */
  readonly audience: Audience;
  readonly kinds: readonly Kind[];
  /** One line, authored. */
  readonly line: string;
}

export const KINDS: readonly {
  id: Kind;
  label: string;
  emoji: string;
  line: string;
}[] = [
  {
    id: "family",
    label: "Family movies",
    emoji: "👨‍👩‍👧",
    line: "Everybody on the couch, nobody bored.",
  },
  {
    id: "comedy",
    label: "Comedies",
    emoji: "😂",
    line: "The ones you quote every December.",
  },
  {
    id: "romance",
    label: "Romance",
    emoji: "💝",
    line: "Snow, a near-miss, and a kiss by the end.",
  },
  {
    id: "classic",
    label: "Classics",
    emoji: "🎞️",
    line: "Older than your parents, and still the best.",
  },
  {
    id: "animated",
    label: "Animated",
    emoji: "⛄",
    line: "Drawn, stop-motion and computer-made.",
  },
];

const MPA = (code: string) => ({ system: "MPA" as const, code });

const nightmare = filmById("nightmare-before-christmas");

export const FILMS: readonly ChristmasFilm[] = [
  {
    id: "elf",
    title: "Elf",
    year: 2003,
    runtimeMinutes: 97,
    certification: MPA("PG"),
    audience: "kids",
    kinds: ["family", "comedy"],
    line: "A man raised by Santa's elves goes to New York to find his dad.",
  },
  {
    id: "home-alone",
    title: "Home Alone",
    year: 1990,
    runtimeMinutes: 103,
    certification: MPA("PG"),
    audience: "kids",
    kinds: ["family", "comedy", "classic"],
    line: "Left behind for Christmas, an eight-year-old defends the house.",
  },
  {
    id: "polar-express",
    title: "The Polar Express",
    year: 2004,
    runtimeMinutes: 100,
    certification: MPA("G"),
    audience: "kids",
    kinds: ["family", "animated"],
    line: "A boy who's stopped believing takes a night train to the North Pole.",
  },
  {
    id: "santa-clause",
    title: "The Santa Clause",
    year: 1994,
    runtimeMinutes: 97,
    certification: MPA("PG"),
    audience: "kids",
    kinds: ["family", "comedy"],
    line: "A divorced dad puts on the suit and finds out it comes with the job.",
  },
  {
    id: "arthur-christmas",
    title: "Arthur Christmas",
    year: 2011,
    runtimeMinutes: 97,
    certification: MPA("PG"),
    audience: "kids",
    kinds: ["family", "animated", "comedy"],
    line: "One present was missed. Santa's clumsy younger son sets out to deliver it.",
  },
  {
    id: "klaus",
    title: "Klaus",
    year: 2019,
    runtimeMinutes: 96,
    certification: MPA("PG"),
    audience: "kids",
    kinds: ["family", "animated"],
    line: "A spoiled postman and a lonely toymaker in a frozen, feuding town.",
  },
  {
    id: "muppet-christmas-carol",
    title: "The Muppet Christmas Carol",
    year: 1992,
    runtimeMinutes: 85,
    certification: MPA("G"),
    audience: "kids",
    kinds: ["family", "comedy", "classic"],
    line: "Dickens, faithfully told: Michael Caine as Scrooge, Kermit as Bob Cratchit.",
  },
  {
    id: "the-grinch-2018",
    title: "The Grinch",
    year: 2018,
    runtimeMinutes: 86,
    certification: MPA("PG"),
    audience: "kids",
    kinds: ["family", "animated"],
    line: "Dr. Seuss's grump plots to steal Christmas from Whoville.",
  },
  {
    id: "grinch-1966",
    title: "How the Grinch Stole Christmas!",
    year: 1966,
    runtimeMinutes: 26,
    audience: "kids",
    kinds: ["animated", "classic", "family"],
    line: "The half-hour television original, narrated by Boris Karloff.",
  },
  {
    id: "charlie-brown-christmas",
    title: "A Charlie Brown Christmas",
    year: 1965,
    runtimeMinutes: 25,
    audience: "kids",
    kinds: ["animated", "classic", "family"],
    line: "A small sad tree, a jazz piano, and what Christmas is all about.",
  },
  {
    id: "frosty-the-snowman",
    title: "Frosty the Snowman",
    year: 1969,
    runtimeMinutes: 25,
    audience: "kids",
    kinds: ["animated", "classic", "family"],
    line: "A magic hat, a snowman who comes alive, and a race to the North Pole.",
  },
  ...(nightmare
    ? [
        {
          id: nightmare.id,
          title: nightmare.title,
          year: nightmare.year,
          runtimeMinutes: nightmare.runtimeMinutes,
          ...(nightmare.certification
            ? { certification: nightmare.certification }
            : {}),
          ...(nightmare.trailerId ? { trailerId: nightmare.trailerId } : {}),
          audience: nightmare.audience,
          kinds: ["animated", "family"] as Kind[],
          line: "Halloween Town's Jack Skellington discovers Christmas — and tries to run it.",
        },
      ]
    : []),
  {
    id: "wonderful-life",
    title: "It's a Wonderful Life",
    year: 1946,
    runtimeMinutes: 130,
    certification: MPA("PG"),
    audience: "teens",
    kinds: ["classic", "family"],
    line: "On Christmas Eve, an angel shows George Bailey what his town would be without him.",
  },
  {
    id: "miracle-on-34th-street",
    title: "Miracle on 34th Street",
    year: 1947,
    runtimeMinutes: 96,
    audience: "kids",
    kinds: ["classic", "family"],
    line: "A department-store Santa says he's the real one, and goes to court over it.",
  },
  {
    id: "white-christmas",
    title: "White Christmas",
    year: 1954,
    runtimeMinutes: 120,
    audience: "kids",
    kinds: ["classic", "romance"],
    line: "Bing Crosby, Danny Kaye, a Vermont inn short of snow, and the song.",
  },
  {
    id: "holiday-inn",
    title: "Holiday Inn",
    year: 1942,
    runtimeMinutes: 100,
    audience: "kids",
    kinds: ["classic", "romance"],
    line: "Crosby and Astaire at an inn open only on holidays — where 'White Christmas' began.",
  },
  {
    id: "a-christmas-story",
    title: "A Christmas Story",
    year: 1983,
    runtimeMinutes: 94,
    certification: MPA("PG"),
    audience: "teens",
    kinds: ["classic", "comedy", "family"],
    line: "Ralphie wants one thing for Christmas, and every adult says no.",
  },
  {
    id: "christmas-vacation",
    title: "National Lampoon's Christmas Vacation",
    year: 1989,
    runtimeMinutes: 97,
    certification: MPA("PG-13"),
    audience: "teens",
    kinds: ["comedy"],
    line: "Clark Griswold wants a perfect family Christmas. The lights alone are a disaster.",
  },
  {
    id: "scrooged",
    title: "Scrooged",
    year: 1988,
    runtimeMinutes: 101,
    certification: MPA("PG-13"),
    audience: "teens",
    kinds: ["comedy"],
    line: "Bill Murray as a TV boss visited by three very modern ghosts.",
  },
  {
    id: "jingle-all-the-way",
    title: "Jingle All the Way",
    year: 1996,
    runtimeMinutes: 89,
    certification: MPA("PG"),
    audience: "kids",
    kinds: ["family", "comedy"],
    line: "A dad hunts the one toy every kid wants on Christmas Eve.",
  },
  {
    id: "noelle",
    title: "Noelle",
    year: 2019,
    runtimeMinutes: 100,
    certification: MPA("G"),
    audience: "kids",
    kinds: ["family", "comedy"],
    line: "Santa's daughter has to find her brother and save Christmas.",
  },
  {
    id: "spirited",
    title: "Spirited",
    year: 2022,
    runtimeMinutes: 127,
    certification: MPA("PG-13"),
    audience: "teens",
    kinds: ["comedy"],
    line: "A musical Christmas Carol, told from the ghosts' side.",
  },
  {
    id: "while-you-were-sleeping",
    title: "While You Were Sleeping",
    year: 1995,
    runtimeMinutes: 103,
    certification: MPA("PG"),
    audience: "teens",
    kinds: ["romance", "comedy"],
    line: "A lonely transit worker is mistaken for a stranger's fiancée at Christmas.",
  },
  {
    id: "the-holiday",
    title: "The Holiday",
    year: 2006,
    runtimeMinutes: 136,
    certification: MPA("PG-13"),
    audience: "adults",
    kinds: ["romance", "comedy"],
    line: "Two women swap houses across the Atlantic for Christmas.",
  },
  {
    id: "the-family-stone",
    title: "The Family Stone",
    year: 2005,
    runtimeMinutes: 103,
    certification: MPA("PG-13"),
    audience: "adults",
    kinds: ["romance", "comedy"],
    line: "Meeting the boyfriend's family at Christmas goes as badly as it can.",
  },
  {
    id: "last-christmas",
    title: "Last Christmas",
    year: 2019,
    runtimeMinutes: 103,
    certification: MPA("PG-13"),
    audience: "adults",
    kinds: ["romance"],
    line: "A London Christmas-shop elf meets someone who changes her year.",
  },
  {
    id: "happiest-season",
    title: "Happiest Season",
    year: 2020,
    runtimeMinutes: 102,
    certification: MPA("PG-13"),
    audience: "adults",
    kinds: ["romance", "comedy"],
    line: "A planned proposal at her girlfriend's family Christmas — where she isn't out yet.",
  },
  {
    id: "love-actually",
    title: "Love Actually",
    year: 2003,
    runtimeMinutes: 135,
    certification: MPA("R"),
    audience: "adults",
    kinds: ["romance", "comedy"],
    line: "Ten London love stories in the five weeks before Christmas.",
  },
];

/** Who is watching — the one question Movie Night asks first. */
export type Watching = "little" | "family" | "grownups" | "date";

export const WATCHING: readonly { id: Watching; label: string }[] = [
  { id: "little", label: "Little ones" },
  { id: "family", label: "The whole family" },
  { id: "grownups", label: "Grown-ups" },
  { id: "date", label: "A date night" },
];

export const isKind = (v: unknown): v is Kind => KINDS.some((k) => k.id === v);
export const isWatching = (v: unknown): v is Watching =>
  WATCHING.some((w) => w.id === v);

/**
 * What suits who is watching. Little ones: rated G, or made for children and
 * under an hour and three-quarters. The whole family: anything Passport
 * marked for kids. Grown-ups: everything. A date: romance and comedies.
 */
export function suits(film: ChristmasFilm, who: Watching): boolean {
  switch (who) {
    case "little":
      return (
        film.audience === "kids" &&
        (film.certification?.code === "G" || film.runtimeMinutes <= 105)
      );
    case "family":
      return film.audience === "kids";
    case "date":
      return film.kinds.includes("romance") || film.kinds.includes("comedy");
    case "grownups":
      return true;
  }
}

export function shelf(kind: Kind): ChristmasFilm[] {
  return FILMS.filter((f) => f.kinds.includes(kind));
}

/**
 * **Three for tonight.** Films that suit who is watching (and the kind, if
 * one was picked), three at a time; `round` moves on to the next three and
 * wraps, so "three more" never runs out. Deterministic, so a shared link
 * shows the same three.
 */
export function threeFor(
  who: Watching,
  kind: Kind | undefined,
  round = 0,
): { films: ChristmasFilm[]; of: number } {
  const fit = FILMS.filter(
    (f) => suits(f, who) && (!kind || f.kinds.includes(kind)),
  )
    // A date leads with the romances; the comedies follow.
    .map((f, i) => ({ f, i }))
    .sort(
      (a, b) =>
        (who === "date"
          ? Number(!a.f.kinds.includes("romance")) -
            Number(!b.f.kinds.includes("romance"))
          : 0) || a.i - b.i,
    )
    .map(({ f }) => f);
  if (fit.length <= 3) return { films: fit, of: fit.length };
  const start = (Math.max(0, round) * 3) % fit.length;
  const films = [0, 1, 2].map((i) => fit[(start + i) % fit.length]!);
  return { films, of: fit.length };
}

export const filmFor = (id: string | undefined): ChristmasFilm | undefined =>
  id ? FILMS.find((f) => f.id === id) : undefined;

/** Ideas for the night around the film: ideas, no venue, time or price. */
export const NIGHT_IN: readonly string[] = [
  "Hot chocolate, with a marshmallow each for the brave",
  "Popcorn — or cookies baked before it starts",
  "Every blanket in the house on the couch",
  "Phones in a basket until the credits",
  "Pyjamas, and a pause halfway for a stretch",
];
