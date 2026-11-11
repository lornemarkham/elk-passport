"use client";

import { useEffect, useState } from "react";
import {
  longDate,
  registrationCountdown,
  spacesWords,
} from "@/lib/courtqueue/countdown";
import type { LiveView, SessionListing } from "@/lib/courtqueue/view";
import { Btn, Card, cx } from "./bits";

/** The server's time, re-read every `every` ms so a countdown moves. */
export function useNow(offset: number, every = 15_000) {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    const tick = () => setNow(Date.now() + offset);
    tick();
    const t = setInterval(tick, every);
    return () => clearInterval(t);
  }, [offset, every]);
  return now;
}

/**
 * **Sign-up, in one glance.** "Registration opens in 11h 42m" in the twelve
 * hours before 8:00 a.m. on the day; the day and time before that; "Registration
 * is open!" and the spaces left once it is. It only ever says — nobody is
 * signed up when it reaches zero.
 */
export function RegistrationNote({
  date,
  now,
  confirmed,
  capacity,
  cancelled,
  over,
  big,
}: {
  date: string;
  now: number;
  confirmed?: number;
  capacity?: number;
  cancelled?: string | null;
  over?: boolean;
  big?: boolean;
}) {
  if (cancelled)
    return (
      <p className="font-bold text-rose-300">
        Cancelled — {cancelled}. No badminton that night.
      </p>
    );
  if (over) return <p className="text-white/60">This night is over.</p>;
  const c = registrationCountdown(date, now);
  const full =
    confirmed !== undefined && capacity !== undefined && confirmed >= capacity;
  return (
    <div data-testid="registration" data-state={c.state}>
      <p
        className={cx(
          "font-black",
          big ? "text-2xl" : "text-lg",
          c.state === "scheduled" ? "text-white" : "text-lime-300",
        )}
      >
        {c.headline}
      </p>
      {c.state === "counting" && (
        <p className="text-sm text-white/70">
          {c.day} · {c.opens}
        </p>
      )}
      {c.state === "open" && confirmed !== undefined && capacity && (
        <p
          className={cx(
            "mt-1 font-bold tabular-nums",
            full ? "text-amber-300" : "text-white",
          )}
        >
          {spacesWords(confirmed, capacity)}
          {full && (
            <span className="block text-sm font-semibold text-white/80">
              The waitlist is open — you move up by yourself if someone cancels.
            </span>
          )}
        </p>
      )}
    </div>
  );
}

/**
 * **The next session, front and centre.** Date and time, when sign-up
 * opens (counting down in the last twelve hours), the spaces, whether you
 * are in, and a way to the courts.
 */
export function NextSession({
  view,
  offset,
  onCourts,
  skip,
  title = "Next session",
}: {
  view: LiveView;
  offset: number;
  onCourts?: () => void;
  skip?: string;
  title?: string;
}) {
  const now = useNow(offset);
  const listing: SessionListing | undefined = view.sessions.find(
    (s) => s.date !== skip && s.status !== "ended",
  );
  const night = view.season.nights.find(
    (n) =>
      n.date !== skip &&
      (n.status === "upcoming" || n.status === "today") &&
      (!listing || n.date <= listing.date),
  );
  const date = listing?.date ?? night?.date;
  if (!date)
    return (
      <Card>
        <p className="text-lg font-bold">The season is over.</p>
      </Card>
    );
  const hours =
    listing?.hours ?? view.season.nights.find((n) => n.date === date)?.hours;
  return (
    <div data-testid="next-session">
      <Card className="ring-2 ring-lime-400/50">
        <p className="text-xs font-bold tracking-widest text-lime-300/90 uppercase">
          {title}
        </p>
        <p className="mt-1 text-2xl font-black">{longDate(date)}</p>
        <p className="text-white/70">
          {hours}
          {skip ? "" : ` · ${view.season.venue}`}
        </p>
        <div className="mt-3 rounded-xl bg-slate-950/60 p-3">
          <RegistrationNote
            date={date}
            now={now}
            confirmed={listing?.confirmed}
            capacity={listing?.capacity ?? 25}
          />
          {listing && listing.registration === "open" && (
            <p className="mt-1 text-sm text-white/70">
              {listing.confirmed} playing
              {listing.waitlisted
                ? ` · ${listing.waitlisted} on the waitlist`
                : ""}
            </p>
          )}
          {!listing && (
            <p className="mt-1 text-sm text-white/60">
              25 spaces, first come, first served.
            </p>
          )}
        </div>
        {listing?.mine === "confirmed" && (
          <p className="mt-2 font-bold text-lime-300">
            ✓ You&apos;re registered
          </p>
        )}
        {listing?.mine === "waitlist" && (
          <p className="mt-2 font-bold text-amber-300">
            You&apos;re on the waitlist
            {listing.waitlistPosition ? ` (#${listing.waitlistPosition})` : ""}
          </p>
        )}
        {onCourts && (
          <Btn kind="ghost" className="mt-3 w-full" onClick={onCourts}>
            Courts →
          </Btn>
        )}
      </Card>
    </div>
  );
}
