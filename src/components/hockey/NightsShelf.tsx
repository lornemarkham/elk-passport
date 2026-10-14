"use client";

import { useState } from "react";
import Link from "next/link";

interface Night {
  readonly id: string;
  readonly title: string;
  readonly startsAt: string;
  readonly role: "host" | "guest";
  readonly members: number;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Vancouver",
  });

/**
 * Your nights, and the one button that starts Sycle Hockey Night.
 *
 * Not a create-an-event form. The night is already written — the opponent,
 * the puck drop, the questions, the jokes — and starting it is one tap, the
 * same instinct as the lab's curator setup: the less the host has to author,
 * the sooner anybody else is having fun.
 */
export function NightsShelf({
  nights,
  name,
  gone,
}: {
  nights: readonly Night[];
  name: string;
  gone: boolean;
}) {
  const [starting, setStarting] = useState(false);
  // Asked here for the same reason the join page asks: the host's name is on
  // the roster, on the leaderboard and in "Will ___ buy a $19 arena beer?",
  // and an email address in that blank is not a joke anybody laughs at.
  const [hostName, setHostName] = useState(name);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setStarting(true);
    setError(null);
    const res = await fetch("/hockey/api/occasions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: hostName.trim() || undefined }),
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
    <main className="min-h-dvh bg-[oklch(0.14_0.015_260)] px-5 pt-14 pb-24 text-white">
      <div className="mx-auto max-w-md">
        <p className="text-[13px] tracking-wide text-white/45 uppercase">
          Hockey Night
        </p>
        <h1 className="mt-1 font-serif text-[32px] leading-tight">
          {nights.length ? `Your nights, ${name}.` : `Nothing on yet, ${name}.`}
        </h1>
        {gone && (
          <p role="status" className="mt-3 text-[14px] text-white/60">
            That night isn&apos;t yours to see any more.
          </p>
        )}

        <ul className="mt-6 flex flex-col gap-3">
          {nights.map((n) => (
            <li key={n.id}>
              <Link
                href={`/hockey/${n.id}`}
                className="block rounded-2xl border border-white/15 bg-white/[0.04] p-4 transition hover:border-white/40"
              >
                <p className="text-[17px] font-medium">🏒 {n.title}</p>
                <p className="mt-1 text-[13px] text-white/55">
                  {when(n.startsAt)} · {n.members} in ·{" "}
                  {n.role === "host" ? "you're hosting" : "you're invited"}
                </p>
              </Link>
            </li>
          ))}
        </ul>

        {!nights.some((n) => n.role === "host") && (
          <div className="mt-8 rounded-2xl border border-dashed border-white/20 p-5">
            <p className="text-[16px] font-medium">Sycle Hockey Night</p>
            <p className="mt-1 text-[14px] text-white/55">
              Canucks vs Wild · Rogers Arena · Sunday 25 October, 7pm. Start it,
              then invite people one link at a time.
            </p>
            <label className="mt-4 block text-[13px] text-white/55">
              What should everyone call you?
              <input
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                maxLength={40}
                aria-label="Your name"
                className="mt-1.5 w-full rounded-full border border-white/20 bg-black/20 px-4 py-2.5 text-[15px] text-white focus:border-white/50 focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => void start()}
              disabled={starting}
              className="mt-4 w-full rounded-full bg-white py-3 text-[15px] font-semibold text-black disabled:opacity-50"
            >
              {starting ? "Starting…" : "Start it"}
            </button>
            {error && (
              <p role="alert" className="mt-2 text-[13px] text-white/70">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
