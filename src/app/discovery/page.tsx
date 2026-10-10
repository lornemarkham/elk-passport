import type { Metadata } from "next";
import { listDiscoveryCandidates } from "@/lib/data/atlas-repo";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import { DiscoveryListView } from "@/components/discovery-list/DiscoveryListView";
import { activeScope } from "@/domain/discovery/activeScope";
import { currentUser } from "@/lib/auth/currentUser";
import { ZONE } from "@/domain/experience/eventTime";

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
  const [candidates, scope, user] = await Promise.all([
    listDiscoveryCandidates(),
    // The one call site that decides where Passport is looking.
    activeScope(),
    // Resolved here, not in the view: Discovery is fully usable signed out, so
    // `null` is an ordinary answer that changes what saving does and nothing
    // else. Passport gives before it asks.
    currentUser(),
  ]);
  // **The same sentence, not shipped twice.** `candidateToExperience` sets
  // `shortDescription` and `description` to the identical Atlas string, and
  // this page serialises the whole pool to the browser so search can be
  // instant — 313 KB of exact duplicate on every page view. Every consumer
  // that reads `description` concatenates `shortDescription` beside it, so
  // dropping the copy changes no behaviour and no search result.
  //
  // Done here rather than in the mapper: the duplication is worth fixing at
  // the source one day, but that field is read across October and the detail
  // pages, and a Discovery performance pass is not where to find out.
  const experiences = candidates
    .map(candidateToExperience)
    .map((e) =>
      e.description === e.shortDescription
        ? ({ ...e, description: undefined } as typeof e)
        : e,
    );

  // **The day, resolved once on the server.** Composition is time-aware — what
  // is on today leads the page — and a client that reads its own clock during
  // render hydrates into a mismatch with the markup it was sent. Both halves
  // read this one instant, and `ZONE` keeps "today" meaning the day it is
  // where the subjects are rather than where the reader happens to be.
  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: ZONE,
  }).format(now);

  return (
    <DiscoveryListView
      experiences={experiences}
      scope={scope}
      displayName={user?.displayName ?? null}
      now={now.toISOString()}
      today={today}
    />
  );
}
