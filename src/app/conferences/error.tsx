"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { reportError } from "@/lib/observability/report";

/**
 * **When a conference page breaks, the rest of Passport stays standing.**
 *
 * Without this, any failure under `/conferences` (a database refusal, a store
 * that is half set up) fell through to `global-error.tsx` and took the whole
 * shell with it. This renders inside the conferences layout, so the nav stays
 * and the person has somewhere to go.
 */
export default function ConferencesError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    reportError(error, {
      boundary: "conferences",
      ...(pathname ? { route: pathname } : {}),
      ...(error.digest ? { digest: error.digest } : {}),
    });
  }, [error, pathname]);

  return (
    <div className="mx-auto max-w-[760px] px-5 pt-10">
      <p className="text-[13px] font-bold tracking-[0.16em] text-black/50 uppercase">
        Go have a conference
      </p>
      <h1 className="mt-2 text-[32px] leading-[1] font-black tracking-[-0.03em]">
        This didn&apos;t load.
      </h1>
      <p className="mt-4 max-w-[52ch] text-[17px] text-black/60">
        Nothing you have saved is lost. Try again in a moment. If it keeps
        happening, we&apos;ve been told and we&apos;re on it.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={reset}
          className="inline-block min-h-11 rounded-xl bg-black px-5 py-3 font-bold text-white"
        >
          Try again
        </button>
        <Link href="/" className="font-semibold underline">
          Back to Go Have a Day
        </Link>
      </div>
      {error.digest ? (
        <p className="mt-8 text-[11px] tracking-[0.14em] text-black/30 uppercase">
          Reference {error.digest}
        </p>
      ) : null}
    </div>
  );
}
