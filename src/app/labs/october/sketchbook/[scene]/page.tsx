import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SCENES, sceneBySlug } from "@/domain/october/sketchbook";

export function generateStaticParams() {
  return SCENES.map((s) => ({ scene: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ scene: string }>;
}): Promise<Metadata> {
  const { scene } = await params;
  const found = sceneBySlug(scene);
  return {
    title: found ? `${found.title} — Sketchbook` : "Sketchbook",
    robots: { index: false, follow: false },
  };
}

/**
 * **One scene, and every reading of it we have had so far.**
 *
 * The idea is written in the language it was first said in, because a
 * paraphrase of *"Come find me. I'm playing in your favourite room."* is a
 * feature description and loses the only thing that made it worth keeping.
 *
 * Readings sit side by side and are never ranked. A built one links out; a
 * sketch says plainly that it is one. Two readings of the same scene are
 * allowed to contradict each other, and at least one pair here does.
 */
export default async function ScenePage({
  params,
}: {
  params: Promise<{ scene: string }>;
}) {
  const { scene: slug } = await params;
  const scene = sceneBySlug(slug);
  if (!scene) notFound();

  return (
    <main className="min-h-screen bg-[#0c0a0c] text-[#e9e6da]">
      <div className="mx-auto max-w-2xl px-5 pt-14 pb-24 sm:px-8">
        <Link
          href="/labs/october/sketchbook"
          className="text-sm text-[#e9e6da]/35 underline-offset-4 hover:text-[#e9e6da]/70 hover:underline"
        >
          ← the sketchbook
        </Link>

        <header className="mt-10">
          <h1 className="font-heading text-4xl tracking-tight text-[#f3efe4] sm:text-5xl">
            {scene.title}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-[#d09a4e]/90 italic">
            {scene.hook}
          </p>
        </header>

        <div className="mt-10 flex flex-col gap-5">
          {scene.body.map((paragraph, i) => (
            <p key={i} className="leading-relaxed text-[#e9e6da]/70">
              {paragraph}
            </p>
          ))}
        </div>

        {/* The actual words. Kept verbatim — this is the part worth keeping. */}
        {scene.quotes && scene.quotes.length > 0 ? (
          <div className="mt-12 flex flex-col gap-4 border-l border-[#d09a4e]/30 pl-6">
            {scene.quotes.map((quote) => (
              <p
                key={quote}
                className="font-heading text-xl leading-snug text-[#f3efe4]/85"
              >
                “{quote}”
              </p>
            ))}
          </div>
        ) : null}

        <section className="mt-16">
          <h2 className="text-[11px] tracking-[0.25em] text-[#d09a4e]/70 uppercase">
            Ways we could build it
          </h2>
          <p className="mt-2 text-sm text-[#e9e6da]/35">
            More than one of these can be true at the same time.
          </p>

          <ul className="mt-6 flex flex-col gap-3">
            {scene.interpretations.map((reading) => {
              const body = (
                <>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="font-heading text-lg text-[#f3efe4]">
                      {reading.title}
                    </p>
                    <span
                      data-testid={`status-${reading.status}`}
                      className={`rounded-full border px-2 py-0.5 text-[10px] tracking-widest uppercase ${
                        reading.status === "built"
                          ? "border-[#d09a4e]/40 text-[#d09a4e]"
                          : "border-[#e9e6da]/15 text-[#e9e6da]/35"
                      }`}
                    >
                      {reading.status === "built" ? "Built" : "Sketch"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-[#e9e6da]/55">
                    {reading.note}
                  </p>
                  {/* Set apart and one to a line, because these are heard
                      rather than read, and the pauses between them are most of
                      the effect. */}
                  {reading.lines && reading.lines.length > 0 ? (
                    <div className="mt-4 flex flex-col gap-1">
                      {reading.lines.map((line) => (
                        <p
                          key={line}
                          className="font-heading text-base leading-snug text-[#f3efe4]/75"
                        >
                          {line}
                        </p>
                      ))}
                    </div>
                  ) : null}
                  {reading.href ? (
                    <p className="mt-3 text-[11px] tracking-widest text-[#d09a4e] uppercase">
                      Open it →
                    </p>
                  ) : null}
                </>
              );

              const shell =
                "block rounded-xl border p-5 transition-colors " +
                (reading.href
                  ? "border-[#e9e6da]/10 bg-[#e9e6da]/[0.03] hover:border-[#d09a4e]/40 hover:bg-[#e9e6da]/[0.06]"
                  : "border-dashed border-[#e9e6da]/10 bg-transparent");

              return (
                <li key={reading.title}>
                  {reading.href ? (
                    <Link
                      href={reading.href}
                      data-testid="sketchbook-reading"
                      className={shell}
                    >
                      {body}
                    </Link>
                  ) : (
                    <div data-testid="sketchbook-reading" className={shell}>
                      {body}
                    </div>
                  )}
                </li>
              );
            })}

            {/* Not a control. A reminder that the list is open. */}
            <li className="rounded-xl border border-dashed border-[#e9e6da]/[0.07] p-5">
              <p className="text-sm text-[#e9e6da]/25 italic">
                Another reading of {scene.title} goes here. It does not have to
                agree with the ones above.
              </p>
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
