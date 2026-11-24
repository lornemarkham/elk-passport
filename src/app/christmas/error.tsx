"use client";

import Link from "next/link";

/**
 * **A Christmas page that fails says so**, with a way on — never a blank
 * page. (A plan whose page could not be drawn used to leave nothing on the
 * screen at all.) The person's list and plans are untouched.
 */
export default function ChristmasError({
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <p className="text-4xl" aria-hidden>
        🎄
      </p>
      <h1 className="ghad-display text-2xl font-extrabold">
        That page didn&apos;t load
      </h1>
      <p className="text-base text-[var(--gh-ink-soft)]">
        Nothing you saved or planned has been lost. Try again, or go back to
        your list.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          data-testid="christmas-error-retry"
          className="inline-flex min-h-12 items-center rounded-full bg-[#b3242f] px-6 font-bold text-white"
        >
          Try again
        </button>
        <Link
          href="/christmas/list"
          className="inline-flex min-h-12 items-center rounded-full px-6 font-semibold ring-1 ring-black/20"
        >
          My Christmas List
        </Link>
      </div>
    </main>
  );
}
