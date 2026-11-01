"use client";

import { useState } from "react";
import {
  daysBetween,
  countdownToDay,
  gearFor,
  packedCount,
  reminders,
} from "@/domain/snow/prep";
import { isPacked, personName } from "@/domain/snow/day";
import type { TabProps } from "./tabs";
import { newId } from "./store";
import { Card, btn, field } from "./kit";

/**
 * **Get ready: the day starts before the day.**
 *
 * A countdown, a few reminders that fit how close it is, everyone's packing
 * list and an optional drive-up playlist. It speaks when you open it; it
 * never sends anything.
 */
export function HypeTab({ day, me, act, today, now }: TabProps) {
  const [song, setSong] = useState("");
  const cd = countdownToDay(now, day);
  const daysOut = day.date ? daysBetween(today, day.date) : undefined;
  const list = reminders(day, daysOut);
  const mine = gearFor(me);

  return (
    <div className="space-y-4">
      <Card className="space-y-2">
        <h2 className="text-xl font-extrabold">
          {!cd
            ? "Pick a date to start the countdown"
            : cd.past
              ? "It's snow day."
              : "Until the mountain"}
        </h2>
        {cd && !cd.past && (
          <p className="text-5xl font-black tabular-nums">
            {cd.units.map((u) => (
              <span key={u.unit} className="mr-4">
                {u.value}
                <span className="ml-1 text-base font-semibold text-[var(--sn-frost)]">
                  {u.unit}
                </span>
              </span>
            ))}
          </p>
        )}
        {day.people.length > 1 && (
          <p className="text-sm text-[var(--sn-frost)]">
            {day.people.length} in: {day.people.map((p) => p.name).join(", ")}.
          </p>
        )}
      </Card>

      <Card className="space-y-2">
        <h2 className="text-xl font-extrabold">Right now</h2>
        {list.length === 0 ? (
          <p className="text-sm text-[var(--sn-frost)]">
            Nothing to do. That&apos;s allowed.
          </p>
        ) : (
          <ul className="space-y-1.5 text-sm" data-testid="reminders">
            {list.map((r) => (
              <li key={r.id} className="flex gap-2">
                <span aria-hidden="true">•</span>
                {r.text}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-3" data-testid="gear">
        <h2 className="text-xl font-extrabold">Your gear, {me.name}</h2>
        <p className="text-sm text-[var(--sn-frost)]">
          {packedCount(day, me).done} of {packedCount(day, me).total} packed
        </p>
        <ul className="space-y-1">
          {mine.map((g) => {
            const on = isPacked(day, me.id, g.id);
            return (
              <li key={g.id}>
                <label className="flex min-h-11 items-start gap-3 py-1">
                  <input
                    type="checkbox"
                    className="mt-1 size-5"
                    checked={on}
                    onChange={(e) =>
                      act({
                        type: "pack",
                        personId: me.id,
                        itemId: g.id,
                        on: e.target.checked,
                      })
                    }
                  />
                  <span>
                    <span
                      className={
                        on ? "line-through opacity-70" : "font-semibold"
                      }
                    >
                      {g.label}
                      {!me.ownGear && g.rentable && (
                        <span className="ml-2 text-xs text-[var(--sn-glow)]">
                          rent?
                        </span>
                      )}
                    </span>
                    <span className="block text-xs text-[var(--sn-frost)]">
                      {g.why}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </Card>

      {day.people.length > 1 && (
        <Card className="space-y-2">
          <h2 className="text-xl font-extrabold">Everyone&apos;s packing</h2>
          <ul className="space-y-1 text-sm">
            {day.people.map((p) => (
              <li key={p.id} className="flex justify-between">
                <span>{p.name}</span>
                <span className="text-[var(--sn-frost)]">
                  {packedCount(day, p).done}/{packedCount(day, p).total}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-[var(--sn-frost)]">
            Only what this phone knows.
          </p>
        </Card>
      )}

      <Card className="space-y-3">
        <h2 className="text-xl font-extrabold">
          Drive-up playlist{" "}
          <span className="text-sm font-normal text-[var(--sn-frost)]">
            optional
          </span>
        </h2>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (act({ type: "song", id: newId(), title: song, by: me.id }))
              setSong("");
          }}
        >
          <input
            className={`${field} flex-1`}
            value={song}
            onChange={(e) => setSong(e.target.value)}
            placeholder="A song for the car"
            aria-label="Add a song"
            maxLength={80}
          />
          <button className={btn} type="submit">
            Add
          </button>
        </form>
        <ul className="space-y-1 text-sm">
          {day.playlist.map((s) => (
            <li key={s.id} className="flex items-center justify-between">
              <span>
                ♪ {s.title}{" "}
                <span className="text-xs text-[var(--sn-frost)]">
                  — {personName(day, s.by)}
                </span>
              </span>
              <button
                className="px-2"
                aria-label={`Remove ${s.title}`}
                onClick={() => act({ type: "removeSong", id: s.id })}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <p className="text-xs text-[var(--sn-frost)]">
          A list of titles to play from your own music app. Passport
          doesn&apos;t play audio.
        </p>
      </Card>
    </div>
  );
}
