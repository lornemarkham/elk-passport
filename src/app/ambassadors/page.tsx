import type { Metadata } from "next";
import Link from "next/link";
import { PassportNav } from "@/components/shell/PassportNav";
import {
  AmbassadorPortal,
  type PortalListing,
} from "@/components/insiders/AmbassadorPortal";
import { discoveryCandidates } from "@/lib/data/atlas-repo";
import {
  blockers,
  contributionsOf,
  leadTimeReport,
  watchList,
  nameKey,
  type Listing,
} from "@/domain/insiders/model";
import { canEdit, openFlags, queue } from "@/domain/insiders/review";
import { actor, network } from "@/lib/insiders/service";

export const metadata: Metadata = {
  title: "Ambassadors — Go Have a Day",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/** Atlas entities whose name matches, so a reviewer links instead of duplicating. Bounded wait. */
async function atlasMatches(
  listings: readonly Listing[],
): Promise<Map<string, { id: string; name: string }[]>> {
  const out = new Map<string, { id: string; name: string }[]>();
  if (!listings.length) return out;
  const corpus = await Promise.race([
    discoveryCandidates().then((r) => r.candidates),
    new Promise<[]>((resolve) => setTimeout(() => resolve([]), 6000)),
  ]);
  const byKey = new Map<string, { id: string; name: string }[]>();
  for (const c of corpus) {
    const name = c.name;
    const k = nameKey(name);
    if (!k) continue;
    byKey.set(k, [...(byKey.get(k) ?? []), { id: c.id, name }]);
  }
  for (const l of listings) {
    const hits = byKey.get(nameKey(l.title));
    if (hits) out.set(l.id, hits.slice(0, 3));
  }
  return out;
}

export default async function AmbassadorsPage() {
  const n = await network().catch(() => null);
  if (!n)
    return (
      <Shell>
        <p>The insider network isn&apos;t set up on this deployment yet.</p>
      </Shell>
    );
  const me = await actor(n);
  if (me.role === "visitor")
    return (
      <Shell>
        <h1 className="ghad-display text-4xl font-extrabold tracking-[-0.03em]">
          Ambassadors
        </h1>
        <p className="mt-3 max-w-xl text-lg text-black/70">
          Local ambassadors share and look after Go Have a Day&apos;s insider
          listings for their town. It&apos;s by invitation.
        </p>
        {me.signedIn ? (
          <p
            className="mt-4 max-w-xl text-black/70"
            data-testid="not-ambassador"
          >
            You&apos;re signed in, but not an ambassador yet. Anyone can still{" "}
            <Link href="/local/share" className="underline underline-offset-4">
              share something
            </Link>
            .
          </p>
        ) : (
          <Link
            href="/auth?next=%2Fambassadors"
            data-testid="ambassador-sign-in"
            className="mt-5 inline-flex min-h-12 items-center rounded-full bg-black px-5 font-semibold text-white"
          >
            Sign in
          </Link>
        )}
      </Shell>
    );

  const reviewer = me.role === "admin" || !!me.ambassador?.trusted;
  const mine = contributionsOf(n, me.who);
  const review = reviewer ? queue(n) : [];
  const matches = await atlasMatches(review);
  const toPortal = (l: Listing): PortalListing => ({
    listing: l,
    blockers: blockers(l),
    flags: openFlags(l),
    editable: canEdit(l, me),
    atlasMatches: matches.get(l.id) ?? [],
  });
  return (
    <Shell>
      <AmbassadorPortal
        me={{
          role: me.role,
          email: me.who,
          name: me.ambassador?.name ?? me.who,
          area: me.ambassador?.area ?? "North Okanagan",
          bio: me.ambassador?.bio ?? "",
          trusted: !!me.ambassador?.trusted,
          reviewer,
        }}
        mine={mine.listings.map(toPortal)}
        stats={{
          published: mine.published,
          waiting: mine.waiting,
          medianLeadDays: mine.medianLeadDays ?? null,
        }}
        queue={review.map(toPortal)}
        everything={
          me.role === "admin"
            ? n.listings.filter((l) => !review.includes(l)).map(toPortal)
            : []
        }
        leadTimes={reviewer ? leadTimeReport(n) : []}
        watch={reviewer ? watchList(n, new Date()) : []}
        ambassadors={me.role === "admin" ? [...n.ambassadors] : []}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PassportNav displayName={null} />
      <main className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 sm:py-12">
        {children}
      </main>
    </>
  );
}
