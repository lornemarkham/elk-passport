import { PlaceShouldICome } from "./PlaceShouldICome";
import { PlaceFirstThing } from "./PlaceFirstThing";
import { PlaceDontMiss } from "./PlaceDontMiss";
import { PlaceWhatToBring } from "./PlaceWhatToBring";
import { PlaceAfterwards } from "./PlaceAfterwards";
import { PlaceOverview } from "./PlaceOverview";
import { PlaceGallery } from "./PlaceGallery";
import { PlaceQuickFacts } from "./PlaceQuickFacts";
// `PlaceActivities` is intentionally still imported-free here — see the
// note in PLACE_SECTIONS below for why it no longer renders.
import { PlacePractical } from "./PlacePractical";
import { PlaceKeepExploring } from "./PlaceKeepExploring";
import { PlaceMap } from "./PlaceMap";
import { PlaceSources } from "./PlaceSources";
import { PlaceOffers } from "./PlaceOffers";
import { PlaceEvents } from "./PlaceEvents";
import { PlaceAtThisPlace } from "./PlaceAtThisPlace";
import type { PlaceSectionDef } from "./types";

/**
 * The whole extensibility mechanism this page has. A future Atlas
 * capability becomes a new component implementing the same shape as
 * everything else here, and one new line in this array. Nothing about
 * `page.tsx`, nothing about any *other* section, and nothing about how
 * sections decide to hide themselves needs to change.
 *
 * Phase 7.5 — "Build the first true Passport experience page": reordered
 * decision-first, not data-first. Every traveler question this page
 * exists to answer now leads — Should I Come?, What Do I Do First?, What
 * Shouldn't I Miss?, What Should I Bring?, What Should I Do Afterwards? —
 * built entirely by reorganizing and reframing existing Atlas knowledge
 * (see each component's own doc comment for exactly which real field it
 * reads). Every factual section that existed before this phase is still
 * here, unchanged, just repositioned lower: facts support the decisions
 * above, they aren't the experience themselves.
 *
 * Two of the five new sections are not new computations — `PlaceFirstThing`
 * and `PlaceAfterwards` each show one category of the exact same
 * `groupRelatedPlaces` result `PlaceKeepExploring` already computed (Phase
 * 8.1's Before/During/After grouping, extracted to `relatedPlaceGrouping.ts`
 * this phase so there's one computation, not three). `PlaceKeepExploring`
 * still shows all of it — the complete exploration list, for a reader who
 * wants more than the curated top-of-page answer.
 *
 * **Milestone 0, 2026-08-12 — two sections removed, not reworded:**
 * `PlacePerfectDay` and `PlaceComeHereIf` are gone, and their components
 * deleted. "A Perfect Day" rendered a five-step itinerary identical on
 * every entity in the corpus plus a line narrating Atlas's uncertainty to
 * a traveler; "Come Here If..." padded itself with a static
 * `["Nature", "Fresh Air", ...]` list whenever real evidence ran short,
 * and what remained after removing that padding was the same
 * `place.activities` list "Perfect For" (`PlaceActivities`) already
 * renders directly below. The earlier note here argued the two were
 * "two distinct answers to two distinct questions" — true of the design,
 * but not of the implementation: both read one field, so on a thin entity
 * they printed the same answer twice. See
 * `project-management/big-white-page-gap-analysis.md` and the Quality
 * Standard §9a ("A section is an answer to a traveler's question, not a
 * container for a field").
 *
 * Phase 7.6 — "Make Passport Feel Like a Great Travel Companion," and a
 * deliberate reversal of one Phase 7.5 decision: the five sections above
 * no longer always render with a placeholder when Atlas doesn't know
 * enough. Explicit product direction: a traveler-facing page never
 * exposes Atlas's uncertainty ("Atlas doesn't yet know enough..." reads
 * as an apology, not a recommendation). Each of the five now returns
 * `null` — the same "hide, don't explain why" rule every factual section
 * below has always followed — the moment it doesn't have real evidence.
 * A missing recommendation is communicated by *absence*, not by text
 * admitting the gap; that distinction is what makes this not a
 * contradiction of "clearly marked placeholders, never invented facts" —
 * the placeholder was the marking mechanism in Phase 7.5, absence is the
 * marking mechanism now.
 *
 * Also Phase 7.6: none of the five decision-first sections use the plain
 * `SectionShell` heading-and-divider pattern anymore — each has its own
 * bespoke visual identity (a feature block, a timeline, a featured image,
 * a chip tray, a horizontal-scroll row — see each component's own doc
 * comment), deliberately varied so the page has visual rhythm instead of
 * reading like a repeated documentation template. `SectionShell` is still
 * exactly right for the factual sections below, which are meant to read
 * like reference material, not a performance.
 */
export const PLACE_SECTIONS: readonly PlaceSectionDef[] = [
  // The decision-first experience — every traveler question this page exists to answer.
  { key: "should-i-come", Component: PlaceShouldICome },
  { key: "first-thing", Component: PlaceFirstThing },
  { key: "dont-miss", Component: PlaceDontMiss },
  { key: "what-to-bring", Component: PlaceWhatToBring },
  { key: "afterwards", Component: PlaceAfterwards },

  // Facts support the decisions above — repositioned lower, not removed.
  { key: "overview", Component: PlaceOverview },
  // What it actually looks like — every image Atlas can vouch for beyond the
  // hero (M1; `galleryImages`). Directly after the prose, because a traveller
  // reading "is this for me" wants to see it before the reference material.
  { key: "gallery", Component: PlaceGallery },
  { key: "quick-facts", Component: PlaceQuickFacts },
  // "Perfect For" (`PlaceActivities`) removed from the page in Milestone 0
  // for the same reason as "Come Here If...": it renders `place.activities`
  // as chips, which `PlaceDontMiss` already renders above with a real
  // editorial framing. Three sections printing one two-item field was the
  // single most visible symptom on the benchmark page. The component is
  // kept — not deleted — because it is the honest, generic presentation of
  // that field and is the natural thing to restore if "Don't leave
  // without..." is ever driven by real highlight-level evidence instead.
  // Atlas's own `offers` edges: things it asserts you can do here, each one a
  // separate entity rather than a word on this record. Above the typed fields
  // because "what can I do here" outranks "does it have toilets".
  {
    key: "offers",
    Component: ({ place, relationships, relatedEntities, operatedBy }) => (
      <PlaceOffers
        placeId={place.id}
        relationships={[...relationships]}
        relatedEntities={relatedEntities ? [...relatedEntities] : undefined}
        operatedBy={operatedBy}
      />
    ),
  },
  // What Atlas asserts is located here — an Organization at the source end of
  // a `located_at` edge pointing at this Place (ADR 067), read by Atlas from
  // the Place end. Next to "what can I do here" because it is the same
  // question asked of the people here rather than the ground.
  { key: "at-this-place", Component: PlaceAtThisPlace },
  // What Atlas asserts is happening here, with dates — before the typed fields
  // because "is anything on this weekend" is a decision, not a reference.
  { key: "events", Component: PlaceEvents },
  // The practical questions — open, cost, parking, toilets, dogs, access,
  // rules, notices — composed by Atlas (`practical` on the detail read) and
  // laid out one question per row. M7 (2026-09-21): this one section
  // replaced Facilities, Accessibility, Hours, Fees and the key-fact list,
  // which had grown into two sections both titled "Good to know", the same
  // facilities chips twice, and a flat list a reader had to scan to find
  // the toilet. Nothing those sections showed is gone: what no question
  // claims still renders under "More details", label and grouping intact.
  { key: "practical", Component: PlacePractical },
  { key: "keep-exploring", Component: PlaceKeepExploring },
  { key: "map", Component: PlaceMap },
  { key: "sources", Component: PlaceSources },
];
