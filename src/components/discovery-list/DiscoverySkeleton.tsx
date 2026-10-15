import { FeelLikeHeading } from "@/components/ghad/FeelLikeDoing";
import { ThemeProvider } from "@/components/ghad/theme";

/**
 * **Discovery, before Atlas has answered — in Discovery's own clothes.**
 *
 * The page it stands in for reads Atlas's whole corpus, which is 8–19 seconds
 * on a cold instance (`atlas-repo.ts`). What somebody sees in that time used
 * to be a cream page under a *different heading* ("What could you do?") and
 * no bar at all, followed by a white page with a bar, a different heading and
 * a different ground: two websites, one after the other, on every cold visit.
 *
 * This is the same ground, the same container, the same words
 * (`FeelLikeHeading` is the very component the real page renders), the same
 * date, and shapes where the question box and the rows will be. The only thing
 * that changes when the real page arrives is that the shapes become controls.
 * The bar above it is the real `PassportNav` — drawn by the caller, because
 * the real page's bar is outside this and must not remount.
 *
 * Server-rendered and static: nothing here waits on anything, so it is in the
 * first bytes of the response.
 */
export function DiscoverySkeleton({ today }: { readonly today?: string }) {
  return (
    <ThemeProvider>
      <main
        className="min-h-screen bg-white"
        aria-busy="true"
        data-testid="discovery-loading"
      >
        <div className="mx-auto max-w-[1760px] px-4 py-5 sm:px-6 sm:py-10 lg:px-10">
          <section>
            <FeelLikeHeading {...(today ? { today } : {})} />

            {/* Where the question box and its four doors are. */}
            <div className="mt-5 sm:mt-7" aria-hidden>
              <div className="flex flex-col gap-2 sm:flex-row">
                <span className="min-h-12 flex-1 animate-pulse rounded-full bg-black/[0.05] ring-1 ring-black/10 ring-inset" />
                <span className="min-h-12 w-full animate-pulse rounded-full bg-black/[0.05] sm:w-[104px]" />
              </div>
              <div className="mt-3 flex gap-2 overflow-hidden pb-1 sm:flex-wrap">
                {[236, 244, 276, 252].map((width) => (
                  <span
                    key={width}
                    style={{ width }}
                    className="inline-flex min-h-10 shrink-0 animate-pulse rounded-full bg-black/[0.04] ring-1 ring-black/10 ring-inset"
                  />
                ))}
              </div>
            </div>

            {/* The rows, at the same offset the real ones sit at. The first
                row's label says what is happening, in the label's own type, so
                nobody reads a blank as broken and nothing is pushed down. */}
            <div className="mt-5 sm:mt-8">
              {[3, 4, 3].map((choices, row) => (
                <div
                  key={row}
                  className="border-t border-black/10 py-3 sm:py-3.5"
                >
                  {row === 0 ? (
                    <p
                      role="status"
                      className="text-[11px] font-semibold tracking-[0.12em] text-black/40 uppercase"
                    >
                      Finding what’s on and what’s worth doing…
                    </p>
                  ) : (
                    <span
                      aria-hidden
                      className="block h-[11px] w-40 animate-pulse rounded bg-black/[0.06]"
                    />
                  )}
                  <div aria-hidden className="mt-2 flex gap-2 overflow-hidden">
                    {Array.from({ length: choices }, (_, choice) => (
                      <span
                        key={choice}
                        className="inline-flex min-h-11 w-28 shrink-0 animate-pulse rounded-full bg-black/[0.04] ring-1 ring-black/10 ring-inset"
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </ThemeProvider>
  );
}
