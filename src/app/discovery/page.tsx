import { Suspense } from "react";
import type { Metadata } from "next";
import { listDiscoveryCandidates } from "@/lib/data/atlas-repo";
import { forDiscoveryWire } from "@/domain/discovery/wire";
import { DiscoverySkeleton } from "@/components/discovery-list/DiscoverySkeleton";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import { DiscoveryListView } from "@/components/discovery-list/DiscoveryListView";
import { activeScope } from "@/domain/discovery/activeScope";
import { currentUser } from "@/lib/auth/currentUser";
import { PassportNav } from "@/components/shell/PassportNav";
import { dayLine } from "@/domain/discovery/dayLine";
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
  const query = await searchParams;
  const asked = Number(query?.["age"]);
  const childAge =
    Number.isInteger(asked) && asked >= 0 && asked <= 17 ? asked : undefined;
  // **And the day they picked**, for the same reason: Atlas answers `on=` with
  // whether stated hours, a stated season or a held interval cover that day.
  // "Closed Mondays" and "closed for the season" are Atlas's to say.
  const askedOn = query?.["on"];
  const on =
    typeof askedOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(askedOn)
      ? askedOn
      : undefined;

  // **The day, resolved once on the server.** Composition is time-aware — what
  // is on today leads the page — and a client that reads its own clock during
  // render hydrates into a mismatch with the markup it was sent. Both halves
  // read this one instant, and `ZONE` keeps "today" meaning the day it is
  // where the subjects are rather than where the reader happens to be.
  const now = new Date();
  const today = dayLine(now);

  // **Who is asking, started now and awaited twice** — by the bar and by the
  // page — so the two boundaries share one Supabase round trip instead of
  // each making their own.
  const user = currentUser();

  // **Nothing above this line waits on anything.** The bar and a page-shaped
  // frame are in the first bytes of the response; Atlas's corpus (8–19 s on a
  // cold instance) and the reader's identity stream in behind them, each in
  // its own boundary. Before this, the whole route was one wait: a loading
  // screen that looked like a different site, then the page.
  return (
    <>
      <Suspense fallback={<PassportNav pending />}>
        <DiscoveryNav user={user} />
      </Suspense>
      <Suspense fallback={<DiscoverySkeleton today={today} />}>
        <DiscoveryBody
          user={user}
          childAge={childAge}
          on={on}
          now={now.toISOString()}
          today={today}
        />
      </Suspense>
    </>
  );
}

/** The bar, with the reader's name once Supabase has said who they are. */
async function DiscoveryNav({ user }: { user: Promise<Reader> }) {
  // Resolved here, not in the view: Discovery is fully usable signed out, so
  // `null` is an ordinary answer that changes what saving does and nothing
  // else. Passport gives before it asks.
  const reader = await user;
  return <PassportNav displayName={reader?.displayName ?? null} />;
}

type Reader = Awaited<ReturnType<typeof currentUser>>;

async function DiscoveryBody({
  user,
  childAge,
  on,
  now,
  today,
}: {
  user: Promise<Reader>;
  childAge: number | undefined;
  on: string | undefined;
  now: string;
  today: string;
}) {
  // Every kind Atlas holds, not just Places — `The BullWheel` is an
  // Organization and was invisible here until now.
  const [candidates, scope, reader, weather] = await Promise.all([
    listDiscoveryCandidates(childAge, on),
    // The one call site that decides where Passport is looking.
    activeScope(),
    user,
    // **The weather, which the person should never have to type.** One area,
    // because a forecast per card is the mistake the batched port exists to
    // prevent — and **the corpus's area, not the reader's**: this page is
    // rendered on a server that knows nothing about where the request came
    // from, and nothing here guesses. The surface labels it as the default it
    // is, and offers to replace it with the reader's own. Started alongside
    // the corpus rather than after it, so the two waits overlap.
    forecastForDiscovery(),
  ]);

  // **What is sent, and what is not** — see `forDiscoveryWire`. The whole
  // pool is serialised to the browser so search can be instant, and most of
  // what the mapper produced is working the page never reads.
  const experiences = candidates
    .map(candidateToExperience)
    .map(forDiscoveryWire);

  return (
    <DiscoveryListView
      experiences={experiences}
      scope={scope}
      displayName={reader?.displayName ?? null}
      now={now}
      today={today}
      {...(weather ? { weather } : {})}
    />
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
