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
 * **Six directions, one corpus, no decision.**
 *
 * Every prototype behind this page renders the **same real Atlas subjects** —
 * the same photograph of Kalamoir Park, the same sentence Atlas holds about
 * it, the same verbs it states. That is the only way the comparison means
 * anything: dressing three mockups in invented places would compare three
 * pieces of copywriting.
 *
 * None of these is the product. They are reachable so they can be opened on a
 * phone, which is not the same as being chosen — and the real `/discovery` is
 * untouched either way.
 */
interface Direction {
  readonly key: string;
  readonly href: string;
  readonly name: string;
  readonly line: string;
  readonly distinct: string;
  readonly swatches: readonly string[];
  readonly ink: string;
  readonly bg: string;
}

/** Round two, built from what round one taught us. Newest first. */
const ROUND_TWO: readonly Direction[] = [
  {
    key: "editorial-cinematic",
    href: "/labs/design/v2/editorial-cinematic",
    name: "Editorial Cinematic",
    line: "Cinematic's photographs on Editorial's bones, over a warm sandstone ground. Headlines lift over the lower edge of the picture.",
    distinct:
      "Type and image are one object, not two boxes. Verbs become chapter rules. No shadow, no border, no radius anywhere.",
    swatches: ["#efe7da", "#241d15", "#9a5f1c"],
    ink: "#241d15",
    bg: "#efe7da",
  },
  {
    key: "immersive-explorer",
    href: "/labs/design/v2/immersive-explorer",
    name: "Immersive Explorer",
    line: "Photography leads and the page moves sideways. Each activity is a horizontal rail of deliberately unequal tiles on ink-teal.",
    distinct:
      "The answer to the endless vertical wall: you travel across an activity instead of scrolling past it, and every activity fits one screen.",
    swatches: ["#0e1a1c", "#ffffff", "#7fe3c4"],
    ink: "#ffffff",
    bg: "#0e1a1c",
  },
  {
    key: "travel-journal",
    href: "/labs/design/v2/travel-journal",
    name: "Modern Travel Journal",
    line: "Someone's beautifully designed notebook. Numbered entries, a margin that carries the town and the verbs, photographs set as inset plates.",
    distinct:
      "The only one with a margin, and the only one in an italic serif voice. A plate in a book rather than a hero image.",
    swatches: ["#f6f1e6", "#2a2620", "#4f6b3f"],
    ink: "#2a2620",
    bg: "#f6f1e6",
  },
];

/** Round one, kept exactly as it was. */
const ROUND_ONE: readonly Direction[] = [
  {
    key: "editorial",
    href: "/labs/design/editorial",
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
    href: "/labs/design/cinematic",
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
    href: "/labs/design/playful",
    name: "Playful",
    line: "Warm and colour-blocked. Chunky geometry, hard shadows, a grotesk throughout — no serif, no cartoons.",
    distinct:
      "The only round-one direction that changes the question: it opens with what you could do, and the places follow the verb.",
    swatches: ["#fff6e9", "#1f1a16", "#1f6b4f"],
    ink: "#1f1a16",
    bg: "#fff6e9",
  },
];

export default async function DesignLab() {
  const { featured, rest, total } = await gallery();
  // One real subject, named, so the detail links go somewhere worth looking at.
  const example = featured[0];

  return (
    <main className="min-h-screen bg-[#141414] px-5 py-12 text-white sm:px-10 sm:py-16">
      <div className="mx-auto max-w-[1100px]">
        <p className="text-[11px] tracking-[0.28em] text-white/45 uppercase">
          Passport · design lab · exploration
        </p>
        <h1 className="font-heading mt-3 max-w-[20ch] text-[2.4rem] leading-[1] tracking-[-0.03em] text-balance sm:text-[3.6rem]">
          Six directions for Discovery
        </h1>
        <p className="mt-4 max-w-[62ch] text-[15px] leading-relaxed text-white/60">
          All six render the same {total.toLocaleString("en-CA")} real subjects
          from Atlas — the same photographs, the same sentences, the same verbs.
          Nothing is invented. These are explorations rather than decisions, and
          the production Discovery is unchanged at{" "}
          <Link href="/discovery" className="underline underline-offset-4">
            /discovery
          </Link>
          .
        </p>

        <Round
          title="Round two"
          note="Built from the round-one feedback: keep the big photographs and the sophistication, lose the heavy shadows and thick borders."
          directions={ROUND_TWO}
          example={example}
        />
        <Round
          title="Round one"
          note="Preserved exactly as built, so the comparison is against something real rather than a memory."
          directions={ROUND_ONE}
          example={example}
        />

        <section className="mt-14 border-t border-white/10 pt-8">
          <h2 className="font-heading text-xl tracking-[-0.02em]">
            How to look at these
          </h2>
          <ul className="mt-3 flex max-w-[70ch] list-disc flex-col gap-2 pl-5 text-[14px] leading-relaxed text-white/60">
            <li>
              Check each at <strong className="text-white/85">375px</strong> and
              at desktop width. All six are built mobile-first and the
              differences between them change at width — Travel Journal&apos;s
              margin folds above the entry, Immersive Explorer&apos;s rails
              become thumb-width, Editorial Cinematic&apos;s spreads stack.
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

function Round({
  title,
  note,
  directions,
  example,
}: {
  readonly title: string;
  readonly note: string;
  readonly directions: readonly Direction[];
  readonly example?: { readonly id: string; readonly title: string };
}) {
  return (
    <section className="mt-12">
      <div className="flex items-baseline gap-4">
        <h2 className="font-heading text-xl tracking-[-0.02em]">{title}</h2>
        <span className="h-px flex-1 bg-white/12" />
      </div>
      <p className="mt-2 max-w-[70ch] text-[13.5px] leading-relaxed text-white/50">
        {note}
      </p>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {directions.map((direction) => (
          <article
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
            <h3 className="font-heading mt-4 text-2xl tracking-[-0.02em]">
              {direction.name}
            </h3>
            <p className="mt-2 text-[14px] leading-relaxed text-white/65">
              {direction.line}
            </p>
            <p className="mt-3 border-t border-white/10 pt-3 text-[13px] leading-relaxed text-white/45">
              <span className="text-white/70">What makes it distinct — </span>
              {direction.distinct}
            </p>

            <div className="mt-auto flex flex-col gap-2 pt-5">
              <Link
                href={direction.href}
                style={{ backgroundColor: direction.bg, color: direction.ink }}
                className="inline-flex min-h-11 items-center justify-center rounded-xl text-sm font-medium"
              >
                Discovery
              </Link>
              {example && (
                <Link
                  href={`${direction.href}/${example.id}`}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/20 px-3 text-center text-sm text-white/80 hover:border-white/45"
                >
                  A place — {example.title}
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
