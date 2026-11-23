import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { favouriteBySlug } from "@/domain/featured/locals";
import { getSubjectDetail } from "@/lib/data/atlas-repo";
import { COMPOSED_READS } from "@/domain/experience/destination";
import { subjectPageView } from "@/lib/passport/subjectPage";
import { placeDetailsFromComposed } from "@/domain/place-details/fromComposed";
import { withFavourite } from "@/domain/place-details/withFavourite";
import { nearbyFor } from "@/lib/passport/placeNearby";
import { PlaceDetailsPage } from "@/components/place-detail/details/PlaceDetailsPage";

type Props = { params: Promise<{ slug: string }> };

// Read from Atlas on each visit (through the repo's own cache), so what Atlas
// learns about the pub shows here without a rebuild.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const f = favouriteBySlug((await params).slug);
  if (!f) return {};
  return {
    title: `${f.name} — ${f.place} — Go Have a Day`,
    description: f.line,
    openGraph: {
      title: f.name,
      description: f.line,
      ...(f.photos[0] ? { images: [{ url: f.photos[0].url }] } : {}),
    },
  };
}

/**
 * **A local favourite's page is the shared place page** (owner brief M1041,
 * superseding the hand-made card page of M1007). The Atlas record is read
 * as for any business, and the favourite adds its editor's note: the label
 * that says it is our pick, its line, its sourced location, phone, photos
 * and published hours where Atlas has none yet, and the experiences it
 * pairs with. Shareable, so the pub can send its customers here too.
 *
 * Atlas unreachable is not an error here: the page is then the favourite's
 * own sourced facts, which is what it was before Atlas was read at all.
 */
export default async function FavouritePage({ params }: Props) {
  const f = favouriteBySlug((await params).slug);
  if (!f) notFound();
  const composition = await getSubjectDetail(
    COMPOSED_READS.Organization,
    f.atlasId,
  ).catch(() => null);
  const model = withFavourite(
    composition
      ? placeDetailsFromComposed(subjectPageView(composition))
      : undefined,
    f,
  );
  const nearby = await nearbyFor(model.point, f.atlasId);
  return (
    <main className="min-h-screen bg-white">
      <PlaceDetailsPage model={{ ...model, nearby }} />
    </main>
  );
}
