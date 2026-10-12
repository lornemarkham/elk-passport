import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Labs — Passport",
  robots: { index: false, follow: false },
};

const DOORS = [
  {
    href: "/labs/conference",
    emoji: "🎪",
    kicker: "Go have a conference",
    title: "Everyone's going to be in the same place",
    note: "Start one, send your people a link, and see who's in. Needs a Passport account.",
  },
  {
    href: "/labs/experience",
    emoji: "🧪",
    kicker: "Experience Lab",
    title: "Five experiences, one engine",
    note: "Invented fixtures. State lives in this browser only.",
  },
] as const;

/** Things that work, that we're playing with, that aren't in the nav yet. */
export default function LabsIndex() {
  return (
    <main className="min-h-dvh bg-[oklch(0.14_0.015_260)] px-5 py-14 text-white">
      <div className="mx-auto max-w-2xl">
        <p className="text-[12.5px] font-medium tracking-[0.14em] text-white/45 uppercase">
          Passport · Labs
        </p>
        <h1 className="font-heading mt-3 text-[clamp(2rem,7vw,3rem)] leading-tight font-bold tracking-tight">
          Things we&apos;re playing with.
        </h1>
        <ul className="mt-10 flex flex-col gap-3">
          {DOORS.map((door) => (
            <li key={door.href}>
              <Link
                href={door.href}
                className="group block rounded-2xl border border-white/10 px-5 py-5 transition hover:border-white/35"
              >
                <p className="text-[11.5px] font-medium tracking-[0.14em] text-white/60 uppercase">
                  {door.emoji} {door.kicker}
                </p>
                <p className="font-heading mt-1.5 flex items-center gap-2 text-2xl font-bold tracking-tight">
                  {door.title}
                  <ArrowUpRight className="h-4 w-4 opacity-0 transition group-hover:opacity-70" />
                </p>
                <p className="mt-1 text-[14px] text-white/55">{door.note}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
