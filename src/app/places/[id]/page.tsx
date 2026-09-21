import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPlaceDetail, listPlaces } from "@/lib/data/atlas-repo";
import type { Place } from "@/lib/data/types";
import { PlaceHero } from "@/components/place-detail/PlaceHero";
import { PlaceFireBanNotice } from "@/components/place-detail/PlaceFireBanNotice";
import { PLACE_SECTIONS } from "@/components/place-detail/sections";

type PlacePageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: PlacePageProps): Promise<Metadata> {
  const { id } = await params;
  const detail = await getPlaceDetail(id);
  if (!detail) return { title: "Place not found" };
  return {
    title: `${detail.place.name} — Passport`,
    description: detail.place.description || undefined,
  };
}

/**
 * Phase 7.0 — Atlas's first traveler-facing surface. Discovery answers
 * "where should I go?"; this page answers "tell me everything Atlas
 * knows about this place." Server component: one request
 * (`getPlaceDetail`) gets everything needed to render the whole page,
 * fetched server-side for real content-page performance and
 * shareability, with exactly one client island (`SaveButton`, inside
 * `PlaceHero`) for the one thing that genuinely needs interactivity.
 *
 * The page itself has almost no opinion about what's on it — it fetches,
 * checks for `null` (a real 404, or an archived entity — both correctly
 * absent from a traveler-facing page), and renders the Hero, the one
 * live-condition alert, and then every section in `PLACE_SECTIONS` in
 * order. Every section decides for itself whether Atlas knows enough to
 * show anything at all. That's deliberate: growing this page to cover a
 * new Atlas capability should never mean touching this file.
 *
 * Phase 7.2: no longer strictly "one request" — "Keep Exploring" needs
 * each related place's full record (image, description, type) to build
 * real destination cards, not just the id/name `/detail` already
 * resolves. Fetched here, in parallel, still entirely server-side (see
 * `PlaceSectionProps.relatedPlaceDetails`'s own comment for why this
 * doesn't touch Atlas) — a real, honest tradeoff, not a silent one.
 */
export default async function PlacePage({ params }: PlacePageProps) {
  const { id } = await params;
  const detail = await getPlaceDetail(id);

  if (!detail) {
    notFound();
  }

  const {
    place,
    relationships,
    sources,
    relatedPlaces,
    relatedEntities,
    operatedBy,
    events,
    locatedHere,
    media,
    temporal,
    nearby,
  } = detail;

  // One request for every related place, not one request each.
  //
  // This used to be `Promise.all(relatedPlaces.map(rp => getPlace(rp.id)))`,
  // which looked like a harmless fan-out and was quadratic: Atlas answers
  // `GET /places/:id` by reading the *whole* corpus and then picking one
  // record out of it, so a well-connected place asked Atlas to read 2,500
  // entities thirty-odd times over. Measured against the live corpus,
  // Kalamalka Lake Park has 29 related places, and 32 concurrent reads took
  // Postgres past its statement timeout: 26 of 32 came back `500 canceling
  // statement due to statement timeout`, each after 30–79 seconds. The
  // per-place `catch` below meant the page still rendered — silently missing
  // most of "Keep Exploring", after a minute of waiting.
  //
  // `listPlaces()` is one corpus read (1.0–1.7s measured) that returns every
  // Place, so indexing it by id answers all of them at once. Identical
  // semantics: `relatedPlaces` is already Place-only and both routes read the
  // same `listEntities()`, which excludes archived records.
  //
  // A related place absent from the index is still skipped rather than
  // fatal — the same defensive discipline as before, now for the one case
  // that genuinely means something (a stale reference), not for load Passport
  // was creating itself.
  const placesById = new Map(
    (await listPlaces()).map((p) => [p.id, p] as const),
  );
  // Stored connections and geometry-derived destinations resolve through the
  // same index: a destination Atlas measured within reach needs its full
  // record for a card exactly as a stored neighbour does.
  const relatedPlaceDetails = [...relatedPlaces, ...(nearby ?? [])]
    .map((rp) => placesById.get(rp.id))
    .filter((p): p is Place => p !== undefined)
    .filter((p, i, all) => all.findIndex((q) => q.id === p.id) === i);

  const sectionProps = {
    place,
    relationships,
    sources,
    relatedPlaces,
    // Carried straight through. Resolving an `offers` edge needs the entity on
    // the other end, and only Atlas knows what kind of thing it is.
    relatedEntities,
    operatedBy,
    events,
    locatedHere,
    media,
    temporal,
    nearby,
    relatedPlaceDetails,
  };

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-12">
      <PlaceHero {...sectionProps} />
      <PlaceFireBanNotice {...sectionProps} />
      <div className="flex flex-col">
        {PLACE_SECTIONS.map(({ key, Component }) => (
          <Component key={key} {...sectionProps} />
        ))}
      </div>
    </main>
  );
}
