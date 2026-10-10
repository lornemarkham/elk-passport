import type { Metadata } from "next";
import { listDiscoveryCandidates } from "@/lib/data/atlas-repo";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import { DiscoveryListView } from "@/components/discovery-list/DiscoveryListView";
import { activeScope } from "@/domain/discovery/activeScope";
import { currentUser } from "@/lib/auth/currentUser";
import { PassportNav } from "@/components/shell/PassportNav";
import { ZONE } from "@/domain/experience/eventTime";
import { environmentFor } from "@/lib/environment/reading";
import { OCTOBER_PLACES } from "@/domain/environment/places";
import { hoursBetween } from "@/domain/environment/types";
import { readWeather } from "@/domain/discovery/situation";

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
  //
  // **And the geography evidence, for the same reason.** `candidate-geography/2`
  // carries an `evidence` array per candidate — the records behind the claim.
  // Passport reads `state`, `locality`, `area`, `localities` and `conflict`,
  // and nothing in the product UI reads `evidence` at all. Serialising 2,683 of
  // them added 563 KB to every page view, which is a regression this mission
  // introduced and this undoes. The claim is kept whole; only its working is
  // dropped, and it is still one request away on the subject's own page.
  const experiences = candidates
    .map(candidateToExperience)
    .map((e) =>
      e.description === e.shortDescription
        ? ({ ...e, description: undefined } as typeof e)
        : e,
    )
    .map((e) =>
      e.geography?.evidence
        ? { ...e, geography: { ...e.geography, evidence: undefined } }
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

  // **The weather, which the person should never have to type.**
  //
  // Passport has held hourly Environment Canada readings with provenance since
  // October, and generic Discovery never used them. One area — the one the
  // corpus is mostly about — because a forecast per card is the mistake the
  // batched port exists to prevent, and because Passport has no idea where the
  // reader actually is (no geolocation, and `activeScope()` is admin-gated).
  // So this is the weather *there*, said as the weather there.
  const weather = await forecastForDiscovery(now);

  return (
    <>
      <PassportNav displayName={user?.displayName ?? null} />
      <DiscoveryListView
        experiences={experiences}
        scope={scope}
        displayName={user?.displayName ?? null}
        now={now.toISOString()}
        today={today}
        {...(weather ? { weather } : {})}
      />
    </>
  );
}

/**
 * Today's reading for the area Discovery is mostly about.
 *
 * Deliberately one area and deliberately hard-failing to `undefined`: a page
 * that cannot get a forecast says nothing about the weather, which is the
 * honest answer and the one that cannot mislead.
 */
async function forecastForDiscovery(now: Date) {
  const area = OCTOBER_PLACES.find((p) => p.id === "vernon");
  if (!area) return undefined;
  try {
    const environments = await environmentFor([area]);
    const environment = environments.get(area.id);
    if (!environment) return undefined;
    // The rest of today, not the next 48 hours — somebody asking what to do
    // this afternoon is not served by tomorrow morning's sky.
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const hours = hoursBetween(
      environment,
      now.toISOString(),
      endOfDay.toISOString(),
    );
    const reading = readWeather(hours, environment.provenance.source);
    return reading ? { ...reading, area: area.name } : undefined;
  } catch {
    return undefined;
  }
}
