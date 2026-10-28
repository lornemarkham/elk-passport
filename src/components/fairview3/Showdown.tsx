"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import {
  TRACKS,
  leaderOf,
  questionById,
  type Track,
  type TrackId,
} from "@/lib/fairview3/show";
import type { Snapshot } from "@/lib/fairview3/store";
import { myVotes, rememberVote } from "./participant";
import { Qr } from "./Qr";
import { Frame, Headline, Kicker, Line, type Mode } from "./Sections";

const Q = questionById("q4");

const LOOK: Record<TrackId, { bar: string; ring: string; text: string }> = {
  metal: {
    bar: "from-red-600 to-fuchsia-500",
    ring: "ring-red-400",
    text: "text-red-300",
  },
  country: {
    bar: "from-amber-500 to-yellow-300",
    ring: "ring-amber-300",
    text: "text-amber-300",
  },
  electroswing: {
    bar: "from-cyan-500 to-emerald-300",
    ring: "ring-cyan-300",
    text: "text-cyan-300",
  },
};

/** The winner as the room should see it: announced wins; else the clear leader once voting stops. */
export function showdownWinner(snapshot: Snapshot): TrackId | null {
  const { showdown, questions } = snapshot.state;
  if (showdown.announced && showdown.winner) return showdown.winner;
  return questions.q4 === "open" ? null : leaderOf(snapshot.tallies.q4);
}

function Bar({
  track,
  n,
  total,
  winner,
  mode,
  mine,
}: {
  track: Track;
  n: number;
  total: number;
  winner: boolean;
  mode: Mode;
  mine?: boolean;
}) {
  const pct = total ? Math.round((n / total) * 100) : 0;
  const stage = mode === "stage";
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-white/8 ${winner ? `ring-4 ${LOOK[track.id].ring}` : ""}`}
      data-testid={`showdown-${track.id}`}
      data-winner={winner}
    >
      <motion.div
        className={`absolute inset-y-0 left-0 bg-gradient-to-r ${LOOK[track.id].bar} opacity-70`}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ type: "spring", stiffness: 60, damping: 18 }}
      />
      <div
        className={`relative flex items-center justify-between gap-3 ${stage ? "px-6 py-4" : "px-4 py-3"}`}
      >
        <div className="min-w-0">
          <p
            className={`fv3-display-tight text-white drop-shadow ${stage ? "text-[2.3vw]" : "text-xl"}`}
          >
            {track.emoji} {track.label}
            {mine && <span className="ml-2 text-white/80">· you</span>}
            {winner && <span className="ml-2">👑</span>}
          </p>
          <p className={`text-white/80 ${stage ? "text-[1.3vw]" : "text-sm"}`}>
            {track.blurb}
          </p>
        </div>
        <span
          className={`fv3-display-tight shrink-0 text-white tabular-nums ${stage ? "text-[2.6vw]" : "text-2xl"}`}
          data-testid={`showdown-pct-${track.id}`}
        >
          {pct}%<span className="ml-2 text-[0.55em] text-white/70">{n}</span>
        </span>
      </div>
    </div>
  );
}

const STATUS_LINE = {
  closed: "Voting isn't open yet. Watch the screen.",
  open: "Tap one. One vote per phone; change your mind while it's open.",
  revealed: "Voting is closed.",
} as const;

/** The showdown ballot on a phone: three loud buttons, live totals under them. */
export function ShowdownPhone({
  snapshot,
  pid,
  refresh,
}: {
  snapshot: Snapshot;
  pid: string;
  refresh: () => Promise<void>;
}) {
  const status = snapshot.state.questions.q4;
  const tally = snapshot.tallies.q4;
  const total = tally.reduce((a, b) => a + b, 0);
  const [mine, setMine] = useState<number | undefined>(() => myVotes().q4);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const winner = showdownWinner(snapshot);
  const announced = snapshot.state.showdown.announced;

  const cast = async (option: number) => {
    if (busy || status !== "open") return;
    setBusy(true);
    setNote(null);
    const was = mine;
    setMine(option);
    try {
      const res = await fetch("/api/fairview3/vote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ participant: pid, question: "q4", option }),
      });
      if (res.ok) {
        rememberVote("q4", option);
        setNote("Locked in.");
        void refresh();
      } else {
        setMine(was);
        setNote(
          res.status === 409
            ? "Voting just closed."
            : "That didn't go through. Try again.",
        );
      }
    } catch {
      setMine(was);
      setNote("No signal. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Frame mode="phone">
      <Kicker className="text-fuchsia-300">The musical showdown</Kicker>
      <Headline mode="phone" className="mt-2" size="text-[10vw] leading-[0.95]">
        {Q.prompt}
      </Headline>
      {announced && winner && (
        <p
          className="fv3-display-tight mt-4 text-2xl text-white"
          data-testid="showdown-announced"
        >
          The room chose {TRACKS.find((t) => t.id === winner)!.label}.
        </p>
      )}
      <ul className="mt-5 flex flex-col gap-3" data-testid="ballot">
        {TRACKS.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              disabled={status !== "open" || busy}
              onClick={() => cast(t.option)}
              aria-pressed={mine === t.option}
              className="block w-full text-left transition active:scale-[0.98] disabled:opacity-90"
              data-testid={`vote-${t.id}`}
            >
              <Bar
                track={t}
                n={tally[t.option] ?? 0}
                total={total}
                winner={winner === t.id}
                mode="phone"
                mine={mine === t.option}
              />
            </button>
          </li>
        ))}
      </ul>
      <Line mode="phone" className="mt-4 text-sm text-white/70">
        <span data-testid="ballot-note">{note ?? STATUS_LINE[status]}</span>
      </Line>
      <p className="mt-2 text-sm text-white/50">
        <span
          className="fv3-display-tight text-white"
          data-testid="phone-total"
        >
          {total}
        </span>{" "}
        votes in
      </p>
    </Frame>
  );
}

/** The showdown on the projector: live bars, the big total, the crown. */
export function ShowdownStage({ snapshot }: { snapshot: Snapshot }) {
  const status = snapshot.state.questions.q4;
  const tally = snapshot.tallies.q4;
  const total = tally.reduce((a, b) => a + b, 0);
  const winner = showdownWinner(snapshot);
  const announced = snapshot.state.showdown.announced && winner;
  return (
    <Frame mode="stage" className="justify-center">
      <Kicker className="text-fuchsia-300">
        The musical showdown ·{" "}
        {status === "open" ? "voting is open" : "voting closed"}
      </Kicker>
      <motion.h1 className="fv3-display mt-3 max-w-[24ch] text-[4vw] leading-[1.02]">
        {Q.prompt}
      </motion.h1>
      <div className="mt-6 grid grid-cols-[1fr_auto] items-start gap-[4vw]">
        <div className="flex flex-col gap-4">
          {TRACKS.map((t) => (
            <Bar
              key={t.id}
              track={t}
              n={tally[t.option] ?? 0}
              total={total}
              winner={winner === t.id}
              mode="stage"
            />
          ))}
          {announced && (
            <motion.p
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`fv3-display fv3-glow-text text-[3.4vw] ${LOOK[winner].text}`}
              data-testid="showdown-announced"
            >
              {TRACKS.find((t) => t.id === winner)!.emoji} THE ROOM HAS SPOKEN:{" "}
              {TRACKS.find((t) => t.id === winner)!.label}
            </motion.p>
          )}
        </div>
        <div className="fv3-card flex flex-col items-center px-8 py-6 text-center">
          <span
            className={`fv3-display text-[5.5vw] ${status === "open" ? "fv3-pulse" : ""}`}
            data-testid="stage-total"
          >
            {total}
          </span>
          <span className="text-[1.4vw] text-white/70">votes in</span>
          <div className="mt-4">
            <Qr size={140} />
          </div>
        </div>
      </div>
    </Frame>
  );
}
