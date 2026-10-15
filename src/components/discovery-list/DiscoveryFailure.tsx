"use client";

import { ThemeProvider } from "@/components/ghad/theme";
import { PassportNav } from "@/components/shell/PassportNav";

/**
 * **Discovery's failure state, inside Discovery's frame.**
 *
 * The route's `error.tsx` is a client boundary and cannot know who is signed
 * in, so the bar's reader slot is left open rather than saying "Sign in" to
 * somebody who may not be signed out. Everything else is the page: the
 * bar, the white ground and the type.
 */
export function DiscoveryFailure({
  onRetry,
}: {
  readonly onRetry: () => void;
}) {
  return (
    <>
      <PassportNav pending />
      <ThemeProvider>
        <main
          data-testid="discovery-error"
          className="flex min-h-[60vh] flex-1 items-center justify-center bg-white px-5"
        >
          <div className="w-full max-w-md rounded-2xl p-7 text-center ring-1 ring-black/10 ring-inset">
            <h1 className="ghad-display text-[26px] leading-[1] font-extrabold tracking-[-0.04em] text-[#111]">
              Passport couldn&apos;t reach Atlas
            </h1>
            <p className="mt-3 text-sm text-black/60">
              Nothing is wrong with your account, and nothing you saved is lost.
              Atlas is where the places come from, and it did not answer in
              time.
            </p>
            <button
              type="button"
              onClick={onRetry}
              style={{
                backgroundColor: "var(--ghad-accent)",
                color: "var(--ghad-accent-ink)",
              }}
              className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full px-5 text-[15px] font-semibold"
            >
              Try again
            </button>
          </div>
        </main>
      </ThemeProvider>
    </>
  );
}
