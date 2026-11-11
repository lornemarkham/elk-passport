import type { Metadata } from "next";
import Link from "next/link";
import { InsiderCard } from "@/components/insiders/InsiderCard";
import { ShareButton } from "@/components/insiders/ShareButton";
import { matchesSaid } from "@/domain/insiders/model";
import { publishedListings } from "@/lib/insiders/service";

export const metadata: Metadata = {
  title: "Local insiders — Go Have a Day",
  description:
    "Clubs, races, jams and get-togethers in Vernon and the North Okanagan that locals told us about — checked before they're here.",
};

export const dynamic = "force-dynamic";

/** Every interest that published listings carry, most common first. */
function interestsOf(listings: Awaited<ReturnType<typeof publishedListings>>) {
  const count = new Map<string, number>();
  for (const l of listings)
    for (const i of l.interests) count.set(i, (count.get(i) ?? 0) + 1);
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([i]) => i);
}

export default async function LocalPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const interest =
    typeof q?.["interest"] === "string" ? q["interest"].slice(0, 60) : "";
  const all = await publishedListings();
  const shown = interest ? all.filter((l) => matchesSaid(l, [interest])) : all;
  return (
    <>
      <main className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-[11px] font-bold tracking-[0.16em] text-black/60 uppercase">
          Local insiders · Vernon &amp; the North Okanagan
        </p>
        <h1 className="ghad-display mt-2 text-4xl leading-tight font-extrabold tracking-[-0.03em] sm:text-6xl">
          The coolest stuff happens off the beaten path.
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-black/70">
          Races in the hills, the Thursday badminton crowd, the jam in the back
          room. Locals tell us; we check it; you go.
        </p>
        <div className="mt-5">
          <ShareButton />
        </div>

        <nav
          aria-label="Interests"
          className="mt-8 flex flex-wrap gap-2"
          data-testid="local-interests"
        >
          <Link
            href="/local"
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${!interest ? "bg-black text-white" : "bg-black/5"}`}
          >
            Everything
          </Link>
          {interestsOf(all).map((i) => (
            <Link
              key={i}
              href={`/local?interest=${encodeURIComponent(i)}`}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${interest === i ? "bg-black text-white" : "bg-black/5"}`}
            >
              {i}
            </Link>
          ))}
        </nav>

        {shown.length ? (
          <ul
            className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
            data-testid="local-list"
          >
            {shown.map((l) => (
              <InsiderCard key={l.id} listing={l} />
            ))}
          </ul>
        ) : (
          <p className="mt-8 rounded-xl border border-dashed border-black/25 px-4 py-10 text-center text-black/60">
            {all.length
              ? `Nothing for ${interest} yet. Know one? Share it.`
              : "The network isn't answering just now — try again in a moment."}
          </p>
        )}

        <p className="mt-10 max-w-2xl text-sm text-black/55">
          Something here wrong, or is it yours? Open the listing to tell us.
          Want to be a local ambassador?{" "}
          <Link href="/ambassadors" className="underline underline-offset-4">
            Ambassadors
          </Link>{" "}
          are invited by the Go Have a Day team.
        </p>
      </main>
    </>
  );
}
