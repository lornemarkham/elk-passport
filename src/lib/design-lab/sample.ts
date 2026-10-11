import "server-only";
import { listDiscoveryCandidates } from "@/lib/data/atlas-repo";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { Experience } from "@/domain/experience/types";
import { placeLabel, areaLabel, whereLine } from "@/domain/discovery/compose";
import { recurrenceLine } from "@/domain/discovery/recurrence";

/**
 * **Real Atlas content for the design sandbox, and nothing else.**
 *
 * Three visual directions are being compared, and the only way that comparison
 * is worth anything is if all three are rendering the same real subjects —
 * Kalamoir Park's actual photograph, Atlas's actual sentence about it, the
 * verbs Atlas actually states. A prototype dressed in invented places and
 * stock copy proves that a designer can write nice copy, which is not the
 * question.
 *
 * So this reads the live corpus and hands the same view model to all three.
 * Where Atlas says nothing, the field is absent and each direction has to
 * cope — which is itself part of what is being compared, because 68% of the
 * corpus has no location and four subjects in five have no photograph.
 */
export interface Subject {
  readonly id: string;
  readonly title: string;
  readonly kind: string;
  /** Atlas's own sentence. Never rewritten, never padded. */
  readonly blurb?: string;
  readonly heroUrl?: string;
  /** The town, where Atlas states one. */
  readonly place?: string;
  readonly area?: string;
  readonly where?: string;
  /** What Atlas says you can do — its words, its spelling. */
  readonly doing: readonly string[];
  /** Free-text key facts Atlas holds, label and value, unedited. */
  readonly facts: readonly { readonly label: string; readonly value: string }[];
  readonly startTime?: string;
  /** `[longitude, latitude]` where Atlas states them. For real distances. */
  readonly coordinates?: readonly [number, number];
  /** Atlas's stated recurrence, in its own weekday names. */
  readonly recurs?: string;
  /** Atlas says its own sentence adds nothing. Shown small, or not at all. */
  readonly weakBlurb?: boolean;
  /** Atlas's verdict words for this subject's environment, where stated. */
  readonly outdoor?: boolean;
  /**
   * **Who Atlas says this is for**, read straight from
   * `candidate-suitability/1` statements — never inferred.
   *
   * No `childAge` is sent here, so there is no `forAge` verdict to read; these
   * are the statements themselves. `adultsOnly` is a stated rule (19+, "no
   * minors", an age band starting at 18 or above). `families` is a stated
   * characterisation. A subject with neither is **unknown**, which is most of
   * them, and nothing here treats that as either answer.
   */
  readonly audience?: {
    readonly adultsOnly?: boolean;
    readonly families?: boolean;
    /** The sentence it was read from, so a surface can show its working. */
    readonly says?: string;
  };
}

/**
 * Read who Atlas says a subject is for, from its own statements.
 *
 * Deliberately only the two unambiguous shapes — a stated adults-only rule,
 * and a stated family characterisation. Anything subtler is a job for
 * `suitability.forAge`, which needs an age Passport has not been given here.
 */
function audienceOf(experience: Experience): Subject["audience"] | undefined {
  const statements = experience.suitability?.statements ?? [];
  const adult = statements.find(
    (said) =>
      said.about === "age" &&
      (said.says === "adults-only" || (said.ages?.min ?? 0) >= 18),
  );
  const family = statements.find(
    (said) =>
      said.about === "audience" &&
      (said.says === "families" || said.says === "children"),
  );
  if (!adult && !family) return undefined;
  return {
    ...(adult ? { adultsOnly: true } : {}),
    ...(family ? { families: true } : {}),
    ...((adult ?? family)?.text ? { says: (adult ?? family)!.text } : {}),
  };
}

function subjectOf(experience: Experience): Subject {
  const knowledge = experience.knowledge;
  return {
    id: experience.id,
    title: experience.title,
    kind: experience.kind,
    ...(experience.shortDescription
      ? { blurb: experience.shortDescription }
      : {}),
    ...(experience.heroMedia?.src ? { heroUrl: experience.heroMedia.src } : {}),
    ...(placeLabel(experience) ? { place: placeLabel(experience)! } : {}),
    ...(areaLabel(experience) ? { area: areaLabel(experience)! } : {}),
    ...(whereLine(experience) ? { where: whereLine(experience)! } : {}),
    doing: (knowledge?.affordances ?? [])
      .map((a) => a.name)
      .filter((name): name is string => Boolean(name))
      .slice(0, 6),
    facts: (knowledge?.practical ?? [])
      .filter(
        (fact): fact is { label: string; value: string } =>
          typeof fact?.label === "string" && typeof fact?.value === "string",
      )
      .map((fact) => ({ label: fact.label, value: fact.value }))
      .slice(0, 6),
    ...(experience.startTime ? { startTime: experience.startTime } : {}),
    ...(experience.geography?.coordinates
      ? { coordinates: experience.geography.coordinates }
      : {}),
    ...(recurrenceLine(experience)
      ? { recurs: recurrenceLine(experience)! }
      : {}),
    ...(knowledge?.descriptionAddsKnowledge === false
      ? { weakBlurb: true }
      : {}),
    ...(experience.environment?.setting === "outdoor" ? { outdoor: true } : {}),
    ...(audienceOf(experience) ? { audience: audienceOf(experience)! } : {}),
  };
}

export interface Gallery {
  /** Subjects with a photograph Atlas vouches for, richest first. */
  readonly featured: readonly Subject[];
  /** Everything else worth showing, photograph or not. */
  readonly rest: readonly Subject[];
  /** How many Atlas holds in total, so a prototype can be honest about scale. */
  readonly total: number;
}

/**
 * How much a subject can actually carry on a page.
 *
 * Not a quality score and not a ranking the product uses — a sampling rule for
 * the sandbox, so the three directions are compared on subjects that have
 * something to show rather than on the thousand that are a name and nothing
 * else.
 */
const substance = (subject: Subject): number =>
  (subject.heroUrl ? 4 : 0) +
  (subject.blurb && subject.blurb.length > 120 ? 2 : 0) +
  Math.min(subject.doing.length, 3) +
  Math.min(subject.facts.length, 2) +
  (subject.place ? 1 : 0);

/**
 * @param depth how many photographed subjects to carry. Round one's layouts
 * show a dozen; round two's horizontal rails need enough to fill several.
 */
export async function gallery(depth = 12): Promise<Gallery> {
  const candidates = await listDiscoveryCandidates().catch(() => []);
  const subjects = candidates.map(candidateToExperience).map(subjectOf);

  const seen = new Set<string>();
  const ranked = subjects
    .filter((subject) => {
      // Atlas holds 60 names more than once; a magazine spread that ran the
      // same farm twice would be the corpus's defect wearing a serif.
      const key = subject.title.trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => substance(b) - substance(a));

  return {
    featured: ranked.filter((s) => s.heroUrl).slice(0, depth),
    rest: ranked.filter((s) => !s.heroUrl).slice(0, depth),
    total: candidates.length,
  };
}

/**
 * **Subjects grouped by what Atlas says you can do there.**
 *
 * The label is the affordance string in Atlas's own spelling — no taxonomy, no
 * merging of `Hiking` with `walking/hiking`. Used by the round-two directions
 * that let somebody explore by activity rather than by scrolling.
 */
export function byDoing(
  subjects: readonly Subject[],
  least = 2,
): readonly {
  readonly label: string;
  readonly subjects: readonly Subject[];
}[] {
  const groups = new Map<string, { label: string; subjects: Subject[] }>();
  for (const subject of subjects) {
    for (const doing of subject.doing) {
      const key = doing.toLowerCase();
      const row = groups.get(key);
      if (row) row.subjects.push(subject);
      else groups.set(key, { label: doing, subjects: [subject] });
    }
  }
  return [...groups.values()]
    .filter((group) => group.subjects.length >= least)
    .sort(
      (a, b) =>
        b.subjects.length - a.subjects.length || a.label.localeCompare(b.label),
    );
}

/** One subject by id, for the detail prototypes. */
export async function subject(id: string): Promise<Subject | undefined> {
  const candidates = await listDiscoveryCandidates().catch(() => []);
  const found = candidates.find((candidate) => candidate.id === id);
  return found ? subjectOf(candidateToExperience(found)) : undefined;
}

/**
 * **Discovery themes, populated only where Atlas actually supports them.**
 *
 * The temptation in a horizontally-scrolling design is to invent five rails
 * and fill them by repeating the same twelve photogenic parks. Each theme here
 * has a stated basis, a theme with nothing behind it is simply absent, and a
 * subject appears in **at most one** rail — so a row is never padded with
 * something the row above already showed.
 */
export interface Theme {
  readonly key: string;
  readonly title: string;
  /** What makes these belong together, in evidence terms. */
  readonly basis: string;
  readonly subjects: readonly Subject[];
}

export function themes(
  featured: readonly Subject[],
  now: Date,
  /** Already shown elsewhere on the page — a hero, usually. Never repeated. */
  taken: readonly string[] = [],
): Theme[] {
  const spoken = new Set<string>(taken);
  const take = (
    key: string,
    title: string,
    basis: string,
    matches: (subject: Subject) => boolean,
    least = 4,
  ): Theme | undefined => {
    const subjects = featured
      .filter((subject) => !spoken.has(subject.id) && matches(subject))
      // **Capped.** One broad theme matching 28 subjects would eat the page
      // and leave the specific shelves below it empty.
      .slice(0, 12);
    if (subjects.length < least) return undefined;
    for (const subject of subjects) spoken.add(subject.id);
    return { key, title, basis, subjects };
  };

  const today = now.toISOString().slice(0, 10);
  const fortnight = new Date(now.getTime() + 14 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  return [
    take(
      "soon",
      "Happening soon",
      "Atlas states a start date inside the next fortnight",
      (s) =>
        Boolean(
          s.startTime &&
          s.startTime.slice(0, 10) >= today &&
          s.startTime.slice(0, 10) <= fortnight,
        ),
      3,
    ),
    take(
      "outdoors",
      "Outdoor adventures",
      "Atlas states the setting is outdoor",
      (s) => Boolean(s.outdoor),
      3,
    ),
    take(
      "different",
      "Something different",
      "Atlas states a verb almost nothing else offers",
      (s) => s.doing.length === 1 && Boolean(s.facts.length),
      3,
    ),
    take(
      "doing",
      "Somewhere to do something",
      "Atlas states at least two things you can do there",
      (s) => s.doing.length >= 2,
    ),
    take(
      "named",
      "Worth the drive",
      "Atlas states a town for these, and a photograph it vouches for",
      (s) => Boolean(s.place && s.heroUrl),
    ),
  ].filter((theme): theme is Theme => Boolean(theme));
}
