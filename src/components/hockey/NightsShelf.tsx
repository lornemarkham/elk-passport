"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { zoneOr, type GameChoice } from "@/domain/hockey/schedule";
import { editionLabel } from "@/domain/hockey/edition";
import type { Cup } from "@/domain/hockey/series";
import { CupRoll } from "./CupRoll";
import { StartNight } from "./StartNight";

interface Night {
  readonly id: string;
  readonly title: string;
  readonly startsAt: string;
  readonly role: "host" | "guest";
  readonly members: number;
  readonly home: string;
  readonly opponent: string;
  readonly venue: string;
  readonly timeZone?: string;
  readonly cup?: string;
  readonly series: string;
  readonly edition: number;
  readonly over: boolean;
}

const when = (iso: string, timeZone?: string) =>
  new Date(iso).toLocaleString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: zoneOr(timeZone),
  });

function NightCard({ night }: { night: Night }) {
  return (
    <Link
      href={`/hockey/${night.id}`}
      className="block rounded-2xl border border-white/15 bg-white/[0.04] p-4 transition hover:border-white/40"
    >
      <p className="text-[17px] font-medium">
        🏒 {night.title}
        {night.edition > 1 && (
          <span className="text-white/45">
            {" "}
            · {editionLabel(night.edition)}
          </span>
        )}
      </p>
      <p className="mt-0.5 text-[14px] text-white/70">
        {night.home} vs {night.opponent} · {night.venue}
      </p>
      <p className="mt-1 text-[13px] text-white/55">
        {when(night.startsAt, night.timeZone)} · {night.members} in ·{" "}
        {night.role === "host" ? "you're hosting" : "you're invited"}
      </p>
    </Link>
  );
}

/**
 * **Your nights.** What's coming, the Cup, and what already happened.
 *
 * M216's shelf was one night and a button that started that night; once you
 * hosted it, the button went away. A tradition needs more than one — so the
 * button stays, the coming nights come first, and the past ones sit under
 * the Cup they were played for.
 */
export function NightsShelf({
  nights,
  cups,
  name,
  gone,
  suggestion,
  gameId,
  via,
}: {
  nights: readonly Night[];
  cups: readonly Cup[];
  name: string;
  gone: boolean;
  suggestion: GameChoice;
  /** A game chosen on a public hockey page: the form opens on it. */
  gameId?: number;
  /** Which public page sent the person here, carried to the start request. */
  via?: string;
}) {
  const [starting, setStarting] = useState(
    nights.length === 0 || gameId !== undefined,
  );
  useEffect(() => {
    if (gameId !== undefined)
      document.getElementById("start")?.scrollIntoView({ block: "start" });
  }, [gameId]);
  const upcoming = nights.filter((n) => !n.over);
  const past = nights.filter((n) => n.over).reverse();

  return (
    <main className="min-h-dvh bg-[oklch(0.14_0.015_260)] px-5 pt-14 pb-24 text-white">
      <div className="mx-auto max-w-md">
        <p className="flex items-center justify-between text-[13px] tracking-wide text-white/45 uppercase">
          <span>My Hockey Nights</span>
          <Link
            href="/hockey"
            className="inline-flex min-h-11 items-center tracking-normal text-white/60 normal-case hover:text-white"
          >
            Scores & standings →
          </Link>
        </p>
        <h1 className="mt-1 font-serif text-[32px] leading-tight">
          {nights.length ? `Your nights, ${name}.` : `Nothing on yet, ${name}.`}
        </h1>
        {nights.length === 0 && (
          <p className="mt-2 text-[15px] leading-snug text-white/70">
            Hockey is better with your crew. Pick a game, start the night, send
            one link per friend. The questions, the picks, the Cup and the
            awards come with it.
          </p>
        )}
        {gone && (
          <p role="status" className="mt-3 text-[14px] text-white/60">
            That night isn&apos;t yours to see any more.
          </p>
        )}

        {upcoming.length > 0 && (
          <section aria-label="Coming up" className="mt-6">
            <h2 className="text-[12px] tracking-wide text-white/40 uppercase">
              Coming up
            </h2>
            <ul className="mt-2 flex flex-col gap-3">
              {upcoming.map((n) => (
                <li key={n.id}>
                  <NightCard night={n} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <div
          id="start"
          className="mt-8 scroll-mt-6 rounded-2xl border border-dashed border-white/20 p-5"
        >
          <p className="text-[16px] font-medium">Start a Hockey Night</p>
          {starting ? (
            <>
              <p className="mt-1 mb-4 text-[14px] text-white/55">
                Any NHL game, any arena. Start it, then invite people one link
                at a time.
              </p>
              <StartNight
                suggestion={suggestion}
                name={name}
                cta="Start it"
                {...(gameId !== undefined ? { gameId } : {})}
                {...(via ? { via } : {})}
              />
            </>
          ) : (
            <>
              <p className="mt-1 text-[14px] text-white/55">
                Another game, another guest list. Every night keeps its own
                picks, its own chat and its own winner.
              </p>
              <button
                type="button"
                onClick={() => setStarting(true)}
                className="mt-4 w-full rounded-full border border-white/30 py-3 text-[15px] font-semibold text-white transition hover:border-white/60"
              >
                Start another night
              </button>
            </>
          )}
        </div>

        {cups.map((cup) => (
          <section
            key={cup.series}
            aria-label={`The ${cup.name ?? "Sycle Cup"}`}
            className="mt-10"
          >
            <CupRoll cup={cup} />
          </section>
        ))}

        {past.length > 0 && (
          <section aria-label="Already happened" className="mt-10">
            <h2 className="text-[12px] tracking-wide text-white/40 uppercase">
              Already happened
            </h2>
            <ul className="mt-2 flex flex-col gap-3">
              {past.map((n) => (
                <li key={n.id}>
                  <NightCard night={n} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
