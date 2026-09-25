import type { Metadata } from "next";
import Link from "next/link";
import {
  SCENES,
  builtCount,
  interpretationCount,
} from "@/domain/october/sketchbook";

export const metadata: Metadata = {
  title: "The Sketchbook — October",
  robots: { index: false, follow: false },
};

/**
 * **A room full of sketches.**
 *
 * Somewhere for ideas to live between having them and building them, so they
 * stop disappearing into chat history. Rough on purpose: a scene here is a
 * thing we liked the feeling of, not a thing anybody promised.
 *
 * The one rule it exists to protect is that **a scene is not an
 * implementation**. There can be three Witching Hours and two contradictory
 * Scariest Rooms, and adding a fourth reading never replaces the first.
 */
export default function SketchbookPage() {
  const built = builtCount();
  return (
    <main className="min-h-screen bg-[#0c0a0c] text-[#e9e6da]">
      <div className="mx-auto max-w-4xl px-5 pt-14 pb-24 sm:px-8">
        <Link
          href="/october"
          className="text-sm text-[#e9e6da]/35 underline-offset-4 hover:text-[#e9e6da]/70 hover:underline"
        >
          ← back out
        </Link>

        <header className="mt-10">
          <p className="text-[11px] tracking-[0.3em] text-[#d09a4e]/70 uppercase">
            Rooms we have thought about
          </p>
          <h1 className="font-heading mt-3 text-5xl tracking-tight text-[#f3efe4] sm:text-6xl">
            The Sketchbook
          </h1>
          <p className="mt-5 max-w-xl leading-relaxed text-[#e9e6da]/55">
            Ideas kept where they can be found again. Most of these are not
            built and some never will be — a scene can have several readings at
            once, and none of them has to be the right one yet.
          </p>
          <p className="mt-3 text-sm text-[#e9e6da]/30">
            {SCENES.length} scenes · {interpretationCount()} interpretations ·{" "}
            {built} you can actually open
          </p>
        </header>

        <ul className="mt-14 flex flex-col gap-3">
          {SCENES.map((scene, i) => {
            const openable = scene.interpretations.filter(
              (x) => x.status === "built",
            );
            return (
              <li key={scene.slug}>
                <Link
                  href={`/labs/october/sketchbook/${scene.slug}`}
                  data-testid="sketchbook-scene"
                  className="group block rounded-xl border border-[#e9e6da]/10 bg-[#e9e6da]/[0.02] p-6 transition-colors hover:border-[#d09a4e]/40 hover:bg-[#e9e6da]/[0.05]"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <h2 className="font-heading text-2xl text-[#f3efe4]">
                      {scene.title}
                    </h2>
                    {/* Hand-numbered, like pages in a book nobody is indexing. */}
                    <span className="shrink-0 font-mono text-xs text-[#e9e6da]/20">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <p className="mt-2 leading-relaxed text-[#e9e6da]/60 italic">
                    {scene.hook}
                  </p>
                  <p className="mt-4 text-xs tracking-wide text-[#e9e6da]/35">
                    {scene.interpretations.length}{" "}
                    {scene.interpretations.length === 1
                      ? "reading"
                      : "readings"}
                    {openable.length > 0 ? (
                      <span className="text-[#d09a4e]/80">
                        {" "}
                        · {openable.length} built
                      </span>
                    ) : null}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="mt-16 max-w-xl text-sm leading-relaxed text-[#e9e6da]/25">
          Nothing here is a commitment. If an idea turns out to be wrong, the
          other reading of it is probably still on the page.
        </p>
      </div>
    </main>
  );
}
