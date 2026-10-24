"use client";

import { useState } from "react";
import type { Participant } from "@/experience-lab/core/types";
import {
  KIND_EMOJI,
  KIND_TITLE,
  MARKET_LABEL,
  juryWords,
  kindAsk,
  otherSide,
  sideWords,
  type Game,
  type Settled,
} from "@/domain/hockey/challenges";
import { teamByAbbr } from "@/domain/hockey/fans";
import { relativeTime } from "@/experience-lab/core/phase";
import { FanAvatar } from "../FanTag";
import styles from "../hockey.module.css";

export interface ChallengeActions {
  readonly answer: (
    id: string,
    answer: "accept" | "decline" | "withdraw",
  ) => Promise<boolean>;
  readonly perform: (id: string, entry: string) => Promise<boolean>;
  readonly vote: (id: string, verdict: boolean) => Promise<boolean>;
}

/**
 * **One challenge, as the person looking at it should see it.** The same
 * row reads differently to each of the three people it matters to: the
 * target gets the buttons, the challenger gets the wait, everybody else
 * gets the drama — and the jury gets a vote. Its state is `settle()`'s,
 * the same one the Cup counts.
 */
export function ChallengeCard({
  s,
  me,
  people,
  fans,
  game,
  now,
  act,
  compact = false,
}: {
  s: Settled;
  me: string | null;
  people: readonly Participant[];
  fans: Readonly<Record<string, string>>;
  game: Game;
  now: Date;
  act: ChallengeActions;
  compact?: boolean;
}) {
  const c = s.challenge;
  const challenger = people.find((p) => p.id === c.challenger_id);
  const target = people.find((p) => p.id === c.target_id);
  const [entry, setEntry] = useState("");
  const [busy, setBusy] = useState(false);
  if (!challenger || !target) return null;
  const self = c.challenger_id === c.target_id;
  const mineToAnswer = me === c.target_id && c.status === "open";
  const mineThrown = me === c.challenger_id && !self;
  const name = (p: Participant) => (p.id === me ? "You" : p.name);
  const team = teamByAbbr(fans[c.target_id]);
  const words = juryWords(c.kind);
  const myVote = s.votes.find((v) => v.voter_id === me)?.verdict;
  const juror = me !== null && s.jurors.includes(me);
  const bet = c.kind === "bet" && c.market && c.side;
  const tone =
    c.kind === "bet"
      ? ((c.side === "home"
          ? game.homeTeam
          : c.side === "away"
            ? game.awayTeam
            : null
        )?.colours.primary ?? "#ffd84d")
      : (team?.colours.primary ?? "#c8102e");

  const run = async (f: () => Promise<boolean>) => {
    if (busy) return;
    setBusy(true);
    await f();
    setBusy(false);
  };

  const headline = self
    ? c.kind === "prophecy"
      ? `${name(challenger)} made a prophecy`
      : `${name(challenger)} volunteered`
    : `${name(challenger)} → ${target.id === me ? "you" : target.name}`;

  return (
    <article
      aria-label={`${KIND_TITLE[c.kind]}: ${headline}`}
      className={`${styles.gamecard} ${styles.rise} ${mineToAnswer ? styles.callout : ""} relative overflow-hidden rounded-[24px] p-4 ring-1 ring-white/12`}
      style={{ ["--tone" as string]: tone }}
    >
      <div className="flex items-center gap-3">
        <span className="flex -space-x-2">
          <FanAvatar person={challenger} size={36} />
          {!self && <FanAvatar person={target} size={36} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] font-bold tracking-[0.16em] text-[#ffd84d] uppercase">
            {KIND_EMOJI[c.kind]} {KIND_TITLE[c.kind]}
          </p>
          <p className="truncate text-[16px] font-extrabold text-white">
            {headline}
          </p>
        </div>
        <Status s={s} />
      </div>

      {/* What it is */}
      <p className="mt-3 text-[15.5px] leading-snug text-white/90">
        {bet
          ? `${name(challenger)} ${self ? "" : "say"}${name(challenger) === "You" ? "" : "s"} ${sideWords(c.market!, c.side!, game)}. ${target.id === me ? "You get" : `${target.name} gets`} ${sideWords(c.market!, otherSide(c.market!, c.side!), game)}.`
          : self
            ? kindAsk(c.kind, team?.name)
            : kindAsk(c.kind, team?.name).replace(
                /^/,
                `${target.id === me ? "You" : target.name}: `,
              )}
      </p>
      {c.taunt && (
        <p className="mt-2 border-l-2 border-[#ffd84d]/70 pl-3 text-[14.5px] text-white/75 italic">
          “{c.taunt}”
        </p>
      )}
      {c.entry && (
        <blockquote
          className={`${styles.wide} mt-3 rounded-2xl bg-white/[0.07] px-4 py-3 text-[17px] leading-snug text-white`}
        >
          “{c.entry}”
          <footer className="mt-1 text-[12.5px] font-semibold text-white/55 not-italic">
            — {target.name}
          </footer>
        </blockquote>
      )}

      {/* The target decides */}
      {mineToAnswer && (
        <div className="mt-4 grid grid-cols-[1.4fr_1fr] gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => act.answer(c.id, "accept"))}
            className={`${styles.display} min-h-12 rounded-2xl bg-[#ffd84d] text-[20px] text-[#0b1220] active:scale-[0.98]`}
          >
            Bring it on
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => act.answer(c.id, "decline"))}
            className="min-h-12 rounded-2xl text-[14.5px] font-bold text-white/80 ring-1 ring-white/20"
          >
            Pass quietly
          </button>
          <p className="col-span-2 text-[12.5px] text-white/50">
            Passing costs nothing, and nobody but {challenger.name} is told.
          </p>
        </div>
      )}
      {mineThrown && c.status === "open" && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[13.5px] text-white/60">
            Waiting on {target.name} to accept or pass.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => act.answer(c.id, "withdraw"))}
            className="min-h-11 rounded-full px-4 text-[13.5px] font-semibold text-white/70 ring-1 ring-white/15"
          >
            Take it back
          </button>
        </div>
      )}
      {c.status === "declined" && (
        <p className="mt-3 text-[13.5px] text-white/60">
          {me === c.challenger_id
            ? `${target.name} passed. No penalty, and nobody else saw it.`
            : "You passed. Nobody else was told."}
        </p>
      )}

      {/* The performance */}
      {s.state === "awaiting-entry" && me === c.target_id && (
        <div className="mt-4">
          <label className="block">
            <span className="text-[12px] font-bold tracking-[0.14em] text-white/55 uppercase">
              Your move
            </span>
            <textarea
              value={entry}
              onChange={(e) => setEntry(e.target.value.slice(0, 280))}
              rows={3}
              placeholder={
                c.kind === "defend"
                  ? `Why the ${team?.name ?? "team"} are fine, actually.`
                  : c.kind === "commentary"
                    ? "“HE SHOOTS —”"
                    : "Your most indefensible hockey opinion."
              }
              className="mt-2 w-full rounded-2xl bg-white/[0.07] px-4 py-3 text-[16px] text-white ring-1 ring-white/15 placeholder:text-white/40 focus:ring-2 focus:ring-[#ffd84d] focus:outline-none"
            />
          </label>
          <button
            type="button"
            disabled={busy || !entry.trim()}
            onClick={() => run(() => act.perform(c.id, entry.trim()))}
            className={`${styles.display} mt-2 min-h-12 w-full rounded-2xl bg-[#ffd84d] text-[20px] text-[#0b1220] disabled:opacity-40`}
          >
            Put it on the record
          </button>
        </div>
      )}
      {s.state === "awaiting-entry" && me !== c.target_id && (
        <p className="mt-3 text-[13.5px] text-white/60">
          {target.name} accepted. Waiting on the performance.
        </p>
      )}

      {/* The jury */}
      {(s.state === "jury" || s.state === "won" || s.state === "lost") &&
        c.kind !== "bet" && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[12.5px] font-semibold text-white/60">
              <span>
                The jury: {s.votes.length} of {s.jurors.length}{" "}
                {s.state === "jury" ? "have ruled" : "ruled"}
              </span>
              {s.state === "jury" && s.closesAt && (
                <span>closes {relativeTime(new Date(s.closesAt), now)}</span>
              )}
            </div>
            {s.state === "jury" && juror && s.voting && (
              <div
                className="mt-2 grid grid-cols-2 gap-2"
                role="group"
                aria-label="Your ruling"
              >
                {([true, false] as const).map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    aria-pressed={myVote === v}
                    disabled={busy}
                    onClick={() => run(() => act.vote(c.id, v))}
                    className={`min-h-12 rounded-2xl px-2 text-[15px] font-extrabold transition active:scale-[0.97] ${
                      myVote === v
                        ? v
                          ? "bg-[#0f7a3d] text-white"
                          : "bg-[#c8102e] text-white"
                        : "bg-white/[0.08] text-white ring-1 ring-white/15"
                    }`}
                  >
                    {v ? words.yes : words.no}
                  </button>
                ))}
              </div>
            )}
            {s.state === "jury" && juror && !s.voting && (
              <p className="mt-2 text-[13.5px] text-white/60">
                The jury rules once the puck drops.
              </p>
            )}
            {s.state === "jury" && me === c.target_id && (
              <p className="mt-2 text-[13.5px] text-white/60">
                You can&apos;t judge yourself. Everybody else can.
              </p>
            )}
            {s.votes.length > 0 && !compact && (
              <ul
                className="mt-2 flex flex-wrap gap-1.5"
                aria-label="How the jury ruled"
              >
                {s.votes.map((v) => {
                  const p = people.find((x) => x.id === v.voter_id);
                  return p ? (
                    <li
                      key={v.voter_id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] py-0.5 pr-2.5 pl-0.5 text-[12.5px] text-white/80"
                    >
                      <FanAvatar person={p} size={22} />
                      {v.verdict ? "👍" : "👎"}
                    </li>
                  ) : null;
                })}
              </ul>
            )}
          </div>
        )}

      {c.kind === "bet" && s.state === "on" && c.market && (
        <p className="mt-3 text-[13.5px] text-white/60">
          {me === c.challenger_id
            ? `${target.name} accepted. `
            : me === c.target_id
              ? "You accepted. "
              : ""}
          It&apos;s on. Settles when the host calls{" "}
          {MARKET_LABEL[c.market].toLowerCase()}.
        </p>
      )}
    </article>
  );
}

function Status({ s }: { s: Settled }) {
  const label =
    s.state === "waiting"
      ? "Waiting"
      : s.state === "on"
        ? "Accepted"
        : s.state === "awaiting-entry"
          ? "Accepted"
          : s.state === "jury"
            ? "Jury's out"
            : s.state === "won"
              ? `+${s.points}`
              : s.state === "lost"
                ? "Ruled"
                : s.challenge.status === "declined"
                  ? "Passed"
                  : "Off";
  const hot = s.state === "won";
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-extrabold ${
        hot ? "bg-[#ffd84d] text-[#0b1220]" : "bg-white/[0.1] text-white/80"
      }`}
    >
      {label}
    </span>
  );
}
