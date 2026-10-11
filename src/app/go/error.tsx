"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/observability/report";

/**
 * **If anything on `/go` throws, say what happened and offer the retry.**
 *
 * The expected failure — Atlas not answering — is handled in the page and
 * never gets here. This is the net under it, so a surprise is an honest
 * sentence and a button rather than the app-wide "Something went badly wrong".
 */
export default function GoError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  useEffect(() => {
    reportError(error, {
      boundary: "go",
      ...(error.digest ? { digest: error.digest } : {}),
    });
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-5">
      <div
        data-testid="go-error"
        role="alert"
        className="w-full max-w-md rounded-2xl p-7 text-center ring-1 ring-black/15 ring-inset"
      >
        <h1 className="text-2xl font-extrabold text-[#111]">
          This day didn&apos;t build
        </h1>
        <p className="mt-2 text-sm text-black/60">
          Something on our side broke while building it. Nothing you saved is
          lost. Try again; if it keeps happening, it has been reported.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 min-h-11 w-full rounded-full bg-[#111] px-5 text-sm font-semibold text-white"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
