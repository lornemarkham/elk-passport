import type { Metadata } from "next";
import { listDiscoveryCandidates } from "@/lib/data/atlas-repo";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import { DiscoveryListView } from "@/components/discovery-list/DiscoveryListView";
import { activeScope } from "@/domain/discovery/activeScope";
import { currentUser } from "@/lib/auth/currentUser";
import { PassportNav } from "@/components/shell/PassportNav";
import { ZONE } from "@/domain/experience/eventTime";
import { OCTOBER_PLACES } from "@/domain/environment/places";
import { weatherToday } from "@/lib/environment/today";

export const metadata: Metadata = {
  title: "Discovery — Passport",
};

// List mode is now the default Discovery MVP experience (see the
// Discovery MVP Pivot prompt this was built against) — optimized for
// finding and saving quickly rather than visual immersion. The prior
// immersive implementation this route used to render is untouched and
// still fully live at /labs/discovery-space; it's the future
// "Inspiration" mode, not deleted or refactored away.
export default async function DiscoveryPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // **The one thing on this page that changes what Atlas is asked.**
  //
  // `?age=N` means somebody said how old the child with them is, so Atlas is
  // asked `childAge=N` and answers with `suitability.forAge` — its verdict,
  // with the statements behind it. Absent means nobody said, and Passport
  // does not guess: there is no default age.
  const asked = Number((await searchParams)?.["age"]);
  const childAge =
    Number.isInteger(asked) && asked >= 0 && asked <= 17 ? asked : undefined;
  // Every kind Atlas holds, not just Places — `The BullWheel` is an
  // Organization and was invisible here until now.
  const [candidates, scope, user] = await Promise.all([
    listDiscoveryCandidates(childAge),
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
  // One area, because a forecast per card is the mistake the batched port
  // exists to prevent — and **the corpus's area, not the reader's**. This page
  // is rendered on a server that knows nothing about where the request came
  // from, and nothing here guesses: no IP lookup, no stored home area, no
  // header sniffing. The surface labels it as the default it is, and offers to
  // replace it with the reader's own.
  const weather = await forecastForDiscovery();

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
 * **The area the corpus is about, which is not where anybody is.**
 *
 * Vernon because Atlas holds 813 Okanagan candidates and 33 from anywhere
 * else — a fact about the knowledge, carried here as the default context and
 * nothing more. It used to be presented as simply *the* weather; it is now
 * labelled "the Vernon area" and a reader can replace it in one tap
 * (`useHere`), which is the only thing in Passport that knows where somebody
 * actually is.
 *
 * Deliberately hard-failing to `undefined`: a page that cannot get a forecast
 * says nothing about the weather, which is honest and cannot mislead.
 */
const CORPUS_AREA = OCTOBER_PLACES.find((p) => p.id === "vernon");

async function forecastForDiscovery() {
  if (!CORPUS_AREA) return undefined;
  return weatherToday(CORPUS_AREA, new Date(), CORPUS_AREA.name);
}
