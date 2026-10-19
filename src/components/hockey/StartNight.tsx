"use client";

import { useState } from "react";
import {
  OPPONENTS,
  toRequest,
  type GameChoice,
} from "@/domain/hockey/schedule";

const field =
  "mt-1.5 block w-full min-w-0 rounded-full border border-white/20 bg-black/20 px-4 py-2.5 text-[15px] text-white focus:border-white/50 focus:outline-none [color-scheme:dark]";

/**
 * **Which game, and what should everyone call you.** That is the whole form.
 *
 * Not a create-an-event form. The night is already written — the questions,
 * the jokes, the toy box, the awards — so the host says only the two things
 * Passport cannot know: who the Canucks are playing, and when. Everything
 * else is the same night it always is, which is the point of a tradition.
 *
 * `after` makes it the next night of a run ("Run it back"): same Cup, fresh
 * points, last time's receipts on the page.
 */
export function StartNight({
  suggestion,
  name,
  after,
  cta,
}: {
  suggestion: GameChoice;
  name: string;
  after?: string;
  cta: string;
}) {
  const [opponent, setOpponent] = useState(suggestion.opponent);
  const [date, setDate] = useState(suggestion.date);
  const [time, setTime] = useState(suggestion.time);
  // Asked here for the same reason the join page asks: the host's name is on
  // the roster, on the leaderboard and in "Will ___ buy a $19 arena beer?",
  // and an email address in that blank is not a joke anybody laughs at.
  const [hostName, setHostName] = useState(name);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    // Converted here, by the same time-zone database that will display it.
    const game = toRequest({ opponent, date, time });
    if (!game) {
      setError("That isn't a date and time.");
      return;
    }
    setStarting(true);
    const res = await fetch("/hockey/api/occasions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: hostName.trim() || undefined,
        game,
        after,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Couldn't start it.");
      setStarting(false);
      return;
    }
    window.location.href = `/hockey/${body.id}`;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void start();
      }}
    >
      <label className="block text-[13px] text-white/55">
        Canucks vs
        <input
          value={opponent}
          onChange={(e) => setOpponent(e.target.value)}
          list="hockey-opponents"
          maxLength={30}
          placeholder="Who are they playing?"
          aria-label="Opponent"
          className={field}
        />
        <datalist id="hockey-opponents">
          {OPPONENTS.map((o) => (
            <option key={o.name} value={o.name} />
          ))}
        </datalist>
      </label>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,8rem)] gap-2">
        <label className="block text-[13px] text-white/55">
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Game date"
            className={field}
          />
        </label>
        <label className="block text-[13px] text-white/55">
          Puck drop
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            aria-label="Puck drop time"
            className={field}
          />
        </label>
      </div>
      <p className="mt-1.5 text-[12px] text-white/35">
        Rogers Arena, Vancouver time. Home games only for now — Passport only
        knows how far things are from this one arena.
      </p>
      <label className="mt-4 block text-[13px] text-white/55">
        What should everyone call you?
        <input
          value={hostName}
          onChange={(e) => setHostName(e.target.value)}
          maxLength={40}
          aria-label="Your name"
          className={field}
        />
      </label>
      <button
        type="submit"
        disabled={starting}
        className="mt-4 w-full rounded-full bg-white py-3 text-[15px] font-semibold text-black disabled:opacity-50"
      >
        {starting ? "Starting…" : cta}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-white/70">
          {error}
        </p>
      )}
    </form>
  );
}
