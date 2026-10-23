"use client";

import { useState } from "react";
import {
  OPPONENTS,
  toRequest,
  vancouverWallClock,
} from "@/domain/hockey/schedule";
import { matchupOf } from "@/domain/hockey/teams";
import type { SharedNight } from "./useSharedNight";
import styles from "./hockey.module.css";

const field =
  "mt-1.5 block w-full min-w-0 rounded-full border border-white/20 bg-black/20 px-4 py-2.5 text-[15px] text-white focus:border-white/50 focus:outline-none [color-scheme:dark]";

/**
 * **The host's two big switches: the game, and the night itself.**
 *
 * Change who the Canucks play or when (every lock moves with puck drop and
 * nobody's answers are lost), or cancel the night, which takes everything on
 * it with it and so asks twice. The game cannot be changed once it has
 * started; the night can still be cancelled.
 */
export function HostGame({ night }: { night: SharedNight }) {
  const { definition, state } = night;
  const started =
    new Date(definition.anchorAt).getTime() <= night.live.now.getTime();
  const { away } = matchupOf(definition.subtitle);
  const clock = vancouverWallClock(definition.anchorAt);
  const [opponent, setOpponent] = useState(away);
  const [date, setDate] = useState(clock.date);
  const [time, setTime] = useState(clock.time);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sure, setSure] = useState(false);

  async function save() {
    const game = toRequest({ opponent, date, time });
    if (!game) {
      setMessage("That isn't a date and time.");
      return;
    }
    setSaving(true);
    setMessage(null);
    const res = await fetch(`/hockey/api/occasions/${state.slug}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(game),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) window.location.reload();
    else {
      setMessage(body.error ?? "Couldn't change it.");
      setSaving(false);
    }
  }

  async function cancel() {
    const res = await fetch(`/hockey/api/occasions/${state.slug}`, {
      method: "DELETE",
    });
    if (res.ok) window.location.href = "/hockey";
    else {
      setMessage("Couldn't cancel it.");
      setSure(false);
    }
  }

  return (
    <section aria-labelledby="host-game">
      <h2
        id="host-game"
        className={`${styles.wide} text-[28px] leading-none text-white`}
      >
        The game
      </h2>
      <p className="mt-2 text-[15px] text-white/70">
        Only you can change this.{" "}
        {started
          ? "The game has started, so who and when are fixed."
          : "Picks, votes and chat stay exactly as they are; the locks move with puck drop."}
      </p>
      {!started && (
        <form
          className="mt-4 rounded-[22px] bg-white/[0.07] p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label className="block text-[13px] text-white/60">
            Canucks vs
            <input
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
              list="host-opponents"
              maxLength={30}
              aria-label="Opponent"
              className={field}
            />
            <datalist id="host-opponents">
              {OPPONENTS.map((o) => (
                <option key={o.name} value={o.name} />
              ))}
            </datalist>
          </label>
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,8rem)] gap-2">
            <label className="block text-[13px] text-white/60">
              Date
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                aria-label="Game date"
                className={field}
              />
            </label>
            <label className="block text-[13px] text-white/60">
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
          <button
            type="submit"
            disabled={saving}
            className="mt-4 min-h-11 w-full rounded-full bg-white py-2.5 text-[15px] font-semibold text-black disabled:opacity-50"
          >
            {saving ? "Saving…" : "Change the game"}
          </button>
        </form>
      )}
      {message && (
        <p role="alert" className="mt-2 text-[14px] text-[#ffb4b4]">
          {message}
        </p>
      )}
      <div className="mt-3">
        {sure ? (
          <div className="rounded-2xl border border-[#ff7a7a]/50 p-3">
            <p className="text-[14px] text-white/85">
              Cancel this night for everyone? The picks, votes, chat and photos
              go with it. This can&apos;t be undone.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => void cancel()}
                className="min-h-11 rounded-full bg-[#ff7a7a] px-4 text-[14px] font-semibold text-[#2a0a0a]"
              >
                Yes, cancel the night
              </button>
              <button
                type="button"
                onClick={() => setSure(false)}
                className="min-h-11 rounded-full border border-white/25 px-4 text-[14px] text-white"
              >
                Keep it
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setSure(true)}
            className="min-h-11 rounded-full border border-white/25 px-4 text-[14px] text-white/80"
          >
            Cancel this night
          </button>
        )}
      </div>
    </section>
  );
}
