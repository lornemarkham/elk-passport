"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { reportError } from "@/lib/observability/report";

/**
 * **When October breaks, it should still sound like October.**
 *
 * Everything under `/october` lands here instead of an unstyled Next.js stack
 * trace. Two things matter and they are different things: the person gets a
 * dark page in October's own voice with one action that helps, and *we* find
 * out it happened — which until now we did not, for any failure, anywhere in
 * the product.
 *
 * `digest` is Next's own id for the matching server log line, so a report from
 * a browser can be tied to the stack trace that caused it.
 */
export default function OctoberError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    reportError(error, {
      boundary: "october",
      ...(pathname ? { route: pathname } : {}),
      ...(error.digest ? { digest: error.digest } : {}),
    });
  }, [error, pathname]);

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-5">
      <div className="w-full max-w-md text-center">
        <p className="text-[11px] tracking-[0.22em] text-[#d09a4e] uppercase">
          Something went wrong
        </p>
        <h1 className="font-heading mt-3 text-3xl leading-tight text-[#f3efe4]">
          October lost its place.
        </h1>
        <p className="mt-3 leading-relaxed text-[#e9e6da]/55">
          Nothing you have chosen is lost — it is kept on our side, not in this
          page. Try again, and if it keeps happening we will see it from here.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center rounded-full bg-[#d09a4e] px-6 text-sm text-[#15100a] transition-colors hover:bg-[#e0ad63]"
          >
            Try again
          </button>
          <Link
            href="/october/discover"
            className="inline-flex min-h-11 items-center text-sm text-[#e9e6da]/50 underline-offset-4 hover:text-[#e9e6da] hover:underline"
          >
            Back to Discover
          </Link>
        </div>
        {error.digest ? (
          <p className="mt-8 text-[11px] tracking-[0.14em] text-[#e9e6da]/20 uppercase">
            Reference {error.digest}
          </p>
        ) : null}
      </div>
    </main>
  );
}
