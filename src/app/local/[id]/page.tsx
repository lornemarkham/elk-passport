import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InsiderCard } from "@/components/insiders/InsiderCard";
import { ListingFlags } from "@/components/insiders/ListingFlags";
import { publishedListings } from "@/lib/insiders/service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "From the locals — Go Have a Day" };

/** One published listing, with where it came from and how to correct or claim it. */
export default async function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = (await publishedListings()).find((l) => l.id === id);
  if (!listing) notFound();
  return (
    <>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <Link
          href="/local"
          className="text-sm font-semibold underline underline-offset-4"
        >
          ← Local insiders
        </Link>
        <ul className="mt-4">
          <InsiderCard listing={listing} />
        </ul>
        <section
          className="mt-6 text-sm text-black/70"
          aria-label="Where this came from"
        >
          <h2 className="font-bold text-black">Where this came from</h2>
          <p className="mt-1" data-testid="listing-provenance">
            {listing.provenance}
          </p>
          {listing.when.state === "past" && (
            <p className="mt-2">
              This has happened before. We&apos;ll show the next one once its
              date is announced — until then, the organizer&apos;s page is the
              place to watch.
            </p>
          )}
          {listing.access !== "public" && (
            <p className="mt-2">
              Members only — listed with the organizer&apos;s permission.
            </p>
          )}
          {listing.atlasEntityId && (
            <p className="mt-2">
              <Link
                href={`/passport/${listing.atlasEntityId}`}
                className="underline underline-offset-4"
              >
                More about it on Go Have a Day
              </Link>
            </p>
          )}
        </section>
        <ListingFlags id={listing.id} />
      </main>
    </>
  );
}
