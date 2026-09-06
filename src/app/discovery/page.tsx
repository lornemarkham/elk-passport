import type { Metadata } from "next";
import { listDiscoveryCandidates } from "@/lib/data/atlas-repo";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import { DiscoveryListView } from "@/components/discovery-list/DiscoveryListView";
import { activeRegionId } from "@/domain/discovery/regionScope";

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
  // Every kind Atlas holds, not just Places — `The BullWheel` is an
  // Organization and was invisible here until now.
  const candidates = await listDiscoveryCandidates();
  const experiences = candidates.map(candidateToExperience);

  // The one call site that decides which region Passport is showing. Undefined
  // today — one region, no scope, unchanged behaviour — and the only thing that
  // changes when a second region is defined.
  return (
    <DiscoveryListView
      experiences={experiences}
      activeRegionId={activeRegionId()}
    />
  );
}
