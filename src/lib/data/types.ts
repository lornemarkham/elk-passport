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
    | "subject-page";
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
  kind: "Place" | "Organization" | "Activity" | "Event";
  name: string;
}

export interface DiscoveryCandidate {
  id: string;
  kind: "Place" | "Organization" | "Activity" | "Event";
  name: string;
  subtype?: string;
  description: string;
  heroUrl?: string;
  mediaCount: number;
  coordinates?: [number, number];
  /** Physical containment only. Region membership is deliberately kept out of this. */
  context?: DiscoveryCandidateContext;
  containsCount: number;
  regionIds: string[];
  /** Events only. ISO 8601 UTC, exactly as Atlas stores the instant. */
  startTime?: string;
  endTime?: string;
}
