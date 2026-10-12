"use client";

import Link from "next/link";
import { useEffect } from "react";
import { reportError } from "@/lib/observability/report";

/**
 * **A subject's page when Atlas did not answer for it.**
 *
 * Shared by `/places/[id]` and `/passport/[id]`. Before these boundaries, an
 * Atlas failure on a detail page either reached the app-wide "Something went
 * badly wrong", or was swallowed into "There's nothing at this address", which
 * tells somebody holding a real link that the thing does not exist.
 */
export function SubjectUnavailable({
  error,
  reset,
  boundary,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
  readonly boundary: string;
}) {
  useEffect(() => {
    reportError(error, {
      boundary,
      ...(error.digest ? { digest: error.digest } : {}),
    });
  }, [error, boundary]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-5">
      <div
        data-testid="subject-unavailable"
        role="alert"
        className="w-full max-w-md rounded-2xl p-7 text-center ring-1 ring-black/15 ring-inset"
      >
        <h1 className="text-2xl font-extrabold text-[#111]">
          This page didn&apos;t load
        </h1>
        <p className="mt-2 text-sm text-black/60">
          It couldn&apos;t be loaded just now, usually because Atlas, where this
          comes from, did not answer. Nothing you saved is lost.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 min-h-11 w-full rounded-full bg-[#111] px-5 text-sm font-semibold text-white"
        >
          Try again
        </button>
        <Link
          href="/discovery"
          className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[#111] underline underline-offset-4"
        >
          Back to Discovery
        </Link>
      </div>
    </main>
  );
}
