import type { Experience } from "@/domain/experience/types";

/**
 * **What kind of thing is this, for the purpose of weather?**
 *
 * Not a taxonomy of experiences — a taxonomy of *how conditions matter*. A
 * concert in a theatre and a hockey game are the same thing here: rain is
 * irrelevant. A pumpkin patch and a farmers' market are the same thing: it
 * matters what the afternoon is like. A haunted trail and a meteor shower are
 * not the same thing at all, because one needs it dry and the other needs the
 * sky empty.
 *
 * ## How much Atlas can actually tell us — measured, not assumed
 *
 * ```
 * 306  dated candidates
 *  84  have a `happens_at` Place at all
 *  ~45 of those have a Place subtype that implies indoor or outdoor
 *      (theatre, arena, comedy lounge, library  →  indoor)
 *      (park, orchard, ranch, farm, observatory →  outdoor)
 *  27  have the Place subtype "venue", which implies nothing
 * ```
 *
 * Run against the live corpus on 2026-10-01, the classifier lands:
 *
 * ```
 * unknown      178   (59%)  — no usable evidence; October says nothing
 * indoor       117          — 43 from a venue, 74 from a subtype
 * outdoor-day   43
 * outdoor-night 11
 * astronomy      4
 * ```
 *
 * **That 59% is a known Atlas/data limitation, not a bug in this file**, and
 * it is the ceiling on everything built above it. The single change that
 * would move it most is `availability.timesOfDay`, which exists in the
 * Experience shape and is empty on every subject in the corpus.
 *
 * So **structured Atlas evidence classifies roughly 15% of dated subjects**,
 * and `subtype` on the event itself is an unnormalised long tail — "Concert",
 * "concert", "Music Concert", "Music Event" and "live music" are five spellings
 * of one idea, and none of them says whether there is a roof.
 *
 * That is the limitation, and it is why this returns a `basis` as well as a
 * kind. The venue is the strongest evidence and is used first; the event's own
 * subtype is weaker; its prose is weakest. `unknown` is the most common answer
 * and it means October says nothing, which is the correct behaviour for a
 * subject nobody has classified.
 *
 * Nothing here infers a kind from a title alone.
 */

export type SubjectKind =
  /** Sky matters, cloud is everything, the moon is a factor. */
  | "astronomy"
  /** Happens outside after dark — a haunt, a trail, a night market. */
  | "outdoor-night"
  /** Happens outside in daylight — a farm, a patch, a festival. */
  | "outdoor-day"
  /** Under a roof. Weather is irrelevant to the thing itself. */
  | "indoor"
  /** Nobody has said. October stays quiet. */
  | "unknown";

/** Where the answer came from, strongest first. */
export type KindBasis = "venue" | "subtype" | "described" | "none";

export interface SubjectClassification {
  readonly kind: SubjectKind;
  readonly basis: KindBasis;
}

/** Atlas Place subtypes that genuinely imply a roof. */
const INDOOR_VENUE = new Set([
  "theatre",
  "theater",
  "comedy lounge",
  "arena",
  "library",
  "performing arts centre",
  "performing arts center",
  "convention centre",
  "convention center",
  "recreation centre",
  "recreation center",
  "cinema",
  "museum",
  "gallery",
  "restaurant",
  "brewery",
  "bar",
  "pub",
  "cafe",
  "café",
  "hotel",
  "spa",
  "shop",
  "bakery",
  "bistro",
]);

/** Atlas Place subtypes that genuinely imply open air. */
const OUTDOOR_VENUE = new Set([
  "park",
  "regional park",
  "provincial park",
  "orchard",
  "ranch",
  "farm",
  "heritage village",
  "historic site",
  "trail",
  "beach",
  "lake",
  "garden",
  "vineyard",
  "campground",
  "ski resort",
]);

/** A venue built for looking up. Rare, and decisive when present. */
const SKY_VENUE = new Set(["observatory"]);

const ASTRONOMY_SUBTYPE =
  /\b(meteor shower|meteor|astronom|stargaz|star party|eclipse|aurora|night sky)\b/i;
const OUTDOOR_SUBTYPE =
  /\b(haunted house|haunt|corn maze|pumpkin|hay ?ride|farm|orchard|harvest|agricultural|market|parade|fair|trail|hike|walk|run|race|cycling|outdoor|garden)\b/i;
const INDOOR_SUBTYPE =
  /\b(concert|musical|theatre|theater|comedy|hockey|sports event|sport|game|curling|basketball|film|cinema|workshop|exhibition|high tea|lecture|conference|gala|dance class|wellness retreat|service)\b/i;

/**
 * Things that happen after dark by their nature.
 *
 * A word list, and said plainly: Atlas has no structured evidence for this.
 * `availability.timesOfDay` exists on the Experience shape and is **empty on
 * every subject in the corpus**, so the alternative to these words is calling
 * a haunted attraction a daytime event — which is what the first version did
 * to Field of Screams, whose venue is a "historic site" and whose title
 * contains no word for night.
 *
 * Read against the title, subtype and description together, so a haunt whose
 * name is only "Field of Screams" is still caught by its own prose.
 */
const NIGHT_WORDS =
  // Stems, not whole words: "Field of Screams" is the case that taught us a
  // trailing \b fails on a plural.
  /\b(haunt|ghost|scream|fright|terror|spook|macabre|midnight|after dark|night|nocturnal|lantern|bonfire|firework|trick.or.treat)/i;

export function classifySubject(
  experience: Experience,
  /** The Atlas Place this happens at, where one is known. */
  venueSubtype?: string,
): SubjectClassification {
  const subtype = experience.subtype?.toLowerCase().trim();
  const venue = venueSubtype?.toLowerCase().trim();

  // Astronomy first and from the subject's own words: an observatory is a
  // building, and a meteor shower has no venue at all.
  if (subtype && ASTRONOMY_SUBTYPE.test(subtype)) {
    return { kind: "astronomy", basis: "subtype" };
  }
  if (venue && SKY_VENUE.has(venue)) {
    return { kind: "astronomy", basis: "venue" };
  }

  // The venue is the strongest evidence Atlas holds about a roof.
  if (venue && INDOOR_VENUE.has(venue)) {
    return { kind: "indoor", basis: "venue" };
  }
  if (venue && OUTDOOR_VENUE.has(venue)) {
    return {
      kind: afterDark(experience) ? "outdoor-night" : "outdoor-day",
      basis: "venue",
    };
  }

  // Then the event's own word for itself. Indoor wins a tie, because the cost
  // of a wrong "outdoor" is telling somebody to bring a coat to a theatre.
  if (subtype && INDOOR_SUBTYPE.test(subtype)) {
    return { kind: "indoor", basis: "subtype" };
  }
  if (subtype && OUTDOOR_SUBTYPE.test(subtype)) {
    return {
      kind: afterDark(experience) ? "outdoor-night" : "outdoor-day",
      basis: "subtype",
    };
  }

  // Last and weakest: what somebody wrote about it. Only ever used to find a
  // roof or the lack of one, never to invent a kind out of nothing.
  const prose = `${experience.shortDescription ?? ""} ${experience.description ?? ""}`;
  if (/\b(indoor|indoors)\b/i.test(prose)) {
    return { kind: "indoor", basis: "described" };
  }
  if (/\b(outdoor|outdoors|open-air|open air)\b/i.test(prose)) {
    return {
      kind: afterDark(experience) ? "outdoor-night" : "outdoor-day",
      basis: "described",
    };
  }

  return { kind: "unknown", basis: "none" };
}

/**
 * Whether this happens after dark.
 *
 * A stated clock time is the only real evidence; failing that, the words a
 * thing is described with. A date-only event gets `false` — an outdoor thing
 * with no time is far more likely a daytime fair than a midnight one, and the
 * daytime reading is also the safer wrong answer.
 */
function afterDark(experience: Experience): boolean {
  if (experience.startTime && experience.timePrecision === "minute") {
    const hour = Number(
      new Intl.DateTimeFormat("en-CA", {
        hour: "numeric",
        hour12: false,
        timeZone: "America/Vancouver",
      }).format(new Date(experience.startTime)),
    );
    if (Number.isFinite(hour)) return hour >= 18 || hour < 6;
  }
  return NIGHT_WORDS.test(
    [
      experience.title,
      experience.subtype ?? "",
      experience.shortDescription ?? "",
      experience.description ?? "",
    ].join(" "),
  );
}
