/**
 * Shown while Atlas is being read.
 *
 * Not decoration: `/discovery/candidates` returns the whole corpus, and under a
 * concurrent population run that has measured a minute. A blank page for a
 * minute reads as broken, and this says which of the two it is.
 */
export default function DiscoveryLoading() {
  return (
    <main className="min-h-screen bg-[#ecdfc4]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-14">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-[#2b2015] sm:text-5xl">
          Discovery
        </h1>
        <p className="mt-3 text-sm text-[#2b2015]/60">
          Reading what Atlas knows about the valley…
        </p>

        <ul className="mt-10 flex flex-col gap-3" aria-hidden>
          {Array.from({ length: 6 }, (_, index) => (
            <li
              key={index}
              className="h-24 animate-pulse rounded-xl border border-[#8a5a24]/15 bg-white/40"
            />
          ))}
        </ul>
      </div>
    </main>
  );
}
