"use client";

import { useState } from "react";
import type { LiveExperience } from "@/experience-lab/core/engine";
import {
  CHALLENGE_CAP,
  POINTS,
  TEAM_REACTIONS,
  TEAM_REACTION_WORDS,
  isCupLine,
  type Settled,
  type TeamReactionRow,
} from "@/domain/hockey/challenges";
import type { CupStatus } from "@/domain/hockey/cup";
import { FanAvatar, TeamChip, useFan } from "../FanTag";
import { Trophy } from "./Trophy";
import styles from "../hockey.module.css";

const COUNT_WORDS = [
  "No",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
];

/**
 * **The Sycle Cup.** The trophy, everybody competing for it in their own
 * colours, their points and where every point came from — the same table
 * on every phone, because it is computed from rows everybody reads alike.
 * Before anything is settled it says so and says what comes next, rather
 * than drawing a scoreboard of zeroes and calling it a game. It names a
 * champion only once `cupStatus` says the night is verified.
 */
export function CupBoard({
  live,
  status,
  settled,
  reactions,
  onReact,
  available,
}: {
  live: LiveExperience;
  status: CupStatus;
  settled: readonly Settled[];
  reactions: readonly TeamReactionRow[];
  onReact?: (targetId: string, emoji: string | null) => void;
  /** Challenges exist on this database (so their points are explained). */
  available: boolean;
}) {
  const me = live.me?.id ?? null;
  const table = live.standings;
  const n = live.participants.length;
  const [first, second] = table;
  const tied = Boolean(first && second && first.points === second.points);
  const champion =
    status.verified && first && first.points > 0 && !tied ? first : null;
  const sharedTitle = status.verified && tied && first && first.points > 0;

  return (
    <section aria-labelledby="cup-title" className="relative">
      <div className="flex items-end gap-4">
        <Trophy size={78} glow={Boolean(champion)} />
        <div className="min-w-0 pb-1">
          <h2
            id="cup-title"
            className={`${styles.display} text-[40px] leading-[0.85] text-white`}
          >
            The Sycle Cup
          </h2>
          <p className="mt-1.5 text-[15px] leading-snug text-white/75">
            {COUNT_WORDS[n] ?? n} {n === 1 ? "competitor" : "competitors"}. One
            extremely questionable trophy.
          </p>
        </div>
      </div>

      {champion && <Champion standing={champion} second={second} live={live} />}
      {sharedTitle && (
        <p className="mt-4 rounded-2xl bg-[#ffd84d]/15 px-4 py-3 text-[15px] font-bold text-white">
          🏆 The Sycle Cup is shared:{" "}
          {table
            .filter((s) => s.points === first!.points)
            .map((s) => s.participant.name)
            .join(" & ")}
          , {first!.points} points each.
        </p>
      )}

      <p className="mt-4 text-[14px] text-white/70">
        {!status.scoring
          ? status.over
            ? "Nobody has a point yet — the host's calls decide it."
            : "No points on the board yet, and none invented. They arrive when bets settle, juries rule and the host calls the game."
          : status.verified
            ? "Final. Every call is in, every jury has ruled."
            : status.over
              ? `Provisional — still waiting on ${status.waitingOn.slice(0, 2).join(" and ")}${status.waitingOn.length > 2 ? ` and ${status.waitingOn.length - 2} more` : ""}.`
              : "Live standings. Nothing is final until the horn and the host's calls."}
      </p>

      <ol className="mt-3 flex flex-col gap-2" aria-label="Standings">
        {table.map((row, i) => (
          <Competitor
            key={row.participant.id}
            place={status.scoring ? i + 1 : null}
            row={row}
            me={me}
            settled={settled}
            reactions={reactions.filter((r) => r.to_id === row.participant.id)}
            mine={
              reactions.find(
                (r) => r.from_id === me && r.to_id === row.participant.id,
              )?.emoji ?? null
            }
            onReact={onReact}
            leader={
              status.scoring && row.points > 0 && row.points === first?.points
            }
          />
        ))}
      </ol>

      <HowPoints live={live} available={available} />
    </section>
  );
}

function Competitor({
  place,
  row,
  me,
  settled,
  reactions,
  mine,
  onReact,
  leader,
}: {
  place: number | null;
  row: LiveExperience["standings"][number];
  me: string | null;
  settled: readonly Settled[];
  reactions: readonly TeamReactionRow[];
  mine: string | null;
  onReact?: (targetId: string, emoji: string | null) => void;
  leader: boolean;
}) {
  const p = row.participant;
  const team = useFan(p.id);
  const [open, setOpen] = useState(false);
  const isMe = p.id === me;
  const between = settled.filter(
    (s) =>
      me &&
      !isMe &&
      (s.state === "waiting" ||
        s.state === "on" ||
        s.state === "jury" ||
        s.state === "awaiting-entry") &&
      ((s.challenge.challenger_id === me && s.challenge.target_id === p.id) ||
        (s.challenge.target_id === me && s.challenge.challenger_id === p.id)),
  ).length;
  const tally = TEAM_REACTIONS.map((e) => ({
    emoji: e,
    count: reactions.filter((r) => r.emoji === e).length,
  })).filter((t) => t.count > 0);

  return (
    <li
      className={`relative overflow-hidden rounded-[20px] px-3.5 py-3 ring-1 ${leader ? "ring-[#ffd84d]/70" : "ring-white/10"}`}
      style={{
        background: team
          ? `linear-gradient(100deg, color-mix(in srgb, ${team.colours.primary} 55%, #0b1220) 0%, #0e1628 70%)`
          : "rgba(255,255,255,0.05)",
      }}
    >
      <div className="flex items-center gap-3">
        <span
          className={`${styles.display} w-6 text-center text-[22px] text-white/60 tabular-nums`}
        >
          {place ?? "–"}
        </span>
        <FanAvatar person={p} size={40} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate text-[16.5px] font-extrabold text-white">
            {p.name}
            {isMe && (
              <span className="text-[12px] font-semibold text-white/55">
                you
              </span>
            )}
            {leader && <span aria-label="Leading">👑</span>}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12.5px] text-white/65">
            {team ? <TeamChip team={team} /> : <span>No team declared</span>}
            {between > 0 && <span>⚔️ {between} with you</span>}
            {tally.map((t) => (
              <span key={t.emoji} title={TEAM_REACTION_WORDS[t.emoji]}>
                {t.emoji}
                {t.count > 1 ? t.count : ""}
              </span>
            ))}
          </p>
        </div>
        <span
          className={`${styles.display} text-[34px] leading-none text-white tabular-nums`}
          aria-label={`${row.points} points`}
        >
          {row.points}
        </span>
      </div>

      {row.lines.length > 0 && (
        <ul
          className="mt-2 flex flex-wrap gap-1.5 pl-9"
          aria-label={`Where ${p.name}'s points came from`}
        >
          {row.lines.slice(-4).map((l) => (
            <li
              key={l.promptId}
              className="rounded-full bg-black/30 px-2.5 py-1 text-[12px] font-semibold text-white/85"
            >
              +{l.points} {isCupLine(l.promptId) ? l.note : l.note}
            </li>
          ))}
        </ul>
      )}

      {onReact && me && !isMe && team && (
        <div className="mt-2 pl-9">
          {open ? (
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label={`React to ${p.name}'s ${team.name}`}
            >
              {TEAM_REACTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  aria-pressed={mine === e}
                  onClick={() => {
                    onReact(p.id, mine === e ? null : e);
                    setOpen(false);
                  }}
                  className={`inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-[13px] font-bold ${
                    mine === e
                      ? "bg-white text-[#0b1220]"
                      : "bg-black/30 text-white ring-1 ring-white/15"
                  }`}
                >
                  <span aria-hidden>{e}</span> {TEAM_REACTION_WORDS[e]}
                </button>
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-black/25 px-3 text-[13px] font-semibold text-white/85 ring-1 ring-white/12"
            >
              {mine ? `${mine} You reacted` : `React to the ${team.name}`}
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function Champion({
  standing,
  second,
  live,
}: {
  standing: LiveExperience["standings"][number];
  second?: LiveExperience["standings"][number];
  live: LiveExperience;
}) {
  const team = useFan(standing.participant.id);
  const primary = team?.colours.primary ?? "#ffd84d";
  const secondary = team?.colours.secondary ?? "#0b1220";
  void live;
  return (
    <section
      aria-labelledby="cup-champion"
      className={`${styles.rise} relative mt-4 overflow-hidden rounded-[26px] p-5 text-white ring-2 ring-[#ffd84d]`}
      style={{
        background: `linear-gradient(150deg, ${primary}, ${secondary} 60%, #0b1220)`,
      }}
    >
      {Array.from({ length: 14 }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className={styles.confetti}
          style={{
            background:
              i % 3 === 0 ? "#ffd84d" : i % 3 === 1 ? primary : "#ffffff",
            ["--dx" as string]: `${Math.round(Math.cos(i) * 160)}px`,
            ["--dy" as string]: `${Math.round(Math.sin(i * 1.7) * 120)}px`,
            ["--spin" as string]: `${i * 47}deg`,
            animationDelay: `${(i % 5) * 60}ms`,
          }}
        />
      ))}
      <p className="text-[12px] font-extrabold tracking-[0.2em] text-[#ffd84d] uppercase">
        Sycle Cup champion
      </p>
      <div className="mt-2 flex items-center gap-4">
        <span className={styles.crest}>
          <FanAvatar person={standing.participant} size={68} />
        </span>
        <div className="min-w-0">
          <h3
            id="cup-champion"
            className={`${styles.display} text-[42px] leading-[0.9] [overflow-wrap:anywhere]`}
          >
            {standing.participant.name}
          </h3>
          <p className="mt-1 text-[15px] font-semibold text-white/90">
            {standing.points} points · verified
          </p>
        </div>
      </div>
      {second && (
        <p className="mt-3 text-[14.5px] text-white/85">
          {second.participant.name} was {standing.points - second.points}{" "}
          {standing.points - second.points === 1 ? "point" : "points"} behind
          and will be hearing about it.
        </p>
      )}
    </section>
  );
}

/** Every way to score tonight, from tonight's own questions and rules. */
function HowPoints({
  live,
  available,
}: {
  live: LiveExperience;
  available: boolean;
}) {
  const picks = live.prompts
    .filter(
      (p) =>
        p.prompt.scoring &&
        !p.prompt.scoring.shared &&
        !isCupLine(p.prompt.id) &&
        (p.prompt.family !== "mission" || p.open || p.myResponse),
    )
    .map((p) => ({
      id: p.prompt.id,
      what: p.prompt.scoring!.label ?? short(p.prompt.question),
      points: `+${p.prompt.scoring!.points}${p.prompt.scoring!.partial ? `/${p.prompt.scoring!.partial.points}` : ""}`,
    }))
    .sort((a, b) => parseInt(b.points.slice(1)) - parseInt(a.points.slice(1)));
  if (picks.length === 0 && !available) return null;
  return (
    <details className="group mt-4 rounded-2xl bg-white/[0.05] ring-1 ring-white/10">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-[15px] font-bold text-white">
        How to win the Cup
        <span className="text-[13px] font-semibold text-white/55 group-open:hidden">
          {picks.length + (available ? 4 : 0)} ways to score
        </span>
      </summary>
      <ul className="flex flex-col gap-1.5 px-4 pb-4 text-[14px]">
        {picks.map((s) => (
          <li key={s.id} className="flex items-baseline gap-3">
            <span className="w-14 shrink-0 font-extrabold text-[#ffd84d] tabular-nums">
              {s.points}
            </span>
            <span className="min-w-0 flex-1 text-white/85">{s.what}</span>
          </li>
        ))}
        {available && (
          <>
            <li className="flex items-baseline gap-3">
              <span className="w-14 shrink-0 font-extrabold text-[#ffd84d]">
                +{POINTS.bet}
              </span>
              <span className="text-white/85">
                Win a bet (the host&apos;s call settles it)
              </span>
            </li>
            <li className="flex items-baseline gap-3">
              <span className="w-14 shrink-0 font-extrabold text-[#ffd84d]">
                +{POINTS.performance}
              </span>
              <span className="text-white/85">
                Convince the jury: defend your team, commentate, a hot take
              </span>
            </li>
            <li className="flex items-baseline gap-3">
              <span className="w-14 shrink-0 font-extrabold text-[#ffd84d]">
                +{POINTS.prophecy}
              </span>
              <span className="text-white/85">
                A prophecy the jury says came true
              </span>
            </li>
            <li className="flex items-baseline gap-3">
              <span className="w-14 shrink-0 font-extrabold text-[#ffd84d]">
                +5–8
              </span>
              <span className="text-white/85">
                A secret mission, once its mastermind confirms it
              </span>
            </li>
          </>
        )}
        <li className="mt-1 text-[13px] text-white/60">
          {available &&
            `Challenges count up to ${CHALLENGE_CAP} points a night, and two missions. `}
          Nobody judges their own: you can&apos;t vote on your own performance,
          answer the question you asked, or confirm your own mission. Chat
          volume scores nothing. Bragging rights only — no money.
        </li>
      </ul>
    </details>
  );
}

function short(q: string): string {
  return q.length > 60 ? `${q.slice(0, 57).trimEnd()}…` : q;
}
