import type { Experience } from "@/domain/experience/types";

/**
 * **Editorial shelves over real Atlas content.**
 *
 * The List view answers *"find the thing I already have in mind"*. This answers
 * the other question — *"what could make today better?"* — and the difference
 * is entirely in the framing, not the data. Both read the same candidates.
 *
 * ## What a shelf may be built from
 *
 * `candidateToExperience` deliberately leaves `moods`, `seasons`, `companions`
 * and the rest **empty** for anything that came from Atlas, because Atlas
 * states none of them and the mapper refuses to invent them. So a shelf can
 * only ever group on what is really there:
 *
 * ```
 * kind        Place · Organization · Activity · Event
 * subtype     the source's own word — "trail", "beach", "winery"
 * title       the entity's own name
 * description Atlas's own prose
 * startTime   a real date, on Events only
 * ```
 *
 * The **titles are Passport's** — "Golden hour", "Bring the kids" — and the
 * *members* are Atlas's. That split is the whole rule: editorial framing is
 * ours to write, and no card ever claims a fact Atlas did not state. A shelf
 * called "Bring the kids" says Passport thinks these suit a family outing; it
 * does not add `familyFriendly` to anything.
 *
 * ## Why keyword matching is honest here and not elsewhere
 *
 * Matching "trail" against a subtype to decide which *shelf* something appears
 * on is a presentation choice, and a wrong one costs a card in a slightly odd
 * group. This is emphatically not the identity matching Atlas forbids — nothing
 * here writes, merges, or asserts. Ordering a shelf badly is a design bug;
 * asserting a fact would be a lie.
 */

export interface Shelf {
  readonly id: string;
  /** Passport's own words. */
  readonly title: string;
  /** One line of framing, also Passport's. */
  readonly blurb: string;
  readonly experiences: readonly Experience[];
}

/** Everything the matcher reads, lowercased once. */
function haystack(experience: Experience): string {
  return [
    experience.title,
    experience.subtype ?? "",
    experience.shortDescription ?? "",
    experience.context?.name ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

function matching(
  experiences: readonly Experience[],
  pattern: RegExp,
): Experience[] {
  return experiences.filter((experience) => pattern.test(haystack(experience)));
}

/**
 * Events starting within the window, soonest first.
 *
 * `now` is passed in rather than read from the clock so the feed is
 * deterministic in a test and honest in a browser — the same reason Atlas makes
 * Passport resolve "this weekend" into two instants before asking.
 */
function upcoming(
  experiences: readonly Experience[],
  now: Date,
  days: number,
): Experience[] {
  const until = now.getTime() + days * 24 * 60 * 60 * 1000;
  return experiences
    .filter((experience) => {
      if (experience.kind !== "Event" || !experience.startTime) return false;
      const at = new Date(experience.startTime).getTime();
      return at >= now.getTime() && at <= until;
    })
    .sort(
      (a, b) =>
        new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime(),
    );
}

/** A card with no picture is a weak card in an image-first feed — but never a hidden one. */
function pictureFirst(experiences: readonly Experience[]): Experience[] {
  return [...experiences].sort(
    (a, b) => Number(Boolean(b.heroMedia)) - Number(Boolean(a.heroMedia)),
  );
}

const SHELF_SIZE = 12;

/**
 * Build the feed.
 *
 * Shelves are assembled in order and an experience joins **at most one** — the
 * first that claims it. A card appearing in four shelves makes a feed of twelve
 * shelves feel like a feed of three, and the scroll stops being a discovery.
 * The last shelf deliberately sweeps up whatever is left, so nothing Atlas
 * knows is silently unreachable.
 */
export function inspirationShelves(
  experiences: readonly Experience[],
  now: Date = new Date(),
): Shelf[] {
  const claimed = new Set<string>();
  const shelves: Shelf[] = [];

  const add = (
    id: string,
    title: string,
    blurb: string,
    members: readonly Experience[],
    minimum = 3,
  ) => {
    const fresh = pictureFirst(
      members.filter((experience) => !claimed.has(experience.id)),
    ).slice(0, SHELF_SIZE);
    // A shelf of one looks like a mistake rather than a selection.
    if (fresh.length < minimum) return;
    for (const experience of fresh) claimed.add(experience.id);
    shelves.push({ id, title, blurb, experiences: fresh });
  };

  // Dated things first: they are the only cards that can expire, so they are
  // the only ones where being buried costs the reader something real.
  add(
    "soon",
    "Happening soon",
    "Dated and real — from what Atlas has read about the weeks ahead.",
    upcoming(experiences, now, 21),
    1,
  );

  add(
    "fall",
    "Golden hour",
    "Trails, lookouts and quiet corners for the season the valley does best.",
    matching(
      experiences,
      /\btrail|hike|hiking|lookout|viewpoint|scenic|ridge|summit|mountain|forest|orchard\b/,
    ),
  );

  add(
    "water",
    "On the water",
    "Beaches, lakes and the places to put a boat in.",
    matching(
      experiences,
      /\bbeach|lake|boat|marina|swim|paddle|water|creek|river\b/,
    ),
  );

  add(
    "kids",
    "Bring the kids",
    "Parks and playgrounds with room to run around.",
    matching(experiences, /\bplayground|family|kids|children|park\b/),
  );

  add(
    "eat",
    "Eat and drink",
    "Where to end up afterwards.",
    matching(
      experiences,
      /\brestaurant|cafe|coffee|bakery|pub|bar\b|brewery|winery|cidery|distiller|bistro|eatery|food\b/,
    ),
  );

  add(
    "bigwhite",
    "Up at Big White",
    "The mountain has a summer and a shoulder season too.",
    matching(
      experiences,
      /big white|silver ?star|ski|snow|alpine|chairlift|gondola/,
    ),
  );

  add(
    "culture",
    "Galleries and local culture",
    "Museums, galleries and the things a place keeps about itself.",
    matching(
      experiences,
      /\bgaller|museum|heritage|historic|art\b|theatre|theater|cultur/,
    ),
  );

  // Everything Atlas knows that no shelf above claimed. Last on purpose: it is
  // the shelf most likely to surprise, and least likely to be what anyone came
  // looking for.
  add(
    "unexpected",
    "Something unexpected",
    "The rest of what Atlas has found around here.",
    experiences.filter((experience) => !claimed.has(experience.id)),
  );

  return shelves;
}
