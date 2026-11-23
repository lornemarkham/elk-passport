import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPlaceDetail, listPlaces } from "@/lib/data/atlas-repo";
import type { Place } from "@/lib/data/types";
import { PlaceFireBanNotice } from "@/components/place-detail/PlaceFireBanNotice";
import { PLACE_SECTIONS } from "@/components/place-detail/sections";
import { heroImage } from "@/components/place-detail/placeMedia";
import { PlaceDetailsPage } from "@/components/place-detail/details/PlaceDetailsPage";
import { placeDetailsFromPlace } from "@/domain/place-details/fromPlace";
import { safeNext } from "@/lib/auth/safeNext";

type PlacePageProps = {
  params: Promise<{ id: string }>;
  /**
   * Carried through from Discovery: the day somebody picked, the age they
   * named, and the exploration to go back to. Each one optional, and none
   * defaulted — see `LetsDoThis`.
   */
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
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
export default async function PlacePage({
  params,
  searchParams,
}: PlacePageProps) {
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const one = (value: string | string[] | undefined) =>
    typeof value === "string" ? value : undefined;
  const on = /^\d{4}-\d{2}-\d{2}$/.test(one(query.on) ?? "")
    ? one(query.on)
    : undefined;
  const askedAge = Number(one(query.childAge));
  const childAge =
    Number.isInteger(askedAge) && askedAge >= 0 && askedAge <= 17
      ? askedAge
      : undefined;
  const back = one(query.back)
    ? safeNext(one(query.back)!, "/discovery")
    : undefined;
  // The detail and the place index are independent reads of Atlas; asking
  // for both at once makes the page wait for the slower, not for the sum.
  const [detail, allPlaces] = await Promise.all([
    getPlaceDetail(id),
    listPlaces(),
  ]);

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
    practical,
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
  const placesById = new Map(allPlaces.map((p) => [p.id, p] as const));
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
    practical,
    nearby,
    relatedPlaceDetails,
  };

  // **The shared place page** (owner brief M1041): the same hero, actions,
  // visitor column and Sources & accuracy as every other place, with this
  // Place's own Atlas sections in the middle. The frame draws the type, the
  // address, the map and the sources, so the sections that only repeated
  // those as a list (Overview, Quick Facts, Map, Trusted Information) are
  // left to it.
  const model = placeDetailsFromPlace(detail, heroImage(place, media));
  const dayQuery = new URLSearchParams();
  if (on) dayQuery.set("on", on);
  if (childAge !== undefined) dayQuery.set("childAge", String(childAge));
  if (back) dayQuery.set("back", back);

  return (
    <main className="min-h-screen bg-white">
      <PlaceDetailsPage
        model={model}
        {...(back ? { back } : {})}
        dayHref={`/day/${id}${dayQuery.size > 0 ? `?${dayQuery}` : ""}`}
      >
        <PlaceFireBanNotice {...sectionProps} />
        {PLACE_SECTIONS.filter(({ key }) => !FRAMED.has(key)).map(
          ({ key, Component }) => (
            <Component key={key} {...sectionProps} />
          ),
        )}
      </PlaceDetailsPage>
    </main>
  );
}

/** Sections the shared frame already draws, so they are not drawn twice. */
const FRAMED = new Set(["overview", "quick-facts", "map", "sources"]);
