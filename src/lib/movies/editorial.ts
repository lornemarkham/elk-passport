import { CATALOGUE, type Film } from "./catalogue";

/**
 * **October's opinions, kept away from October's facts.**
 *
 * `catalogue.ts` holds what is true about a film: its year, its runtime, where
 * it was made, who it suits, how frightening it is. This file holds what
 * *October thinks* — which angle it reaches for a film from, and occasionally
 * a paragraph about why.
 *
 * They are separate files because they are separate kinds of claim, and the
 * product has to be able to tell them apart. A runtime is checkable. "A
 * generation of British children learned what fear was" is a point of view,
 * and it belongs to October.
 *
 * ## This is not, and must never look like, a user review
 *
 * Everything here is editorial, written in October's voice and labelled as
 * October's. `passport_movie_reactions` holds what real people said, it is
 * private to them by row-level security, and the two are never rendered in the
 * same component or the same typography. The day Passport shows one person's
 * words to another person, it will be because a moderation model exists — not
 * because an opinion happened to be sitting in the same list.
 *
 * ## Why an angle rather than tags
 *
 * A cloud of tags describes a film. One angle is a *decision*: the single
 * reason October reaches for this one, which is the thing a person is actually
 * choosing between on a Friday night. It is also what lets the catalogue page
 * be a set of edited shelves rather than 44 rows of search results.
 */

export type Angle =
  | "october-classic"
  | "forgotten"
  | "canadian"
  | "what-the-hell"
  | "actually-scary"
  | "with-the-kids"
  | "chaos-80s"
  | "funny";

export interface AngleVoice {
  /** The badge, as it appears on a card. */
  readonly label: string;
  /** The shelf heading on the catalogue page. */
  readonly heading: string;
  /** What October means by it. One line, under the heading. */
  readonly line: string;
}

/**
 * The order here is the order the shelves appear, and it is deliberate: the
 * strange things come first. A person who wanted the canon already knows where
 * the canon is — what they cannot get from a search box is somebody with taste
 * saying *this one, the one you have never heard of*.
 */
export const ANGLES: Record<Angle, AngleVoice> = {
  "what-the-hell": {
    label: "What the hell is this",
    heading: "What the hell is this",
    line: "Films that sound made up. They are not. That is the problem.",
  },
  forgotten: {
    label: "You probably missed this",
    heading: "You probably missed this",
    line: "Genuinely good, genuinely out of the conversation.",
  },
  canadian: {
    label: "Canadian nightmare",
    heading: "Canadian nightmare",
    line: "Made here. Colder than you remember.",
  },
  "chaos-80s": {
    label: "80s chaos",
    heading: "80s chaos",
    line: "Practical effects, questionable judgement, no restraint whatsoever.",
  },
  "actually-scary": {
    label: "Actually scary",
    heading: "Actually scary",
    line: "Not atmospheric. Not unsettling. Scary.",
  },
  "with-the-kids": {
    label: "Watch with the kids",
    heading: "Watch with the kids",
    line: "Some of these are gentler than you think. Some are not.",
  },
  funny: {
    label: "Funny on purpose",
    heading: "Funny on purpose",
    line: "Horror that knows exactly what it is doing.",
  },
  "october-classic": {
    label: "October classic",
    heading: "October classics",
    line: "You know these. They earned it.",
  },
};

/** Every angle, in the order the shelves should read. */
export const ANGLE_ORDER = Object.keys(ANGLES) as readonly Angle[];

/**
 * The one reason October reaches for each film.
 *
 * Hand-authored, all 44 of them. There is no rule that produces this from the
 * other fields and there should not be — the moment an angle is computed from
 * `fear` and `year` it stops being an opinion and becomes a restatement, which
 * is exactly the boring list this replaced.
 */
const ANGLE_OF: Record<string, Angle> = {
  // kids
  "great-pumpkin": "with-the-kids",
  "were-rabbit": "funny",
  "nightmare-before-christmas": "october-classic",
  "hocus-pocus": "october-classic",
  casper: "with-the-kids",
  "corpse-bride": "with-the-kids",
  "scooby-doo": "funny",
  "monster-house": "with-the-kids",
  paranorman: "with-the-kids",
  beetlejuice: "chaos-80s",
  ghostbusters: "chaos-80s",
  coraline: "with-the-kids",
  // teens
  "addams-family": "funny",
  jaws: "october-classic",
  poltergeist: "chaos-80s",
  "sixth-sense": "october-classic",
  signs: "october-classic",
  "the-others": "actually-scary",
  "a-quiet-place": "actually-scary",
  arachnophobia: "funny",
  "the-ring": "actually-scary",
  // adults
  "get-out": "october-classic",
  "halloween-1978": "october-classic",
  alien: "october-classic",
  "the-thing": "actually-scary",
  "the-shining": "october-classic",
  "the-witch": "actually-scary",
  hereditary: "actually-scary",
  // the ones you were not expecting
  "peanut-butter-solution": "what-the-hell",
  "the-changeling": "forgotten",
  cube: "canadian",
  "ginger-snaps": "canadian",
  "the-gate": "chaos-80s",
  hausu: "what-the-hell",
  "the-platform": "actually-scary",
  "something-wicked": "october-classic",
  "watcher-in-the-woods": "forgotten",
  "the-witches": "with-the-kids",
  "lady-in-white": "forgotten",
  "the-burbs": "funny",
  "the-frighteners": "funny",
  "dead-alive": "what-the-hell",
  "people-under-the-stairs": "forgotten",
  "cemetery-man": "what-the-hell",
};

export const angleOf = (filmId: string): Angle | undefined => ANGLE_OF[filmId];

/** Films on a given shelf, catalogue order. */
export function filmsOnShelf(
  angle: Angle,
  catalogue: readonly Film[] = CATALOGUE,
): Film[] {
  return catalogue.filter((f) => ANGLE_OF[f.id] === angle);
}

export interface Pick {
  readonly filmId: string;
  /**
   * October's paragraph. Written by a person, in October's voice, about a film
   * they have seen. Never a summary of what anybody else thought.
   */
  readonly note: string;
}

/**
 * **October Picks — five, chosen by hand, and deliberately not an algorithm.**
 *
 * The catalogue may grow to hundreds. This stays at five, because the value of
 * a recommendation is inversely proportional to how many of them there are. An
 * algorithm cannot do this yet and pretending otherwise would produce exactly
 * the list a search engine already gives you.
 *
 * Each pick carries a different angle on purpose — the set has to demonstrate
 * range, not five variations of *obscure and Canadian*.
 */
export const OCTOBER_PICKS: readonly Pick[] = [
  {
    filmId: "peanut-butter-solution",
    note: "Nobody believes this film exists until they watch it. A Montreal boy is so frightened by what he sees in a burned-out house that his hair falls out. A recipe involving peanut butter grows it back — too much of it — and then a painter starts taking children to make brushes. It was made for children. It was publicly funded. It is here because October should occasionally frighten you with the fact that something is real.",
  },
  {
    filmId: "the-changeling",
    note: "George C. Scott loses his family, takes a vast empty house, and finds something in it that wants to be heard. A Canadian production with one of the most frightening seance scenes ever filmed, and it is somehow never in the conversation. If you take one thing off this list, take this.",
  },
  {
    filmId: "ginger-snaps",
    note: "Two sisters in an Ontario suburb, preoccupied with death, until one of them is bitten by something in the park and begins changing in ways that are not only lycanthropic. It is funny, it is mean, and it understands teenage girls better than almost any horror film of its decade.",
  },
  {
    filmId: "something-wicked",
    note: "Ray Bradbury adapted his own novel and Disney made it, which should not have worked. A carnival arrives in late October and offers every adult in town the one thing they regret not having. No film on this list has ever looked more like October.",
  },
  {
    filmId: "the-witches",
    note: "Roald Dahl, Nicolas Roeg, and Jim Henson's workshop — a sentence that should not be possible. It is genuinely charming for forty minutes, and then Anjelica Huston takes her face off and a generation learned what fear was. Watch it with kids who can take it.",
  },
];
