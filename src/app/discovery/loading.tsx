/**
 * Shown while Atlas is being read.
 *
 * Not decoration: `/discovery/candidates` returns the whole corpus, and under a
 * concurrent population run that has measured a minute. A blank page for a
 * minute reads as broken, and this says which of the two it is.
 *
 * **It mirrors the page it precedes.** It used to say "Discovery" in an `h1`
 * above six row-shaped bars — the old list — so a reader saw one page's
 * heading replaced by a different one, and the streamed markup carried two
 * `h1`s saying different things. The shapes below are the composed sections
 * and their cards.
 */
export default function DiscoveryLoading() {
  return (
    <main className="min-h-screen bg-[#ecdfc4]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-14">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-[#2b2015] sm:text-5xl">
          What could you do?
        </h1>
        <p className="mt-3 text-sm text-[#2b2015]/60" role="status">
          Reading what Atlas knows about the valley…
        </p>

        <div className="mt-6 flex gap-2" aria-hidden>
          {Array.from({ length: 4 }, (_, index) => (
            <span
              key={index}
              className="h-11 w-28 animate-pulse rounded-full border border-[#8a5a24]/15 bg-white/40"
            />
          ))}
        </div>

        <div className="mt-10 h-6 w-48 animate-pulse rounded bg-white/50" />
        <ul
          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          aria-hidden
        >
          {Array.from({ length: 6 }, (_, index) => (
            <li
              key={index}
              className="h-64 animate-pulse rounded-xl border border-[#8a5a24]/15 bg-white/40"
            />
          ))}
        </ul>
      </div>
    </main>
  );
}
