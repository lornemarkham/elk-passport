import type { Metadata } from "next";
import { listPlaces } from "@/lib/data/atlas-repo";
import { placeToExperience } from "@/domain/experience/atlasMapper";
import { DiscoveryListView } from "@/components/discovery-list/DiscoveryListView";

export const metadata: Metadata = {
  title: "Discovery — Passport",
};

// List mode is now the default Discovery MVP experience (see the
// Discovery MVP Pivot prompt this was built against) — optimized for
// finding and saving quickly rather than visual immersion. The prior
// immersive implementation this route used to render is untouched and
// still fully live at /labs/discovery-space; it's the future
// "Inspiration" mode, not deleted or refactored away.
export default async function DiscoveryPage() {
  const places = await listPlaces();
  const experiences = places.map(placeToExperience);

  return <DiscoveryListView experiences={experiences} />;
}
