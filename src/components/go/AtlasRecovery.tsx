import Link from "next/link";

/**
 * **When Atlas cannot be reached.**
 *
 * Atlas is where every place comes from, so without it there is no honest day
 * to build or print. The page says exactly that — not "something went badly
 * wrong" — keeps what the person typed, and offers the one action that
 * helps. Plain links on purpose: this renders on the server, where the
 * outage was found, and a link works with no script at all.
 */
export function AtlasRecovery({
  said,
  retryHref,
  what = "build a day",
}: {
  readonly said?: string;
  readonly retryHref: string;
  readonly what?: string;
}) {
  return (
    <div
      data-testid="atlas-recovery"
      role="alert"
      className="mx-auto mt-6 max-w-[640px] rounded-2xl p-6 ring-1 ring-black/15 ring-inset"
    >
      <h2 className="ghad-display text-[26px] leading-tight font-extrabold tracking-[-0.03em] text-[#111]">
        Passport couldn&apos;t reach Atlas
      </h2>
      <p className="mt-2 text-[15px] leading-relaxed text-black/65">
        Atlas is where the places come from, and it didn&apos;t answer, so
        Passport can&apos;t {what} right now. Nothing you saved is lost, and
        nothing was made up to fill the gap.
      </p>
      {said && (
        <p className="mt-3 text-[15px] text-black/65">
          You asked for: <q data-testid="atlas-recovery-said">{said}</q>. It is
          still here — try again in a moment.
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={retryHref}
          data-testid="atlas-recovery-retry"
          prefetch={false}
          className="inline-flex min-h-12 items-center rounded-full bg-[#111] px-6 text-[15px] font-semibold text-white"
        >
          Try again
        </Link>
        <Link
          href="/discovery"
          className="inline-flex min-h-12 items-center px-5 text-[15px] font-semibold text-black/55 hover:text-[#111]"
        >
          Browse instead
        </Link>
      </div>
    </div>
  );
}
