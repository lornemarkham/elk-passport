"use client";

import { useState } from "react";
import Link from "next/link";
import { History, Repeat } from "lucide-react";
import { Surface } from "@/experience-lab/ui/atoms";
import type { LiveExperience } from "@/experience-lab/core/engine";
import { editionLabel } from "@/domain/hockey/edition";
import type { ModuleId } from "@/domain/hockey/modules";
import type { GameChoice } from "@/domain/hockey/schedule";
import type { SeriesView } from "@/domain/hockey/series";
import { CupRoll } from "./CupRoll";
import { StartNight } from "./StartNight";

/**
 * **What the last one is still holding over everybody.**
 *
 * The lab's `InheritedMemory`, fed by the server instead of localStorage:
 * the receipts are found in what actually happened last time — the worst
 * surviving score call, what somebody still owes, who won the vault, who
 * finished last — and nobody wrote any of them. Points are not carried.
 */
export function LastTime({
  series,
  live,
  className = "mx-auto max-w-2xl px-5 pt-2",
}: {
  series: SeriesView;
  live: LiveExperience;
  className?: string;
}) {
  const lineage = series.lastTime;
  if (!lineage) return null;
  // Only ever somebody on tonight's page; `lastTime` already made sure.
  const champion = live.participants.find(
    (p) => p.id === lineage.defendingChampionId,
  );

  return (
    <section aria-label="Last time" className={className}>
      <div className="rounded-2xl border border-white/12 bg-white/[0.04] p-4">
        <p className="flex items-center gap-2 text-[12px] tracking-wide text-white/40 uppercase">
          <History className="h-3.5 w-3.5" />
          Last time · {lineage.previousLabel}
        </p>
        <p className="mt-2 text-[15px] font-semibold text-white">
          {champion
            ? `${champion.emoji} ${champion.name} is defending the Sycle Cup.`
            : lineage.callback}
        </p>
        {champion && (
          <p className="mt-0.5 text-[13.5px] text-white/55">
            {lineage.callback}
          </p>
        )}
        {(lineage.receipts ?? []).length > 0 && (
          <ul className="mt-2 flex flex-col gap-1.5 border-l-2 border-white/15 pl-3">
            {(lineage.receipts ?? []).map((line) => (
              <li
                key={line}
                className="text-[13.5px] leading-snug text-white/60"
              >
                {line}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[12px] text-white/55">
          Carried over from the last one. Points were not.
        </p>
      </div>
    </section>
  );
}

/**
 * **Run it back.** The lab called it "the single highest-value unbuilt
 * thing", built it in round 2, and the shared night hid it. Here it is.
 *
 * Anyone who was at this night can start the next one, and whoever does
 * hosts it — the person who says "again?" first is the person organising
 * it. If somebody already has, and you are on it, this just takes you there.
 */
export function RunItBack({
  live,
  series,
  suggestion,
  modules,
}: {
  live: LiveExperience;
  series: SeriesView;
  suggestion: GameChoice;
  /** What this night had in it; the next one starts the same. */
  modules: readonly ModuleId[];
}) {
  const [open, setOpen] = useState(false);
  const champion = live.settled ? live.standings[0] : undefined;
  const me = live.me;

  return (
    <Surface>
      <p className="font-heading text-xl font-semibold text-white">
        {live.definition.emoji} Now go have another.
      </p>
      <p className="mt-1 text-[14px] text-white/60">
        There is a next one. There is always a next one.
      </p>
      {champion && champion.points > 0 && (
        <p className="mt-2 text-[14.5px] text-white/70">
          {champion.participant.name} goes into the next one as defending
          champion, which they will mention.
        </p>
      )}

      {series.next ? (
        <Link
          href={`/hockey/${series.next.id}`}
          className="mt-4 inline-flex min-h-10 items-center rounded-full bg-white px-4 text-[14px] font-semibold text-black"
        >
          <Repeat className="mr-1.5 h-4 w-4" />
          {editionLabel(series.next.edition)} is on — go
        </Link>
      ) : open && me ? (
        <div className="mt-4">
          <StartNight
            suggestion={suggestion}
            name={me.name}
            after={live.definition.slug}
            modules={modules}
            cta={`Start ${editionLabel(series.edition + 1)}`}
          />
          <p className="mt-2 text-[12px] text-white/35">
            You host it. Fresh points, same Cup — and this night&apos;s receipts
            on the first page.
          </p>
        </div>
      ) : (
        me && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-4 inline-flex min-h-10 items-center rounded-full bg-white px-4 text-[14px] font-semibold text-black"
          >
            <Repeat className="mr-1.5 h-4 w-4" />
            Start the next one
          </button>
        )
      )}

      <p className="mt-3 text-[13px] text-white/45">
        Or not hockey at all:{" "}
        <Link
          href="/discovery"
          className="inline-flex min-h-8 items-center text-white/75 underline underline-offset-4 hover:text-white"
        >
          go have a day
        </Link>
        .
      </p>

      {series.cup.nights.length > 0 && (
        <div className="mt-5">
          <CupRoll cup={series.cup} currentId={live.definition.slug} />
        </div>
      )}
    </Surface>
  );
}
