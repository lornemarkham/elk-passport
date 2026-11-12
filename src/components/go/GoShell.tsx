import { ThemeProvider } from "@/components/ghad/theme";

/**
 * **`/go` before Atlas has answered** — the page's `<Suspense>` fallback.
 *
 * The page reads Atlas's whole corpus, and on a cold instance that read was
 * measured at 7–12 seconds of nothing on production (M760, 2026-11-12): the
 * browser showed a blank page with a spinner in the tab until the full
 * response arrived. Discovery has streamed a shell since M416; `/go` never
 * did. This is that shell: the same container and the same words the page
 * opens on (`GoHaveADay`), with a shape where the sentence box will be, so
 * the only change when the day arrives is that the shape becomes a control.
 *
 * Static: it is in the first bytes of the response. It is a boundary inside
 * `/go`'s page rather than a `loading.tsx`, because a route's `loading.tsx`
 * also stands in for `/go/print`, which would then blank the day the moment
 * Print is pressed instead of keeping it on screen until the paper is ready.
 */
export function GoShell() {
  return (
    <ThemeProvider>
      <main
        className="min-h-screen bg-white"
        aria-busy="true"
        data-testid="go-loading"
      >
        <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 sm:py-12 lg:px-10">
          <p
            className="text-[11px] font-semibold tracking-[0.12em] uppercase"
            style={{ color: "var(--ghad-accent)" }}
          >
            Go offline
          </p>
          <h1 className="ghad-display mt-2 max-w-[18ch] text-[34px] leading-[0.95] font-extrabold tracking-[-0.045em] text-balance text-[#111] sm:text-[60px]">
            What kind of day do you want?
          </h1>
          <p className="mt-4 max-w-[58ch] text-[16px] leading-relaxed text-black/60">
            Say it however you&apos;d say it to a friend — who&apos;s coming,
            how long you&apos;ve got, when you need to be home. We&apos;ll build
            you a day out of real places, print it, and then you can leave your
            phone in the glovebox.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row" aria-hidden>
            <span className="min-h-14 flex-1 animate-pulse rounded-full bg-black/[0.05] ring-1 ring-black/10 ring-inset" />
            <span className="min-h-14 w-full animate-pulse rounded-full bg-black/[0.08] sm:w-[160px]" />
          </div>
          <p className="mt-4 text-[14px] text-black/45" role="status">
            Finding real places for your day…
          </p>
        </div>
      </main>
    </ThemeProvider>
  );
}
