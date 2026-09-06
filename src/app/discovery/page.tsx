import type { Metadata } from "next";
import { listDiscoveryCandidates } from "@/lib/data/atlas-repo";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import { DiscoveryListView } from "@/components/discovery-list/DiscoveryListView";
import { activeScope } from "@/domain/discovery/activeScope";

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
  const [candidates, scope] = await Promise.all([
    listDiscoveryCandidates(),
    // The one call site that decides where Passport is looking.
    activeScope(),
  ]);
  const experiences = candidates.map(candidateToExperience);

  return <DiscoveryListView experiences={experiences} scope={scope} />;
}
