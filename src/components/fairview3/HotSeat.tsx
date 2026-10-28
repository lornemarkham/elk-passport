"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { QA_MAX_CHARS, QA_NAME_MAX_CHARS } from "@/lib/fairview3/show";
import type { QaItem, Snapshot } from "@/lib/fairview3/store";
import {
  myName,
  myUpvotes,
  rememberName,
  rememberUpvotes,
} from "./participant";
import { Frame, Headline, Kicker, Line } from "./Sections";
import { Qr } from "./Qr";

export const HOT_SEAT_TITLE = "EXECUTIVE HOT SEAT";
export const HOT_SEAT_LINE =
  "You asked for a presentation. We built you a question box.";

/**
 * **The Hot Seat, on a phone.** A display name and a question, no account.
 * The room sees every question that has not been hidden and upvotes the ones
 * it wants answered; only the presenter puts one on the stage. The team
 * answers out loud. Nothing here calls a model.
 */
export function HotSeatPhone({
  pid,
  snapshot,
  refresh,
}: {
  pid: string;
  snapshot: Snapshot;
  refresh: () => Promise<void>;
}) {
  const [name, setName] = useState(myName);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [mine, setMine] = useState<string[]>(myUpvotes);
  const selected = snapshot.state.qa.selected;

  const ask = async () => {
    if (busy || body.trim().length < 3) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/fairview3/qa", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ participant: pid, name, body }),
      });
      const data = (await res.json().catch(() => ({}))) as { because?: string };
      if (res.ok) {
        rememberName(name.trim());
        setBody("");
        setNote(
          "In the box. The team answers live — upvote what you want first.",
        );
        void refresh();
      } else {
        setNote(data.because ?? "That didn't go through. Try again.");
      }
    } catch {
      setNote("No signal. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (q: QaItem) => {
    const on = !mine.includes(q.id);
    const next = on ? [...mine, q.id] : mine.filter((x) => x !== q.id);
    setMine(next);
    try {
      const res = await fetch("/api/fairview3/qa/upvote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ participant: pid, id: q.id, on }),
      });
      if (!res.ok) throw new Error(String(res.status));
      rememberUpvotes(next);
      void refresh();
    } catch {
      setMine(mine);
    }
  };

  return (
    <Frame mode="phone">
      <Kicker className="text-amber-300">Ask Fairview 3 anything</Kicker>
      <Headline mode="phone" className="mt-2" size="text-[12vw] leading-[0.92]">
        {HOT_SEAT_TITLE}
      </Headline>
      <Line mode="phone" className="mt-3 text-white/75">
        {HOT_SEAT_LINE}
      </Line>
      <input
        value={name}
        onChange={(e) => setName(e.target.value.slice(0, QA_NAME_MAX_CHARS))}
        placeholder="Your name"
        autoComplete="given-name"
        aria-label="Your display name"
        className="fv3-card mt-5 w-full px-4 py-3 text-lg text-white placeholder:text-white/40 focus:ring-2 focus:ring-amber-300 focus:outline-none"
        data-testid="qa-name"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, QA_MAX_CHARS))}
        rows={3}
        placeholder="Your question for the Fairview 3 team"
        aria-label="Your question"
        className="fv3-card mt-3 w-full resize-none px-4 py-3 text-lg text-white placeholder:text-white/40 focus:ring-2 focus:ring-amber-300 focus:outline-none"
        data-testid="qa-body"
      />
      <div className="mt-2 flex items-center justify-between text-sm text-white/50">
        <span>
          {body.length}/{QA_MAX_CHARS}
        </span>
        <button
          type="button"
          onClick={ask}
          disabled={busy || body.trim().length < 3}
          className="fv3-shimmer fv3-display-tight rounded-full px-6 py-3 text-lg text-black disabled:opacity-40"
          data-testid="qa-send"
        >
          Ask it
        </button>
      </div>
      {note && (
        <p className="mt-3 text-sm text-white/80" data-testid="qa-note">
          {note}
        </p>
      )}
      <ul className="mt-6 flex flex-col gap-3" data-testid="qa-list">
        {snapshot.qa.length === 0 && (
          <li className="text-sm text-white/50">
            No questions yet. Be the first on the hot seat.
          </li>
        )}
        {snapshot.qa.map((q) => {
          const voted = mine.includes(q.id);
          return (
            <li
              key={q.id}
              className={`fv3-card flex items-start gap-3 px-4 py-3 ${
                q.id === selected ? "ring-2 ring-amber-300" : ""
              } ${q.status === "answered" ? "opacity-60" : ""}`}
              data-testid="qa-item"
              data-status={q.status}
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs tracking-widest text-white/50 uppercase">
                  {q.name}
                  {q.id === selected && " · on the screen"}
                  {q.status === "answered" && " · answered"}
                </p>
                <p className="mt-1 break-words text-white">{q.body}</p>
              </div>
              <button
                type="button"
                onClick={() => toggle(q)}
                disabled={q.status === "answered"}
                aria-pressed={voted}
                aria-label={`Upvote: ${q.body}`}
                className={`flex shrink-0 flex-col items-center rounded-xl px-3 py-2 text-sm font-bold ring-1 ${
                  voted
                    ? "bg-amber-300 text-black ring-amber-200"
                    : "bg-white/10 text-white ring-white/20"
                }`}
                data-testid="qa-upvote"
              >
                <span aria-hidden>▲</span>
                <span className="tabular-nums" data-testid="qa-votes">
                  {q.votes}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Frame>
  );
}

/**
 * **The Hot Seat, on the projector.** Shows only what the presenter selected:
 * a submission nobody has chosen never reaches the big screen.
 */
export function HotSeatStage({ snapshot }: { snapshot: Snapshot }) {
  const selected = snapshot.qa.find((q) => q.id === snapshot.state.qa.selected);
  const waiting = snapshot.qa.filter((q) => q.status === "visible").length;
  const answered = snapshot.qa.filter((q) => q.status === "answered").length;
  return (
    <Frame mode="stage" className="justify-center">
      <div className="flex items-start justify-between gap-[3vw]">
        <div className="min-w-0">
          <Kicker className="text-amber-300">Ask Fairview 3 anything</Kicker>
          <Headline
            mode="stage"
            className="mt-2"
            size="text-[5.5vw] leading-[0.95]"
          >
            {HOT_SEAT_TITLE}
          </Headline>
          <Line mode="stage" className="mt-2 text-white/70">
            {HOT_SEAT_LINE}
          </Line>
        </div>
        <Qr size={150} />
      </div>
      <div className="mt-[4vh] min-h-[28vh]" data-testid="hotseat-stage">
        {selected ? (
          <motion.div
            key={selected.id}
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="fv3-card px-[3vw] py-[3vh] ring-4 ring-amber-300"
            data-testid="hotseat-selected"
          >
            <p className="fv3-display-tight text-[1.5vw] tracking-[0.25em] text-amber-300 uppercase">
              {selected.name} asks
            </p>
            <p className="fv3-display mt-3 text-[3.6vw] leading-[1.08] break-words">
              {selected.body}
            </p>
            <p className="mt-3 text-[1.4vw] text-white/60">
              ▲ {selected.votes} from the room
            </p>
          </motion.div>
        ) : (
          <div className="fv3-card px-[3vw] py-[3vh]">
            <p className="fv3-display-tight text-[2.4vw] text-white">
              The box is open. Ask on your phone.
            </p>
            <p className="mt-2 text-[1.5vw] text-white/60">
              The team picks one and answers it live.
            </p>
          </div>
        )}
      </div>
      <p
        className="mt-[3vh] text-[1.5vw] text-white/70"
        data-testid="hotseat-counts"
      >
        <b className="fv3-display-tight text-white">{waiting}</b> waiting ·{" "}
        <b className="fv3-display-tight text-white">{answered}</b> answered
      </p>
    </Frame>
  );
}
