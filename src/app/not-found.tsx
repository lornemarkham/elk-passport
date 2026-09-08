import Link from "next/link";
import { Compass } from "lucide-react";

/** Every unknown URL, including a mistyped board or place id. */
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#ecdfc4] px-5">
      <div className="w-full max-w-md rounded-2xl border border-[#8a5a24]/20 bg-white/60 p-7 text-center">
        <Compass className="mx-auto h-8 w-8 text-[#8a5a24]" aria-hidden />
        <h1 className="mt-3 font-serif text-2xl text-[#2c1f10]">
          There&apos;s nothing at this address
        </h1>
        <p className="mt-2 text-sm text-[#6b5637]">
          The link may be old, or the page may belong to somebody else.
        </p>
        <Link
          href="/discovery"
          className="mt-6 inline-flex min-h-11 items-center rounded-full bg-[#8a5a24] px-5 text-sm font-medium text-white"
        >
          Go to Discovery
        </Link>
      </div>
    </main>
  );
}
