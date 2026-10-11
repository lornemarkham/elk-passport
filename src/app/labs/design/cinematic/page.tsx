import Link from "next/link";
import type { Metadata } from "next";
import { gallery, type Subject } from "@/lib/design-lab/sample";
import { LabNote } from "@/components/design-lab/LabNote";

/**
 * Always read the live corpus. A prototype prerendered at build time is a
 * prototype showing whatever Atlas happened to hold that afternoon, which is
 * the opposite of what this sandbox is for.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Cinematic — design lab" };

/**
 * **DIRECTION TWO — CINEMATIC.**
 *
 * The premise: you are not reading a page, you are looking out of a window.
 * Every possibility is a full-bleed frame with the type living *inside* it,
 * lifted off the image by a gradient scrim rather than a panel.
 *
 * ## What makes it this and not the others
 *
 * - **Dark ground, image-led.** `#0b0d0c` under everything; the photograph is
 *   the surface, not an illustration of it.
 * - **Frames, not cards.** The feed is a vertical sequence of 72vh panels on a
 *   phone, a two-up mosaic on a desktop. There is no border, no radius, no
 *   shadow — the edge of an image is the edge of the object.
 * - **Type over image.** Large, tight, white, with a scrim strong enough to
 *   hold contrast on any photograph (`from-black/85`), because Atlas's
 *   pictures are not art-directed and some are bright.
 * - **One warm signal.** A single ember accent for the verbs, which are the
 *   only coloured thing on a near-monochrome page.
 *
 * ## Honesty
 *
 * The emotional register does not get to invent anything. A subject with no
 * photograph gets a **typographic frame** — its name at scale on the dark
 * ground — rather than a stock image, and the strip at the end says how many
 * of those there are.
 */
export default async function CinematicHome() {
  const { featured, rest, total } = await gallery();
  const [opening, ...frames] = featured;

  return (
    <main className="min-h-screen bg-[#0b0d0c] text-white">
      <LabNote direction="cinematic" tone="dark" />

      {opening && (
        <section className="relative h-[82vh] min-h-[480px] w-full overflow-hidden">
          {opening.heroUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- Atlas-hosted
            <img
              src={opening.heroUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-80"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0d0c] via-[#0b0d0c]/35 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 px-5 pb-10 sm:px-12 sm:pb-16">
            {/* **Not "Tonight in the Okanagan".** This page is not filtered
                to an evening and these are not evening things; a mood is not
                a licence to assert a time. The area is what Atlas states. */}
            <p className="text-[10px] tracking-[0.3em] text-white/75 uppercase drop-shadow-[0_1px_6px_rgba(0,0,0,0.8)]">
              {opening.area ?? opening.place ?? "Around here"}
            </p>
            <h1 className="font-heading mt-3 max-w-[14ch] text-[3rem] leading-[0.92] tracking-[-0.03em] text-balance sm:text-[5.5rem]">
              {opening.title}
            </h1>
            {opening.doing.length > 0 && (
              <p className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-[#ff9d5c]">
                {opening.doing.slice(0, 4).map((doing) => (
                  <span key={doing}>{doing}</span>
                ))}
              </p>
            )}
            <Link
              href={`/labs/design/cinematic/${opening.id}`}
              className="mt-6 inline-flex min-h-11 items-center rounded-full bg-white px-6 text-sm font-medium text-[#0b0d0c] transition-opacity hover:opacity-85"
            >
              Look closer
            </Link>
          </div>
        </section>
      )}

      {/* A mosaic on a wide screen, a sequence of windows on a phone. */}
      <section className="grid grid-cols-1 sm:grid-cols-2">
        {frames.map((subject, index) => (
          <Frame
            key={subject.id}
            subject={subject}
            // Every third frame runs full width, so the rhythm is a cut rather
            // than a grid.
            wide={index % 3 === 0}
          />
        ))}
      </section>

      <Unpictured subjects={rest} total={total} />
    </main>
  );
}

function Frame({
  subject,
  wide,
}: {
  readonly subject: Subject;
  readonly wide: boolean;
}) {
  return (
    <Link
      href={`/labs/design/cinematic/${subject.id}`}
      data-testid="cinematic-frame"
      className={
        "group relative block h-[62vh] min-h-[340px] overflow-hidden " +
        (wide ? "sm:col-span-2 sm:h-[70vh]" : "")
      }
    >
      {subject.heroUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- Atlas-hosted
        <img
          src={subject.heroUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-75 transition-all duration-[1200ms] group-hover:scale-[1.04] group-hover:opacity-95"
        />
      )}
      {/* Strong enough to hold white type on a bright photograph, because
          Atlas's imagery is not art-directed and some of it is snow. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
        {(subject.place ?? subject.area) && (
          <p className="text-[10px] tracking-[0.28em] text-white/60 uppercase">
            {subject.place ?? subject.area}
          </p>
        )}
        <h2
          className={
            "font-heading mt-2 max-w-[18ch] leading-[0.98] tracking-[-0.025em] text-balance " +
            (wide
              ? "text-[2.2rem] sm:text-[3.4rem]"
              : "text-[1.9rem] sm:text-[2.4rem]")
          }
        >
          {subject.title}
        </h2>
        {subject.doing.length > 0 && (
          <p className="mt-2.5 text-[12.5px] text-[#ff9d5c]">
            {subject.doing.slice(0, 3).join("  ·  ")}
          </p>
        )}
        {subject.blurb && wide && (
          <p className="mt-3 max-w-[52ch] text-[13.5px] leading-[1.6] text-white/70">
            {subject.blurb}
          </p>
        )}
      </div>
    </Link>
  );
}

/**
 * **The ones with no photograph get type, not a stock image.**
 *
 * Four subjects in five have no image Atlas will vouch for. A cinematic
 * direction is the one most tempted to fill that with something borrowed, and
 * this is the refusal: their names at scale on the dark ground, and a count.
 */
function Unpictured({
  subjects,
  total,
}: {
  readonly subjects: readonly Subject[];
  readonly total: number;
}) {
  if (subjects.length === 0) return null;
  return (
    <section className="border-t border-white/10 px-5 py-16 sm:px-12 sm:py-24">
      <p className="text-[10px] tracking-[0.3em] text-white/45 uppercase">
        No picture · {total.toLocaleString("en-CA")} known in the region
      </p>
      <ul className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
        {subjects.map((subject) => (
          <li key={subject.id}>
            <Link
              href={`/labs/design/cinematic/${subject.id}`}
              className="font-heading text-[1.4rem] leading-tight tracking-[-0.02em] text-white/45 transition-colors hover:text-white sm:text-[2rem]"
            >
              {subject.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
