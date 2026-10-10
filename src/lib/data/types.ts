/** The wire shape of an Atlas `Place`, as returned by `GET /places` —
 * matches `atlas/src/domain/entities/Place.ts` exactly. Kept here rather
 * than importing across the repo boundary: `app/` and `atlas/` are
 * separate services, and this is the one place `app/` declares what it
 * expects Atlas's JSON to look like.
 *
 * Phase 7.0: this had drifted stale — `GET /places/:id` was already
 * returning `activities`, `facilities`, `hours`, `wheelchairAccessible`,
 * `feeRequired`, `externalIds`, and `hasActiveFireBan` over the wire
 * (Atlas's domain model gained all of these across Phase 4.1-6.1), but
 * nothing in `app/` could type or read them because this interface was
 * never updated to declare them. No Atlas-side change was needed to fix
 * this — the data was already there. */
export interface PlaceExternalId {
  system: string;
  id: string;
}

/**
 * Something a publisher stated about a place, in its own words.
 *
 * Atlas holds these on 1,202 entities and Passport rendered none of them —
 * `keyFacts` was simply absent from this type, so the field arrived in every
 * `/places/:id/detail` response and was discarded at the boundary. Kalamalka
 * Lake carries seventeen; Lake Country Bike Park eleven, including its phone
 * number and its rules.
 *
 * `label` and `value` are the publisher's. **Passport does not rewrite them**,
 * because the moment it does, the page is asserting something no source said.
 * `category` is Atlas's own grouping where a source offered one, and
 * `sourceRecordId` is which document said it.
 */
export interface PlaceKeyFact {
  label: string;
  value: string;
  category?: string;
  sourceRecordId?: string;
}

export interface Place {
  kind: "Place";
  id: string;
  name: string;
  aliases: string[];
  placeType: string;
  geometry?: {
    type: string;
    coordinates: [number, number];
  };
  address?: string;
  description: string;
  imageUrl?: string;
  hasActiveFireBan?: boolean;
  activities?: string[];
  externalIds?: PlaceExternalId[];
  facilities?: string[];
  hours?: string;
  wheelchairAccessible?: "yes" | "no" | "limited";
  feeRequired?: boolean;
  keyFacts?: PlaceKeyFact[];
}

/** Matches `atlas/src/domain/relationships/Relationship.ts` — a generic
 * (type, source, target) triple. `type` stays a plain string here too,
 * deliberately, matching Atlas's own "open string, not a closed union"
 * choice (`docs/architecture.md` §8) — a new relationship type Atlas
 * learns to discover should not require an app-side type change to
 * simply display. */
export interface PlaceRelationship {
  id: string;
  type: string;
  sourceEntityId: string;
  targetEntityId: string;
}

/** The fields `PlaceSources` actually renders — a trimmed view of Atlas's
 * real `SourceRecord`, not the full shape (which also carries
 * `rawContent`, irrelevant to a traveler and unnecessary to send over the
 * wire to one). */
export interface PlaceSource {
  id: string;
  sourceType: string;
  source: string;
  retrievedAt: string;
}

/** Just enough of a *related* Place to render "Part of {name}" as a real
 * link — not the full `Place` shape. `relationships` only carries ids
 * (matching Atlas's own generic, untyped-reference `Relationship` design),
 * so this is resolved server-side, once, in the same `/detail` request —
 * see that route's comment for why this stays one round trip instead of
 * a follow-up `getPlace()` per relationship. */
/**
 * **A destination within reach of this Place, from held geometry.** Atlas
 * derives it per read from the coordinates it holds; it is not a held `near`
 * fact and Passport never presents it as one — the caption is the measured
 * distance. `connected` says Atlas *also* holds a relationship between the two.
 */
export interface PlaceNearbyPlace {
  id: string;
  name: string;
  placeType: string;
  /** Straight-line distance in km to the metre; always present — it is the basis of the entry. */
  distanceKm: number;
  /** The destination's representative image (Atlas ADR 069), or absent. */
  imageUrl?: string;
  connected?: true;
}

export interface PlaceRelatedPlace {
  id: string;
  name: string;
  placeType: string;
  /**
   * Straight-line distance between the two Places' held points, in km to
   * the metre, computed by Atlas. Absent when either side holds no point —
   * never estimated here, and never a travel time.
   */
  distanceKm?: number;
  /**
   * The related Place's representative image (Atlas ADR 069) — one Atlas
   * holds subject evidence for — or absent. Never its raw lead-image scalar.
   */
  imageUrl?: string;
  /** Atlas holds the related Place as a Region — what this Place is *in*, not somewhere nearby to go. */
  region?: true;
  /** The related Place's name says nothing beyond its type ("Parking" of type parking). */
  nameIsOnlyItsType?: true;
}

/**
 * **An Organization Atlas asserts is located at this Place** — the inverse
 * of a `located_at` edge, read from the Place end by Atlas's detail route.
 * Atlas holds `Kalavida Surf Shop --located_at--> Kal Beach` and never the
 * reverse; this is a read, not a second edge.
 *
 * `offers` is one hop further, along the Organization's own `offers` edges
 * only. "Paddleboard" is here because Atlas holds that edge — a shop's name
 * or type never implies a service.
 */
/**
 * **An image Atlas can vouch for as the Place** (Atlas ADR 069): only media
 * with subject evidence reaches this shape, each with the evidence it stands
 * on. A page renders the Place from here, never from a scalar it cannot
 * trace.
 */
export interface PlaceMediaView {
  url: string;
  thumbnailUrl?: string;
  caption?: string;
  sourceRecordId: string;
  evidence:
    | "curator"
    | "caption-names-subject"
    | "source-subject"
    | "own-page"
    | "subject-page"
    | "section-names-subject";
  /**
   * The other held renditions of this same asset (Atlas M11.1) — one URL is
   * shown, every rendition is cited. Provenance, never rendered.
   */
  variants?: { url: string; sourceRecordId: string; evidence: string }[];
}

export interface PlaceRepresentativeMedia {
  /** The lead image, or none: a Place with nothing Atlas can vouch for leads with nothing. */
  hero?: PlaceMediaView;
  /** Every representative image, hero first, one per file. */
  gallery: PlaceMediaView[];
}

export interface PlaceLocatedHere {
  id: string;
  name: string;
  organizationType: string;
  description: string;
  address?: string;
  imageUrl?: string;
  offers: PlaceRelatedEntity[];
}

/**
 * The other end of a relationship, whatever kind of thing it turned out to be.
 *
 * `relatedPlaces` answers "which of these edges point at a Place", which left
 * every other edge as an id with nothing on the end of it. Kalamalka Lake
 * asserts seven `offers` edges to Activities and Ellison Park eight, and a
 * traveller page could either drop them or print a uuid.
 *
 * Additive: `relatedPlaces` is unchanged and still Place-only.
 */
export interface PlaceRelatedEntity {
  id: string;
  kind: "Place" | "Organization" | "Activity" | "Event";
  name: string;
  subtype?: string;
}

/**
 * **An Organization that Atlas asserts operates this Place.**
 *
 * ADR 019 says an Organization is never a Place, and Big White Ski Resort is
 * the cost of that being right: two entities, and the one a traveller opens
 * holds nothing while the other holds 47 key facts and a street address.
 * `operates` is the edge that makes them one destination without making them
 * one record.
 *
 * Passport composes a page from these. It never merges them, never writes back,
 * and never reaches an Organization by name — a shared name is a coincidence,
 * an asserted edge is evidence, and Predator Ridge has three same-named
 * Organizations to prove the difference matters.
 */
export interface PlaceOperator {
  id: string;
  name: string;
  organizationType: string;
  address?: string;
  hours?: string;
  keyFacts: PlaceKeyFact[];
  /** Activities the *operator* offers, resolved by Atlas along its own edges. */
  offers: PlaceRelatedEntity[];
}

/**
 * **An Event Atlas asserts happens at this Place — or at its operator.**
 *
 * Atlas held 174 Events and Passport rendered none: the ones pointing straight
 * at a Place arrived as a name with no date, and the ones pointing at the
 * venue's operator (Davison Orchards' harvest festival hangs off the
 * Organization, as the publisher states it) never arrived at all. `via` names
 * the operator when the event was reached across an `operates` edge Atlas
 * asserted — never by a shared name.
 *
 * Times are ISO strings from the publisher's stated dates. Whether a festival
 * that ended last month belongs on the page is Passport's decision, made in
 * `PlaceEvents`; that it happened here is Atlas's fact.
 */
export interface PlaceEvent {
  id: string;
  name: string;
  eventType?: string;
  startTime?: string;
  endTime?: string;
  description: string;
  via?: { id: string; name: string };
}

/** The Place Detail page's one real request — `GET /places/:id/detail`.
 * See that route's own comment in `atlas/src/api/server.ts` for why this
 * is a purpose-built composite, not a change to the canonical `Place`
 * shape above. */
export interface PlaceDetail {
  place: Place;
  relationships: PlaceRelationship[];
  sources: PlaceSource[];
  relatedPlaces: PlaceRelatedPlace[];
  /** Optional so a response from an Atlas that predates the field still parses. */
  relatedEntities?: PlaceRelatedEntity[];
  /** Same reason. An Atlas without the venue seam simply sends none. */
  operatedBy?: PlaceOperator[];
  /** Same reason again. */
  events?: PlaceEvent[];
  /** Organizations located at this Place, read from the target end of `located_at`. Absent from an older Atlas. */
  locatedHere?: PlaceLocatedHere[];
  /**
   * Destinations within reach, derived by Atlas from held geometry at read
   * time (Atlas ADR 068) — never a stored relationship, never written back.
   * Absent from an older Atlas.
   */
  nearby?: PlaceNearbyPlace[];
  /** The images Atlas can vouch for as this Place. Absent from an older Atlas. */
  media?: PlaceRepresentativeMedia;
  /**
   * Temporal validity (Atlas ADR 072). Atlas has already withheld from
   * `place` every time-bound claim that is not current; this says, per
   * field it kept, the date the value is shown *as of*. Passport renders
   * that date and infers nothing about currency itself. Absent from an
   * older Atlas.
   */
  temporal?: PlaceTemporal;
  /** Practical knowledge composed by Atlas. Absent from an Atlas that predates it. */
  practical?: PlacePractical;
}

/**
 * **The practical questions, composed by Atlas** — is it open, does it cost,
 * where do I park, are there toilets, can the dog come, is it accessible,
 * what's closed or unsafe right now. Served on `/places/:id/detail` as
 * `practical`, composed in `atlas/src/application/readmodel/practicalKnowledge.ts`
 * from the same record the rest of the page reads.
 *
 * Passport renders this and decides nothing about it: which label means
 * parking, which sentence is a duplicate, which fact restates the hours
 * string, is Atlas's call, made once, in one place. `groups` render only
 * when Atlas holds a statement for them — no group is ever a placeholder —
 * and `other` is every fact no group claimed, under the publisher's own
 * label, so nothing is lost for not fitting.
 */
export interface PlacePracticalItem {
  /** The publisher's label, present only when it says more than the group does. */
  label?: string;
  /** Verbatim. Passport never rewrites it. */
  text: string;
  /** ISO observation time for a current, time-bound statement (Atlas ADR 072). */
  asOf?: string;
  sourceRecordId?: string;
  /**
   * Every source record that states this item — the shown one and each whose
   * fact Atlas deduplicated or folded into it (M9). Provenance, not UI: never
   * rendered. Absent from an Atlas that predates it.
   */
  evidence?: string[];
  /** The operator that stated it, when Atlas reached it across an `operates` edge. */
  via?: { id: string; name: string };
}

export type PlacePracticalGroupKey =
  | "hours"
  | "fees"
  | "getting-there"
  | "facilities"
  | "accessibility"
  | "dogs"
  | "rules"
  | "safety"
  | "contact";

export interface PlacePracticalGroup {
  key: PlacePracticalGroupKey;
  title: string;
  /** The typed facilities list, unchanged — only on `facilities`. */
  chips?: string[];
  items: PlacePracticalItem[];
}

export interface PlacePractical {
  version: number;
  groups: PlacePracticalGroup[];
  other: { category?: string; items: PlacePracticalItem[] }[];
  /** What Atlas left out and why. Not rendered; kept so the omission is checkable. */
  omitted: {
    label: string;
    reason: string;
    sourceRecordId?: string;
    /** The text of the visible item this one was deduplicated or folded into. */
    foldedInto?: string;
    via?: { id: string; name: string };
  }[];
}

export interface PlaceTemporal {
  policyVersion: number;
  /** Field name → ISO observation time its current value is shown as of. */
  asOf: Record<string, string>;
  claims: PlaceTemporalClaim[];
  withheld: number;
}

export interface PlaceTemporalClaim {
  field: string;
  label?: string;
  value: string;
  class:
    | "timeless"
    | "current-state"
    | "explicit-interval"
    | "schedule"
    | "effective-until-changed";
  observedAt?: string;
  validFrom?: string;
  validUntil?: string;
  current: boolean;
  asOf?: string;
  reason: string;
}

/**
 * One thing Atlas thinks Discover may consider, with one hop of world context.
 *
 * Served by Atlas `GET /discovery/candidates`, derived there from entities and
 * `contains` edges — see `application/discovery/DiscoveryCandidates.ts`. Nothing
 * here is persisted, and Passport must not add to it: a candidate is a question
 * Discover asks of Atlas, not a fact Atlas stores.
 */
export interface DiscoveryCandidateContext {
  id: string;
  kind: "Place" | "Organization" | "Activity" | "Event" | "Experience";
  name: string;
}

/**
 * **When Atlas can say a candidate is on, and on what evidence**
 * (Atlas `candidateAvailability.ts`). Absent from an older Atlas.
 *
 * Four bases, deliberately kept apart, because the difference is the product:
 *
 * ```
 * event-interval   an Event's own stated instants — `startTime`/`endTime` below
 * stated-days      days a source names: discrete dates, or a weekday pattern
 *                  inside a dated window, already expanded by Atlas
 * weekly-pattern   weekdays and times and no day at all — a page that prints
 *                  "7pm nightly, Tuesdays to Fridays" and never prints a year
 * unstated         Atlas holds nothing about when this is on
 * ```
 *
 * `unstated` and `weekly-pattern` are **not** "closed", and a surface that
 * hides them on that basis is asserting something Atlas did not say.
 */
export interface CandidateAvailability {
  basis: "event-interval" | "stated-days" | "weekly-pattern" | "unstated";
  /** Calendar days, `YYYY-MM-DD`, with no timezone — which is what they are in the evidence. */
  days?: string[];
  /** ISO weekdays, Monday 1. */
  weekdays?: number[];
  /** Start times the publisher printed, `HH:MM`. */
  timesOfDay?: string[];
  /** What Atlas's reading could not carry over — e.g. that the page states no year. */
  unresolved?: string;
  /** Atlas cut the day list at its horizon rather than exhausting it. */
  moreDays?: true;
}

export interface DiscoveryCandidate {
  id: string;
  /** `Experience` arrived with ADR 054 and Atlas has served it since 2026-09-23. */
  kind: "Place" | "Organization" | "Activity" | "Event" | "Experience";
  name: string;
  /** The other names Atlas holds for the same thing; search matches them as names (M10). Absent from an older Atlas. */
  aliases?: string[];
  subtype?: string;
  description: string;
  heroUrl?: string;
  mediaCount: number;
  coordinates?: [number, number];
  /** Physical containment only. Region membership is deliberately kept out of this. */
  context?: DiscoveryCandidateContext;
  /**
   * **The thing Atlas asserts this is a part of** — the source of an `includes`
   * edge, one hop, and only ever a candidate Discovery also offers. Kept apart
   * from `context`, which is physical containment: being inside a park and
   * being one of the ways to experience an attraction are different facts.
   * Absent from an older Atlas.
   */
  partOf?: DiscoveryCandidateContext;
  containsCount: number;
  regionIds: string[];
  /** Events only. ISO 8601 UTC, exactly as Atlas stores the instant. */
  startTime?: string;
  endTime?: string;
  /**
   * **Whether the publisher stated a clock time or only a calendar date**
   * (Atlas `Event.timePrecision`). Absent from an older Atlas, and absent on a
   * record Atlas read before the field existed — which is a third answer, not
   * `"day"`. See `statedDay` for what Passport does with each.
   */
  timePrecision?: "day" | "minute";
  /** What Atlas knows about when this is on. Absent from an older Atlas. */
  availability?: CandidateAvailability;
  /**
   * **Where this happens**, when Atlas can say so without guessing — an
   * asserted `happens_at` to a held Place, or a source's own stated venue.
   * Absent means Atlas does not know, which is the answer for most of the
   * corpus. Passport must render nothing rather than fill it in.
   */
  location?: CandidateLocation;
  /**
   * **Where Atlas says this is, and how sure it is** — `candidate-geography/2`,
   * announced on the response's `grounding.geography`.
   *
   * This is the field that closes Discovery's worst trust failure. Before it,
   * `Canyon Frights` led *Happening today* with nothing to say it was at
   * Capilano Suspension Bridge Park, 273 km away in North Vancouver, while
   * Okanagan cards beside it said "· Kelowna" — so a bare card read as local
   * by omission.
   *
   * **Passport never computes any of this.** Not from a name, not from a venue
   * string, not by reverse-geocoding a coordinate. Where the state is
   * `unknown` the card says nothing; where it is `conflicting` the card says
   * that Atlas disagrees with itself rather than picking a side.
   */
  geography?: CandidateGeography;
}

/** How a geographic claim was arrived at. Carried so Passport never has to guess. */
export type GeographyBasis = "observed" | "derived";

/**
 * **Atlas's four answers to "where is this?"** (`candidate-geography/2`).
 *
 * ```
 * observed     the entity's own evidence states it
 * derived      inherited one deterministic hop through a happens_at venue
 * conflicting  the evidence disagrees, and Atlas refuses to pick a winner
 * unknown      Atlas does not know — Passport must not fill it in
 * ```
 *
 * Measured on the live corpus 2026-10-11: unknown 1,813 · observed 763 ·
 * derived 104 · conflicting 3.
 */
export type GeographyState = "observed" | "derived" | "conflicting" | "unknown";

/** A named area Atlas asserts, e.g. `Okanagan`, `Metro Vancouver`. */
export interface CandidateArea {
  id: string;
  name: string;
}

/** The hop a `derived` claim travelled, so provenance survives into Passport. */
export interface GeographyVia {
  id: string;
  kind: string;
  name: string;
  relation: string;
}

export interface CandidateGeography {
  state: GeographyState;
  /** The town. Absent for `unknown`, and for a `conflicting` claim Atlas will not resolve. */
  locality?: string;
  localityBasis?: GeographyBasis;
  coordinates?: [number, number];
  coordinatesBasis?: GeographyBasis;
  /** The broader area — the one field that distinguishes Okanagan from Metro Vancouver. */
  area?: CandidateArea;
  /** Every locality the evidence named, where it named more than one. */
  localities?: string[];
  /** The venue a `derived` claim came through. */
  via?: GeographyVia[];
  /** Atlas's own words about what disagrees, for a `conflicting` claim. */
  conflict?: string;
  /** The records behind the claim. Read by nothing in the product UI. */
  evidence?: unknown[];
}

/** Atlas's smallest truthful answer to "where?" (`candidateLocation.ts`). */
export interface CandidateLocation {
  /** Present only when an asserted edge reaches a Place Atlas holds. */
  placeId?: string;
  /** The venue, held or as a source stated it. */
  name?: string;
  /** The town, where a source stated one. */
  locality?: string;
  /** `happens-at` was asserted by somebody; `stated-venue` was only read. */
  basis: "happens-at" | "stated-venue";
}

/**
 * **A subject and the knowledge that lives one and two hops away from it**
 * — `GET /organizations/:id/detail`, `GET /experiences/:id/detail`
 * (Atlas `subjectComposition.ts`, commit 2846f50).
 *
 * Atlas walks the asserted edges — `offers`, `includes`, `hosts` — two hops
 * and no further, and hands back each subject with **its own** key facts,
 * **its own** temporal claims and its own ADR 072 observation state. Passport
 * reads this and reconstructs nothing: no relationship tables, no uuid joins,
 * no admin token, and no second implementation of `claimCoversDay`.
 *
 * Every field below is optional-tolerant in the same way `PlaceDetail` is: an
 * older Atlas simply sends less.
 */
export interface SubjectKeyFact {
  label: string;
  value: string;
  category?: string;
  sourceRecordId: string;
  confidence?: number;
  asOf?: string;
}

/** Per time-bound fact: what class it is, when Atlas last saw it, and whether anyone decided it is still true. */
export interface SubjectTemporalClaimState {
  field: string;
  label?: string;
  value: string;
  class: string;
  observedAt?: string;
  validFrom?: string;
  validUntil?: string;
  /** Absent where Atlas does not decide currency for the kind — an Experience. Never read as `false`. */
  current?: boolean;
  currency: string;
  asOf?: string;
  reason: string;
}

export interface SubjectTemporalView {
  policyVersion: number;
  claims: SubjectTemporalClaimState[];
  asOf: Record<string, string>;
  withheld: number;
}

/** A stored temporal claim, as evidence. Atlas computed the days; Passport never does. */
export interface SubjectClaim {
  id: string;
  shape: string;
  intervals: { startsOn: string; endsOn: string }[];
  weekdays: number[];
  excludes: string[];
  timesOfDay: string[];
  editionLabel?: string;
  /** What the reading could not carry over from the passage. Shown, never hidden. */
  unresolved?: string;
  supportingPassage: string;
  sourceRecordId: string;
  publishedAt?: string;
  observedAt: string;
  /** Only when a day was asked about. */
  statesRequestedDay?: boolean;
}

/**
 * Atlas's answer to *does a claim Atlas holds state this day?* — and nothing
 * more. `stated: false` is **not** a closure, and `meaning` says so in the
 * payload; Passport renders that sentence rather than inventing one.
 */
export interface SubjectDayStatement {
  day: string;
  stated: boolean;
  byClaims: string[];
  meaning: string;
}

export interface SubjectEdge {
  verb: string;
  direction: "outgoing" | "incoming";
  subject: ComposedSubject;
}

export interface ComposedSubject {
  /** The one image Atlas chose to show as this subject, where the media lane chose one. */
  imageUrl?: string;
  id: string;
  kind: string;
  name: string;
  subtype?: string;
  description: string;
  address?: string;
  coordinates?: [number, number];
  /** An Event's own interval, and how precisely the source stated it. */
  startTime?: string;
  endTime?: string;
  timePrecision?: string;
  keyFacts: SubjectKeyFact[];
  temporal: SubjectTemporalView;
  when: SubjectClaim[];
  on?: SubjectDayStatement;
  related: SubjectEdge[];
  depth: number;
}

export interface SubjectSource {
  /** Set when Atlas says this record describes the composed subject itself. */
  describesSubject?: true;
  id: string;
  url: string;
  sourceType?: string;
  retrievedAt?: string;
}

export interface SubjectComposition {
  root: ComposedSubject;
  sources: SubjectSource[];
  verbs: string[];
  maxDepth: number;
  on?: string;
}
