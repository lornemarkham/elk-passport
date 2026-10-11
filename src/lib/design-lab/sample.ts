import "server-only";
import { listDiscoveryCandidates } from "@/lib/data/atlas-repo";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { Experience } from "@/domain/experience/types";
import { placeLabel, areaLabel, whereLine } from "@/domain/discovery/compose";

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

export async function gallery(): Promise<Gallery> {
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
    featured: ranked.filter((s) => s.heroUrl).slice(0, 12),
    rest: ranked.filter((s) => !s.heroUrl).slice(0, 12),
    total: candidates.length,
  };
}

/** One subject by id, for the detail prototypes. */
export async function subject(id: string): Promise<Subject | undefined> {
  const candidates = await listDiscoveryCandidates().catch(() => []);
  const found = candidates.find((candidate) => candidate.id === id);
  return found ? subjectOf(candidateToExperience(found)) : undefined;
}
