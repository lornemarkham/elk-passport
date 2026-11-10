import Link from "next/link";
import { matchesSaid, type PublicListing } from "@/domain/insiders/model";
import { InsiderCard } from "./InsiderCard";
import { ShareButton } from "./ShareButton";

/**
 * **From the locals**, on Discovery: what the Local Insider Network holds
 * that answers what was said. With nothing said, the soonest few. With a
 * sentence and nothing that fits, the cards go and the invitation to share
 * stays — a gap is a thing a local can fill.
 */
export function LocalInsiders({
  listings,
  said = [],
  max = 3,
}: {
  readonly listings: readonly PublicListing[];
  readonly said?: readonly string[];
  readonly max?: number;
}) {
  const fits = listings.filter((l) => matchesSaid(l, said)).slice(0, max);
  return (
    <section
      aria-label="From the locals"
      data-testid="local-insiders"
      className="rounded-[28px] bg-[#f4efe6] p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold tracking-[0.16em] text-black/60 uppercase">
            Local insiders · North Okanagan
          </p>
          <h2 className="ghad-display mt-1 text-2xl leading-tight font-extrabold tracking-[-0.03em] sm:text-3xl">
            {fits.length
              ? "Off the beaten path"
              : "Know where the good stuff is?"}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-black/70">
            {fits.length
              ? "Clubs, races and get-togethers locals told us about, checked before they're here."
              : "Nothing from the locals fits that yet. Tell us about the club, race or jam we're missing."}
          </p>
        </div>
        <ShareButton />
      </div>
      {fits.length > 0 && (
        <>
          <ul className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {fits.map((l) => (
              <InsiderCard key={l.id} listing={l} />
            ))}
          </ul>
          <Link
            href="/local"
            data-testid="local-all"
            className="mt-4 inline-block text-sm font-semibold underline underline-offset-4"
          >
            Everything locals told us about
          </Link>
        </>
      )}
    </section>
  );
}
