import type {
  Place,
  PlaceEvent,
  PlaceLocatedHere,
  PlaceOperator,
  PlaceRelatedEntity,
  PlaceRelatedPlace,
  PlaceRelationship,
  PlaceSource,
} from "@/lib/data/types";

/**
 * The one prop shape every Place Detail section receives — the full
 * composite `GET /places/:id/detail` response, undestructured, plus one
 * page-level addition (`relatedPlaceDetails`, below). Every section
 * decides for itself what it needs and whether it has anything to show;
 * nothing here tells a section what to render, so adding a new section
 * never means widening this type or touching an existing one.
 */
export interface PlaceSectionProps {
  readonly place: Place;
  readonly relationships: readonly PlaceRelationship[];
  readonly sources: readonly PlaceSource[];
  readonly relatedPlaces: readonly PlaceRelatedPlace[];
  /**
   * Every related entity, whatever its kind — so an `offers` edge to an
   * Activity resolves to a name instead of being dropped. Optional because an
   * Atlas predating the field simply returns nothing here, and a section that
   * needs it renders nothing rather than failing.
   */
  readonly relatedEntities?: readonly PlaceRelatedEntity[];
  /**
   * Organizations Atlas asserts operate this Place. Sections compose from
   * these and attribute what they show; nothing is presented as though the
   * Place itself stated it.
   */
  readonly operatedBy?: readonly PlaceOperator[];
  /** What Atlas asserts happens here, or at the operator. See `PlaceEvent`. */
  readonly events?: readonly PlaceEvent[];
  /**
   * Organizations Atlas asserts are located at this Place — `located_at`
   * read from its target end. Optional for the same reason as the rest: an
   * Atlas predating the field sends none, and the section renders nothing.
   */
  readonly locatedHere?: readonly PlaceLocatedHere[];
  /**
   * Phase 7.2 — "Keep Exploring" needs an image, description, and place
   * type for each related place to build real destination cards, which
   * `relatedPlaces` (id/name/placeType only, resolved inside Atlas's own
   * `/places/:id/detail` route) doesn't carry. Rather than changing that
   * Atlas route — out of scope for this phase, and it would mean every
   * consumer of `/detail` pays for full related-entity payloads whether
   * they need them or not — `page.tsx` resolves them from the *existing*,
   * already-public place index and passes the result down here. No Atlas
   * change, no new backend field — just using more of what Atlas already
   * exposes.
   *
   * It resolves them with a single `listPlaces()` indexed by id, not with
   * one `getPlace(id)` per related place. That fan-out was quadratic and
   * failed in production; `page.tsx` carries the measurements and the
   * reasoning.
   */
  readonly relatedPlaceDetails: readonly Place[];
}

/**
 * A registry entry, not a hardcoded slot in the page. `key` is React's
 * list key, nothing more — sections carry no other page-level metadata
 * (no separate `isPresent` predicate, no title passed in from outside):
 * each component decides internally whether it has anything to show and
 * returns `null` if not (see `PLACE_SECTIONS` in `sections.tsx` for why
 * this is the whole extensibility mechanism this page has).
 */
export interface PlaceSectionDef {
  readonly key: string;
  readonly Component: (props: PlaceSectionProps) => React.ReactNode;
}
