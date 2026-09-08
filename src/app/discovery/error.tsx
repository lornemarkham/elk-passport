"use client";

/**
 * When Atlas cannot be reached.
 *
 * Says what actually went wrong and offers the one action that helps. The
 * failure this replaces was an unstyled Next.js stack trace containing an
 * undici `HeadersTimeoutError`, which tells a traveller nothing and tells them
 * it in a frightening way.
 */
export default function DiscoveryError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#ecdfc4] px-5">
      <div className="w-full max-w-md rounded-2xl border border-[#8a5a24]/20 bg-white/60 p-7 text-center">
        <h1 className="font-serif text-2xl text-[#2c1f10]">
          Passport couldn&apos;t reach Atlas
        </h1>
        <p className="mt-2 text-sm text-[#6b5637]">
          Nothing is wrong with your account, and nothing you saved is lost.
          Atlas is where the places come from, and it did not answer in time.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 min-h-11 w-full rounded-full bg-[#8a5a24] px-5 text-sm font-medium text-white"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
