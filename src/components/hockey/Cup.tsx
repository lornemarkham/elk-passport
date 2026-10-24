"use client";

import { Crown } from "lucide-react";
import type { LiveExperience } from "@/experience-lab/core/engine";
import { FanAvatar, useFan } from "./FanTag";
import styles from "./hockey.module.css";

/**
 * **How to win the Sycle Cup, without reading rules.** Every question on
 * this night that scores, with what it's worth, from the night's own
 * questions — so a mission somebody added shows up here too. Talking in the
 * chat scores nothing, and a vote on your own photo is refused by the server.
 */
export function HowToWin({ live }: { live: LiveExperience }) {
  const scoring = live.prompts
    .filter((p) => p.prompt.scoring && !p.prompt.scoring.shared)
    // A secret mission is only listed to the person it's for.
    .filter((p) => p.prompt.family !== "mission" || p.open || p.myResponse)
    .map((p) => ({
      id: p.prompt.id,
      what: p.prompt.scoring!.label ?? shortQuestion(p.prompt.question),
      points: p.prompt.scoring!.points,
      partial: p.prompt.scoring!.partial?.points,
      done: p.myResponse !== undefined,
    }))
    .sort((a, b) => b.points - a.points);
  const shared = live.prompts.filter((p) => p.prompt.scoring?.shared);
  if (scoring.length === 0) return null;
  return (
    <details className="group rounded-2xl bg-white/[0.05] ring-1 ring-white/10">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-[15px] font-bold text-white">
        How to win the Cup
        <span className="text-[13px] font-semibold text-white/55 group-open:hidden">
          {scoring.length} ways to score
        </span>
      </summary>
      <ul className="flex flex-col gap-1.5 px-4 pb-4 text-[14px]">
        {scoring.map((s) => (
          <li key={s.id} className="flex items-baseline gap-3">
            <span className="w-14 shrink-0 font-extrabold text-[#ffd84d] tabular-nums">
              +{s.points}
              {s.partial ? `/${s.partial}` : ""}
            </span>
            <span className="min-w-0 flex-1 text-white/85">{s.what}</span>
            {s.done && (
              <span className="shrink-0 text-[12px] font-semibold text-white/50">
                in
              </span>
            )}
          </li>
        ))}
        {shared.length > 0 && (
          <li className="mt-1 text-[13px] text-white/60">
            Plus {shared.map((p) => p.prompt.scoring!.points).join(" / ")} for
            everyone when the group pulls something off together.
          </li>
        )}
        <li className="mt-1 text-[13px] text-white/60">
          Points come from what actually happens, once it&apos;s called. Chat
          volume scores nothing. Bragging rights only — no money.
        </li>
      </ul>
    </details>
  );
}

function shortQuestion(q: string): string {
  return q.length > 60 ? `${q.slice(0, 57).trimEnd()}…` : q;
}

/**
 * **The Sycle Cup goes to…** Once the game is over and something has been
 * called, the leader crowned in their own team's colours. A tie is said as a
 * tie: the Cup is not handed out by alphabetical order.
 */
export function CupChampion({ live }: { live: LiveExperience }) {
  const [first, second] = live.standings;
  const called = live.prompts.some(
    (p) => p.prompt.scoring && p.prompt.resolution !== undefined,
  );
  const team = useFan(first?.participant.id);
  if (!first || !called || first.points <= 0) return null;
  const tied = second && second.points === first.points;
  const winners = tied
    ? live.standings.filter((s) => s.points === first.points)
    : [first];
  const primary = team?.colours.primary ?? "#ffd84d";
  const secondary = team?.colours.secondary ?? "#0b1220";
  return (
    <section
      aria-labelledby="cup-champion"
      className={`${styles.rise} relative overflow-hidden rounded-[26px] p-5 text-white ring-2 ring-[#ffd84d]`}
      style={{
        background: tied
          ? "linear-gradient(150deg,#3a2f0b,#0b1220 70%)"
          : `linear-gradient(150deg, ${primary}, ${secondary} 60%, #0b1220)`,
      }}
    >
      <p className="flex items-center gap-2 text-[12px] font-bold tracking-[0.16em] text-[#ffd84d] uppercase">
        <Crown className="h-4 w-4" aria-hidden />
        {tied ? "The Sycle Cup is shared" : "Sycle Cup champion"}
      </p>
      <div className="mt-3 flex items-center gap-4">
        <span className={`${styles.crest} flex -space-x-3`}>
          {winners.slice(0, 3).map((w) => (
            <FanAvatar
              key={w.participant.id}
              person={w.participant}
              size={64}
            />
          ))}
        </span>
        <div className="min-w-0">
          <h2
            id="cup-champion"
            className={`${styles.display} text-[34px] leading-[0.95] [overflow-wrap:anywhere] [text-shadow:0_2px_16px_rgba(0,0,0,0.4)]`}
          >
            {winners.map((w) => w.participant.name).join(" & ")}
          </h2>
          <p className="mt-1 text-[15px] font-semibold text-white/85">
            {first.points} points
            {first.lines.length > 0 &&
              ` · ${first.lines
                .slice(0, 3)
                .map((l) => l.note)
                .join(", ")}`}
          </p>
        </div>
      </div>
      {!tied && second && (
        <p className="mt-3 text-[14px] text-white/75">
          {second.participant.name} was {first.points - second.points}{" "}
          {first.points - second.points === 1 ? "point" : "points"} behind and
          will be hearing about it.
        </p>
      )}
    </section>
  );
}
