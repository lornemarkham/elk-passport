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
export interface PlaceRelatedPlace {
  id: string;
  name: string;
  placeType: string;
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
