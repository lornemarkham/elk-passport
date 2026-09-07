import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { FIXTURES } from "@/experience-lab/fixtures";

export const metadata: Metadata = {
  title: "Experience Lab — Passport",
  robots: { index: false, follow: false },
};

/**
 * The specimen shelf.
 *
 * Ordered by what each fixture was written to break, because that is the only
 * interesting thing about a list of five prototypes. Hockey Night built the
 * engine; every fixture below it exists to find out whether the engine is
 * really an engine or just hockey with the labels filed off.
 */
export default function ExperienceLabIndex() {
  return (
    <main className="min-h-dvh bg-[oklch(0.14_0.015_260)] px-5 py-14 text-white">
      <div className="mx-auto max-w-2xl">
        <p className="text-[12.5px] font-medium tracking-[0.14em] text-white/45 uppercase">
          Passport · Experience Lab
        </p>
        <h1 className="font-heading mt-3 text-[clamp(2rem,7vw,3rem)] leading-tight font-bold tracking-tight">
          Atlas understands the world.
          <br />
          Passport understands the experience.
        </h1>
        <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-white/60">
          Five experiences, one engine. Open one, join it, answer something,
          then use the <span className="text-white/85">Lab</span> control in the
          corner to move through the night — before, during, the morning after,
          and the next one.
        </p>

        <ul className="mt-10 flex flex-col gap-3">
          {FIXTURES.map((fixture) => (
            <li key={fixture.slug}>
              <Link
                href={`/labs/experience/${fixture.slug}`}
                className="group block overflow-hidden rounded-2xl border border-white/10 transition hover:border-white/35"
              >
                <div
                  className="px-5 py-5"
                  style={{
                    background: `linear-gradient(110deg, ${fixture.palette[0]} 0%, ${fixture.palette[1]} 70%, oklch(0.16 0.02 260) 100%)`,
                  }}
                >
                  <p className="text-[11.5px] font-medium tracking-[0.14em] text-white/60 uppercase">
                    {fixture.emoji} {fixture.kicker}
                  </p>
                  <p className="font-heading mt-1.5 flex items-center gap-2 text-2xl font-bold tracking-tight">
                    {fixture.title}
                    <ArrowUpRight className="h-4 w-4 opacity-0 transition group-hover:opacity-70" />
                  </p>
                  <p className="mt-0.5 text-[15px] text-white/75">
                    {fixture.subtitle}
                  </p>
                </div>
                <p className="bg-white/[0.03] px-5 py-3 text-[13px] leading-snug text-white/50">
                  {fixture.labNote}
                </p>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-10 text-[12.5px] leading-relaxed text-white/30">
          Everything here is invented and disclosed — no real venue, no real
          person, no Atlas data, no network. State lives in this browser only.
          Findings and open questions are written up in{" "}
          <code className="text-white/45">src/experience-lab/README.md</code>.
        </p>
      </div>
    </main>
  );
}
