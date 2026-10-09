/**
 * **What October looks like while it is finding out.**
 *
 * Discovery blocks on one Atlas read, and a cold one takes six seconds
 * against the live corpus. Without a boundary the browser held the previous
 * page — or nothing — for all of it, which is the single thing that made the
 * product feel broken rather than slow.
 *
 * This is not a spinner over a backend problem: the read itself is now served
 * stale-while-revalidating, so the six-second case happens once per instance
 * rather than to whoever arrives after a cache expires. This is for that once,
 * and for a genuinely cold start.
 *
 * It deliberately mirrors the real page's shape — the date line, the headline,
 * a lead, a row of cards — so the layout does not jump when the content
 * lands. Nothing here claims to know anything: no counts, no names, no sky.
 */
export default function DiscoverLoading() {
  return (
    <main className="min-h-screen bg-[#0c0a0c] text-[#e9e6da]">
      <div className="mx-auto max-w-4xl px-5 pt-8 pb-28 sm:px-6">
        <div className="mb-7 h-9" />

        <div className="mb-8 animate-pulse" aria-hidden>
          <div className="h-3 w-56 rounded bg-[#e9e6da]/10" />
          <div className="mt-4 h-10 w-4/5 rounded bg-[#e9e6da]/[0.07] sm:h-14" />
          <div className="mt-3 h-4 w-2/3 rounded bg-[#e9e6da]/[0.05]" />
        </div>

        <div
          className="mb-10 aspect-[16/9] w-full animate-pulse rounded-2xl bg-[#e9e6da]/[0.05] sm:aspect-[21/9]"
          aria-hidden
        />

        <div className="grid animate-pulse gap-3 sm:grid-cols-2" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-lg bg-[#e9e6da]/[0.04]" />
          ))}
        </div>

        <p className="sr-only" role="status">
          Finding what is on in October.
        </p>
      </div>
    </main>
  );
}
