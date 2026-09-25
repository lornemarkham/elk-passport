import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  SCENES,
  builtCount,
  interpretationCount,
} from "@/domain/october/sketchbook";
import {
  CONCEPTS,
  DISCARDED,
  NUMBERS,
  OCTOBER_SAYS,
  PROGRESSION,
  QUESTIONS,
  RULES,
  SHE_IS,
  SOUND_NOTES,
} from "@/domain/october/notebook";
import { SoundBench } from "@/components/october/sketchbook/SoundBench";

export const metadata: Metadata = {
  title: "The Sketchbook — October",
  robots: { index: false, follow: false },
};

/**
 * **The sketchbook, opened out into a workbench.**
 *
 * It began as a list of rooms. It is now the whole bench: who October is
 * turning out to be, the things she says, the rules nobody explained, the
 * numbers, the sound, the two big unbuilt ideas, and the questions we cannot
 * answer on our own.
 *
 * ## What this is not
 *
 * Not a deck and not documentation. Somebody opening this should think *this
 * is what they have been messing about with, none of it is finished, come and
 * play* — not *here is the product vision*. Hence fragments over paragraphs,
 * real discarded ideas with the reasons they were dropped, and questions left
 * visibly open rather than quietly answered.
 *
 * ## What was already here and stays
 *
 * The scenes and their readings are untouched, and every one still links to
 * its own page. This grew around them rather than replacing them.
 */

function Band({
  label,
  children,
  aside,
}: {
  readonly label: string;
  readonly children: ReactNode;
  readonly aside?: string;
}) {
  return (
    <section className="mt-24 first:mt-0">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="text-[11px] tracking-[0.3em] text-[#d09a4e] uppercase">
          {label}
        </h2>
        {aside ? (
          <span className="text-xs text-[#e9e6da]/25">{aside}</span>
        ) : null}
      </div>
      <div className="mt-7">{children}</div>
    </section>
  );
}

export default function SketchbookPage() {
  return (
    <main className="min-h-screen bg-[#0c0a0c] text-[#e9e6da]">
      <div className="mx-auto max-w-3xl px-5 pt-14 pb-32 sm:px-8">
        <Link
          href="/october"
          className="text-sm text-[#e9e6da]/35 underline-offset-4 hover:text-[#e9e6da]/70 hover:underline"
        >
          ← back out
        </Link>

        <header className="mt-10">
          <p className="text-[11px] tracking-[0.3em] text-[#d09a4e]/70 uppercase">
            Nothing here is finished
          </p>
          <h1 className="font-heading mt-3 text-5xl tracking-tight text-[#f3efe4] sm:text-6xl">
            The Sketchbook
          </h1>
          <p className="mt-6 max-w-xl leading-relaxed text-[#e9e6da]/60">
            Everything we have been messing about with for October — the rooms,
            the sound, the things she says, and the parts we cannot work out.
            None of it is sacred. Several bits contradict each other on purpose.
          </p>
          <p className="mt-3 max-w-xl leading-relaxed text-[#e9e6da]/35">
            {SCENES.length} scenes · {interpretationCount()} readings ·{" "}
            {builtCount()} you can actually open · 5 pieces of music, no winner.
          </p>

          {/* Its own way in, and not a card — the bench is where the material
              is kept, and that is a walk through it. */}
          <p className="mt-8">
            <Link
              href="/labs/october/for-bryan"
              data-testid="for-bryan-door"
              className="inline-flex min-h-11 items-center text-sm text-[#d09a4e]/80 underline decoration-dotted underline-offset-4 transition-colors hover:text-[#d09a4e]"
            >
              She made something for Bryan.
            </Link>
          </p>
        </header>

        {/* ================================================== WHO SHE IS ==== */}
        <Band label="October" aside="the part we keep getting wrong">
          <p className="max-w-xl leading-relaxed text-[#e9e6da]/70">
            She is not simply a horror character. That is the discovery, and the
            thing most likely to get flattened by anyone arriving late. She is
          </p>
          <p className="font-heading mt-4 text-2xl leading-relaxed text-balance text-[#f3efe4]/90">
            {SHE_IS.map((word, i) => (
              <span key={word}>
                {word}
                {i < SHE_IS.length - 1 ? (
                  <span className="text-[#d09a4e]/40">, </span>
                ) : (
                  "."
                )}
              </span>
            ))}
          </p>

          <div className="mt-12 flex flex-col gap-10">
            {OCTOBER_SAYS.map((f, i) => (
              <div key={i} className="border-l border-[#d09a4e]/25 pl-6">
                {/* Keyed by position, not by text: her name arrives three
                    times in a row and identical keys let React drop one,
                    which would quietly flatten the repetition that fragment
                    is entirely built on. */}
                {f.lines.map((line, j) => (
                  <p
                    key={j}
                    className={
                      f.enormous
                        ? "font-heading text-3xl leading-tight text-[#f3efe4] sm:text-4xl"
                        : "font-heading text-xl leading-snug text-[#f3efe4]/85 sm:text-2xl"
                    }
                  >
                    {line}
                  </p>
                ))}
                {f.when ? (
                  <p className="mt-2 text-xs tracking-wide text-[#e9e6da]/25">
                    {f.when}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </Band>

        {/* ====================================================== RULES ===== */}
        <Band label="The rules" aside="nobody explains any of them">
          <p className="max-w-xl leading-relaxed text-[#e9e6da]/60">
            Not lyrics. Fragments October may whisper — rules for surviving
            somewhere whose logic we do not understand. The moment one of them
            gets a reason, it stops being a rule and becomes a mechanic.
          </p>
          <ul className="mt-8 flex flex-col gap-3">
            {RULES.map((rule) => (
              <li
                key={rule}
                className="font-heading text-lg text-[#e9e6da]/75 sm:text-xl"
              >
                <span className="mr-3 text-[#d09a4e]/35 select-none">—</span>
                {rule}
              </li>
            ))}
          </ul>
        </Band>

        {/* ==================================================== NUMBERS ===== */}
        <Band label="10 / 12 / 31" aside="becoming a language">
          <div className="flex flex-col gap-8">
            {NUMBERS.map((n) => (
              <div key={n.n} className="flex items-baseline gap-6">
                <span className="font-heading w-16 shrink-0 text-5xl text-[#d09a4e] tabular-nums sm:text-6xl">
                  {n.n}
                </span>
                <p className="leading-relaxed text-[#e9e6da]/70">{n.means}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 max-w-xl text-sm leading-relaxed text-[#e9e6da]/40">
            Speech, typography, rhythm, animation, and eventually part of the
            music itself. Right now it is three numbers and a hunch.
          </p>
        </Band>

        {/* ====================================================== SOUND ===== */}
        <Band label="Sound" aside="five experiments, no winner">
          <div className="flex flex-col gap-4">
            {SOUND_NOTES.map((note) => (
              <p
                key={note}
                className="max-w-xl leading-relaxed text-[#e9e6da]/65"
              >
                {note}
              </p>
            ))}
          </div>

          <div className="mt-10">
            <SoundBench />
          </div>

          <p className="mt-14 text-[11px] tracking-[0.25em] text-[#d09a4e]/60 uppercase">
            The shape we are chasing
          </p>
          <ol className="mt-5 flex flex-col gap-2">
            {PROGRESSION.map((step, i) => {
              // The type gets heavier as the floor keeps dropping, and then the
              // last line is the quietest thing on the page.
              const last = i === PROGRESSION.length - 1;
              return (
                <li
                  key={step}
                  className="font-heading leading-tight"
                  style={{
                    fontSize: last ? "1rem" : `${0.95 + i * 0.22}rem`,
                    color: last
                      ? "rgba(233,230,218,0.3)"
                      : `rgba(243,239,228,${0.42 + i * 0.07})`,
                    letterSpacing: step === "BOOM" ? "0.12em" : undefined,
                  }}
                >
                  {step}
                </li>
              );
            })}
          </ol>
        </Band>

        {/* ================================================== THE BIG TWO ==== */}
        <Band label="The two big ones" aside="neither is built">
          <div className="flex flex-col gap-16">
            {CONCEPTS.map((c) => (
              <article key={c.id}>
                <h3 className="font-heading text-3xl text-[#f3efe4]">
                  {c.title}
                </h3>
                <p className="mt-2 text-lg leading-relaxed text-[#d09a4e]/90 italic">
                  {c.hook}
                </p>
                <ul className="mt-6 flex flex-col gap-2">
                  {c.beats.map((b) => (
                    <li
                      key={b}
                      className="leading-relaxed text-[#e9e6da]/70 before:mr-3 before:text-[#d09a4e]/30 before:content-['·']"
                    >
                      {b}
                    </li>
                  ))}
                </ul>
                {c.landsOn ? (
                  <p className="mt-6 border-l border-[#d09a4e]/30 pl-6 leading-relaxed text-[#f3efe4]/85">
                    {c.landsOn}
                  </p>
                ) : null}
                {c.open ? (
                  <p className="mt-5 text-sm leading-relaxed text-[#e9e6da]/40">
                    <span className="text-[#d09a4e]/70">Unresolved — </span>
                    {c.open}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </Band>

        {/* ====================================================== ROOMS ===== */}
        <Band label="Rooms" aside="some of these you can walk into">
          <ul className="flex flex-col gap-3">
            {SCENES.map((scene) => {
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
                    <h3 className="font-heading text-2xl text-[#f3efe4]">
                      {scene.title}
                    </h3>
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
        </Band>

        {/* =================================================== DISCARDED ==== */}
        <Band label="Dropped" aside="so nobody rediscovers them by accident">
          <ul className="flex flex-col gap-7">
            {DISCARDED.map((d) => (
              <li key={d.idea}>
                <p
                  className={`leading-relaxed ${
                    d.revived
                      ? "text-[#e9e6da]/55"
                      : "text-[#e9e6da]/35 line-through decoration-[#e9e6da]/25"
                  }`}
                >
                  {d.idea}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-[#e9e6da]/45">
                  {d.revived ? (
                    <span className="text-[#d09a4e]">Came back — </span>
                  ) : null}
                  {d.why}
                </p>
              </li>
            ))}
          </ul>
        </Band>

        {/* =================================================== QUESTIONS ==== */}
        <Band label="Open" aside="we genuinely do not know">
          <ul className="flex flex-col gap-6">
            {QUESTIONS.map((q) => (
              <li
                key={q}
                className="font-heading text-xl leading-snug text-balance text-[#f3efe4]/80 sm:text-2xl"
              >
                {q}
              </li>
            ))}
          </ul>
          <p className="mt-14 max-w-xl leading-relaxed text-[#e9e6da]/35">
            None of this is sacred. If something here is wrong, it is probably
            wrong — the other reading of it is usually still on the page.
          </p>
        </Band>
      </div>
    </main>
  );
}
