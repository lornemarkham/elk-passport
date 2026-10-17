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

            {/* Where the one question box and its doors are. */}
            <div className="mt-5 sm:mt-7" aria-hidden>
              <div className="flex flex-row gap-2">
                <span className="min-h-14 min-w-0 flex-1 animate-pulse rounded-full bg-black/[0.05] ring-1 ring-black/10 ring-inset sm:min-h-16" />
                <span className="min-h-14 w-[96px] shrink-0 animate-pulse rounded-full bg-black/[0.05] sm:min-h-16 sm:w-[128px]" />
              </div>
              <div className="mt-3 flex gap-2 overflow-hidden pb-1 sm:flex-wrap">
                {[96, 120, 132, 160, 116].map((width) => (
                  <span
                    key={width}
                    style={{ width }}
                    className="inline-flex min-h-11 shrink-0 animate-pulse rounded-full bg-black/[0.04] ring-1 ring-black/10 ring-inset"
                  />
                ))}
              </div>
            </div>

            {/* Where *Refine* and the summary line sit — the rows themselves
                are behind it on the real page, so they are not drawn here. */}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <span
                aria-hidden
                className="min-h-11 w-full animate-pulse rounded-full bg-black/[0.04] ring-1 ring-black/10 ring-inset sm:w-[22rem]"
              />
              <p
                role="status"
                className="text-[11px] font-semibold tracking-[0.12em] text-black/40 uppercase"
              >
                Finding what’s on and what’s worth doing…
              </p>
            </div>

            {/* **Then photographs**, where the first section's cards land, so
                the page that replaces this one does not jump. */}
            <div
              aria-hidden
              className="mt-8 flex gap-4 overflow-hidden sm:gap-6"
            >
              {[0, 1, 2, 3].map((card) => (
                <span
                  key={card}
                  className="aspect-[4/3] w-[78vw] shrink-0 animate-pulse rounded-2xl bg-black/[0.05] sm:w-[320px] lg:w-[340px]"
                />
              ))}
            </div>
          </section>
        </div>
      </main>
    </ThemeProvider>
  );
}
