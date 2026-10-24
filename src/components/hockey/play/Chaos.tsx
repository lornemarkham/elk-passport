"use client";

import type { Participant } from "@/experience-lab/core/types";
import {
  KIND_EMOJI,
  type ChaosCard,
  type Game,
  type Settled,
} from "@/domain/hockey/challenges";
import { ChallengeCard, type ChallengeActions } from "./ChallengeCard";
import type { Draft } from "./ThrowDown";
import styles from "../hockey.module.css";

/**
 * **Tonight's chaos.** First, anything waiting on you — a challenge to
 * answer, a performance to deliver, a jury to sit on. Then three things to
 * start, chosen for you from who's here and who they support. Then
 * everything else in play, and what's been settled. Every card is a real
 * person and a real row.
 */
export function Chaos({
  me,
  people,
  fans,
  game,
  now,
  settled,
  cards,
  act,
  beforeHorn,
  onDraft,
}: {
  me: string;
  people: readonly Participant[];
  fans: Readonly<Record<string, string>>;
  game: Game;
  now: Date;
  settled: readonly Settled[];
  cards: readonly ChaosCard[];
  act: ChallengeActions;
  beforeHorn: boolean;
  onDraft: (draft: Draft) => void;
}) {
  const needsYou = settled.filter(
    (s) =>
      (s.challenge.target_id === me && s.challenge.status === "open") ||
      (s.state === "awaiting-entry" && s.challenge.target_id === me) ||
      (s.state === "jury" &&
        s.voting &&
        s.jurors.includes(me) &&
        !s.votes.some((v) => v.voter_id === me)),
  );
  const needIds = new Set(needsYou.map((s) => s.challenge.id));
  const inPlay = settled
    .filter(
      (s) =>
        !needIds.has(s.challenge.id) &&
        (s.state === "waiting" ||
          s.state === "on" ||
          s.state === "jury" ||
          s.state === "awaiting-entry"),
    )
    .reverse();
  const done = settled
    .filter(
      (s) =>
        s.state === "won" ||
        s.state === "lost" ||
        s.challenge.status === "declined",
    )
    .reverse();
  const card = (s: Settled, compact = false) => (
    <ChallengeCard
      key={s.challenge.id}
      s={s}
      me={me}
      people={people}
      fans={fans}
      game={game}
      now={now}
      act={act}
      compact={compact}
    />
  );

  return (
    <section aria-labelledby="chaos-title">
      <h2
        id="chaos-title"
        className={`${styles.display} text-[40px] leading-[0.85] text-white`}
      >
        Tonight&apos;s chaos
      </h2>
      <p className="mt-2 text-[15px] text-white/70">
        Real people, real stakes, no money. Start something — they&apos;ll get
        it the next time they open PLAY.
      </p>

      {needsYou.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[12px] font-extrabold tracking-[0.18em] text-[#ffd84d] uppercase">
            Needs you · {needsYou.length}
          </p>
          <div className="flex flex-col gap-2.5">
            {needsYou.map((s) => card(s))}
          </div>
        </div>
      )}

      {cards.length > 0 && (
        <ul
          className="mt-4 grid gap-2.5 sm:grid-cols-3"
          aria-label="Start something"
        >
          {cards.map((c) => (
            <li key={c.key}>
              <button
                type="button"
                onClick={() =>
                  onDraft({
                    kind: c.kind,
                    targetId: c.targetId,
                    market: c.market,
                    side: c.side,
                  })
                }
                className={`${styles.gamecard} flex h-full w-full flex-col items-start rounded-[22px] p-4 text-left ring-1 ring-white/12 transition hover:ring-white/30 active:scale-[0.99]`}
                style={{
                  ["--tone" as string]:
                    c.kind === "defend"
                      ? "#c8102e"
                      : c.kind === "bet"
                        ? "#1d6fb8"
                        : c.kind === "prophecy"
                          ? "#6d28d9"
                          : "#b8860b",
                }}
              >
                <span className="text-[26px] leading-none" aria-hidden>
                  {KIND_EMOJI[c.kind]}
                </span>
                <span
                  className={`${styles.display} mt-2 text-[26px] leading-[0.9] text-white`}
                >
                  {c.title}
                </span>
                <span className="mt-1.5 flex-1 text-[14.5px] leading-snug text-white/80">
                  {c.pitch}
                </span>
                <span className="mt-3 inline-flex min-h-11 items-center rounded-full bg-[#ffd84d] px-4 text-[14.5px] font-extrabold text-[#0b1220]">
                  {c.cta}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {beforeHorn && people.length > 1 && (
        <button
          type="button"
          onClick={() => onDraft({ kind: "bet" })}
          className="mt-3 min-h-12 w-full rounded-2xl border-2 border-dashed border-white/25 px-4 text-[15px] font-bold text-white transition hover:border-white/50"
        >
          Start something else
        </button>
      )}
      {people.length === 1 && (
        <p className="mt-4 rounded-2xl bg-white/[0.05] px-4 py-3 text-[14.5px] text-white/70">
          Nobody to challenge yet. Invite the others from Group — chaos needs
          company.
        </p>
      )}

      {inPlay.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[12px] font-extrabold tracking-[0.18em] text-white/55 uppercase">
            In play · {inPlay.length}
          </p>
          <div className="flex flex-col gap-2">
            {inPlay.map((s) => card(s, true))}
          </div>
        </div>
      )}
      {done.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[12px] font-extrabold tracking-[0.18em] text-white/55 uppercase">
            Settled · {done.length}
          </p>
          <div className="flex flex-col gap-2">
            {done.slice(0, 4).map((s) => card(s, true))}
          </div>
        </div>
      )}
    </section>
  );
}
