import Link from "next/link";
import type { Metadata } from "next";
import { gallery } from "@/lib/design-lab/sample";

/**
 * Always read the live corpus. A prototype prerendered at build time is a
 * prototype showing whatever Atlas happened to hold that afternoon, which is
 * the opposite of what this sandbox is for.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Design lab — three directions" };

/**
 * **Three directions, one corpus, no decision.**
 *
 * Every prototype behind this page renders the **same real Atlas subjects** —
 * the same photograph of Kalamoir Park, the same sentence Atlas holds about
 * it, the same verbs it states. That is the only way the comparison means
 * anything: dressing three mockups in invented places would compare three
 * pieces of copywriting.
 *
 * None of these is production. Nothing here is deployed, and the real
 * `/discovery` is untouched.
 */
const DIRECTIONS = [
  {
    key: "editorial",
    name: "Editorial",
    line: "A premium travel magazine. Paper ground, display serif, asymmetric features, an index for everything without a photograph.",
    distinct:
      "No card grid at all. Numbered features alternate sides; metadata is a byline, not a chip.",
    swatches: ["#fbfaf7", "#15130f", "#a9681f"],
    ink: "#15130f",
    bg: "#fbfaf7",
  },
  {
    key: "cinematic",
    name: "Cinematic",
    line: "Atmospheric and image-led. Full-bleed frames on a near-black ground, type living inside the picture.",
    distinct:
      "Frames, not cards — no border, no radius, no shadow. A subject with no photograph gets type at scale rather than a borrowed image.",
    swatches: ["#0b0d0c", "#ffffff", "#ff9d5c"],
    ink: "#ffffff",
    bg: "#0b0d0c",
  },
  {
    key: "playful",
    name: "Playful",
    line: "Warm and colour-blocked. Chunky geometry, hard shadows, a grotesk throughout — no serif, no cartoons.",
    distinct:
      "The only one that changes the question: it opens with what you could do, and the places follow the verb.",
    swatches: ["#fff6e9", "#1f1a16", "#1f6b4f"],
    ink: "#1f1a16",
    bg: "#fff6e9",
  },
] as const;

export default async function DesignLab() {
  const { featured, rest, total } = await gallery();
  // One real subject, named, so the detail links go somewhere worth looking at.
  const example = featured[0];

  return (
    <main className="min-h-screen bg-[#141414] px-5 py-12 text-white sm:px-10 sm:py-16">
      <div className="mx-auto max-w-[1100px]">
        <p className="text-[11px] tracking-[0.28em] text-white/45 uppercase">
          Passport · design lab · not live
        </p>
        <h1 className="font-heading mt-3 max-w-[20ch] text-[2.4rem] leading-[1] tracking-[-0.03em] text-balance sm:text-[3.6rem]">
          Three directions for Discovery
        </h1>
        <p className="mt-4 max-w-[62ch] text-[15px] leading-relaxed text-white/60">
          All three render the same {total.toLocaleString("en-CA")} real
          subjects from Atlas — the same photographs, the same sentences, the
          same verbs. Nothing is invented, and nothing here is deployed. The
          production Discovery is unchanged at{" "}
          <Link href="/discovery" className="underline underline-offset-4">
            /discovery
          </Link>
          .
        </p>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {DIRECTIONS.map((direction) => (
            <section
              key={direction.key}
              data-testid="direction-card"
              data-direction={direction.key}
              className="flex flex-col rounded-2xl border border-white/12 bg-white/[0.04] p-5"
            >
              <div className="flex items-center gap-2">
                {direction.swatches.map((swatch) => (
                  <span
                    key={swatch}
                    style={{ backgroundColor: swatch }}
                    className="h-5 w-5 rounded-full ring-1 ring-white/20"
                  />
                ))}
              </div>
              <h2 className="font-heading mt-4 text-2xl tracking-[-0.02em]">
                {direction.name}
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-white/65">
                {direction.line}
              </p>
              <p className="mt-3 border-t border-white/10 pt-3 text-[13px] leading-relaxed text-white/45">
                <span className="text-white/70">What makes it distinct — </span>
                {direction.distinct}
              </p>

              <div className="mt-5 flex flex-col gap-2">
                <Link
                  href={`/labs/design/${direction.key}`}
                  style={{
                    backgroundColor: direction.bg,
                    color: direction.ink,
                  }}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl text-sm font-medium"
                >
                  Discovery
                </Link>
                {example && (
                  <Link
                    href={`/labs/design/${direction.key}/${example.id}`}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/20 text-sm text-white/80 hover:border-white/45"
                  >
                    A place — {example.title}
                  </Link>
                )}
              </div>
            </section>
          ))}
        </div>

        <section className="mt-14 border-t border-white/10 pt-8">
          <h2 className="font-heading text-xl tracking-[-0.02em]">
            How to look at these
          </h2>
          <ul className="mt-3 flex max-w-[70ch] list-disc flex-col gap-2 pl-5 text-[14px] leading-relaxed text-white/60">
            <li>
              Check each at <strong className="text-white/85">375px</strong> and
              at desktop width. All three are built mobile-first and the
              differences between them change at width — the editorial grid
              stacks, the cinematic mosaic becomes a sequence of windows.
            </li>
            <li>
              Watch what each does with the{" "}
              <strong className="text-white/85">
                {rest.length}+ subjects Atlas has no photograph for
              </strong>
              . Four in five of the corpus look like that, and it is where a
              direction either stays honest or starts borrowing imagery.
            </li>
            <li>
              The question is not which is prettiest. It is which one still
              works when the content is thin — because most of it is.
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
