import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPlace, getPlaceDetail } from "@/lib/data/atlas-repo";
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

  const { place, relationships, sources, relatedPlaces } = detail;

  const relatedPlaceDetails = (
    await Promise.all(
      relatedPlaces.map(async (rp) => {
        try {
          return await getPlace(rp.id);
        } catch (error) {
          // A related place failing to load is not this page's problem to
          // surface — "Keep Exploring" just shows one fewer card, the
          // same defensive-skip discipline it already applies to a stale
          // relationship reference.
          console.error(`Failed to load related place ${rp.id}:`, error);
          return null;
        }
      }),
    )
  ).filter((p): p is Place => p !== null);

  const sectionProps = {
    place,
    relationships,
    sources,
    relatedPlaces,
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
