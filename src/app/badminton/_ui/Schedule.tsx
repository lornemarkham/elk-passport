"use client";

import { useState } from "react";
import { localDate } from "@/lib/courtqueue/clock";
import { longDate } from "@/lib/courtqueue/countdown";
import { registrationState } from "@/lib/courtqueue/schedule";
import type {
  LiveView,
  SeasonView,
  SessionListing,
} from "@/lib/courtqueue/view";
import { Btn, Card, Sheet, clock, cx } from "./bits";
import { RegistrationNote, useNow } from "./Countdown";

type Night = SeasonView["nights"][number];

/** How a night shows on the calendar, most telling first. */
type Mark =
  "cancelled" | "completed" | "registered" | "open" | "upcoming" | "today";

function markOf(n: Night, listing: SessionListing | undefined, now: number) {
  if (n.status === "cancelled") return "cancelled";
  if (n.status === "past") return "completed";
  if (listing?.status === "ended") return "completed";
  if (listing?.mine === "confirmed" || listing?.mine === "waitlist")
    return "registered";
  if (registrationState(n.date, now, undefined) === "open") return "open";
  return "upcoming";
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * **The season, on one screen.** Month by month, every Monday and Thursday;
 * cancelled nights crossed out with the reason. Organizers tap a night to
 * cancel it or put it back, on the record.
 */
export function Schedule({
  view,
  offset,
  clubAct,
}: {
  view: LiveView;
  offset: number;
  clubAct: (cmd: object) => Promise<boolean>;
}) {
  const season = view.season;
  const organizer = !!view.me?.organizer;
  const [editing, setEditing] = useState<Night | null>(null);
  const now = useNow(offset, 30_000);
  const today = localDate(now);
  const byDate = new Map(season.nights.map((n) => [n.date, n]));
  const listings = new Map(view.sessions.map((l) => [l.date, l]));
  const months: string[] = [];
  for (const n of season.nights) {
    const m = n.date.slice(0, 7);
    if (!months.includes(m)) months.push(m);
  }
  const cancelled = season.nights.filter((n) => n.status === "cancelled");
  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs font-bold tracking-widest text-lime-300/80 uppercase">
          Season schedule
        </p>
        <h1 className="text-2xl font-black">{season.club}</h1>
        <p className="text-sm text-white/70">{season.venue}</p>
      </header>
      <Card>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-white/60">Mondays</dt>
            <dd className="text-lg font-black">7:00–9:00 pm</dd>
          </div>
          <div>
            <dt className="text-white/60">Thursdays</dt>
            <dd className="text-lg font-black">6:30–8:30 pm</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-white/60">Season</dt>
            <dd className="font-bold">October 5, 2026 – April 15, 2027</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-white/60">Sign-up</dt>
            <dd>
              Opens at <b>8:00 am on the day</b> of each night. The first 25 are
              in; after that, a waitlist that moves up by itself.
            </dd>
          </div>
        </dl>
      </Card>
      <Legend />
      {!byDate.has(today) && today >= season.first && today <= season.last && (
        <p className="px-1 text-sm text-white/60">
          Today is {longDate(today)} — no club night today.
        </p>
      )}
      {organizer && !season.confirmed && (
        <Card tone="warn">
          <p className="font-bold">Check the cancelled nights</p>
          <p className="mt-1 text-sm text-white/80">
            Mark each crossed-out date from the official schedule: tap the night
            below. When it matches, confirm it for everyone.
          </p>
          <Btn
            className="mt-3 w-full"
            onClick={() => clubAct({ type: "schedule-confirmed" })}
          >
            This matches the official schedule
          </Btn>
        </Card>
      )}
      {months.map((m) => (
        <Month
          key={m}
          month={m}
          byDate={byDate}
          listings={listings}
          now={now}
          today={today}
          onPick={setEditing}
        />
      ))}
      <Card>
        <h2 className="mb-2 font-bold">
          Cancelled nights ({cancelled.length})
        </h2>
        {cancelled.length ? (
          <ul className="space-y-1 text-sm">
            {cancelled.map((n) => (
              <li key={n.date} className="flex justify-between gap-2">
                <span className="line-through decoration-rose-400 decoration-2">
                  {n.label}
                </span>
                <span className="text-white/60">{n.reason}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-white/60">None marked yet.</p>
        )}
        {season.confirmed && (
          <p className="mt-2 text-xs text-white/50">
            Checked against the official schedule by {season.confirmed.by}.
          </p>
        )}
      </Card>
      {organizer && season.log.length > 0 && (
        <Card>
          <h2 className="mb-2 font-bold">Schedule changes</h2>
          <ul className="space-y-1 text-sm text-white/70">
            {season.log.map((a, i) => (
              <li key={i}>
                <span className="text-white/50">
                  {new Date(a.at).toLocaleDateString("en-CA", {
                    month: "short",
                    day: "numeric",
                    timeZone: "America/Vancouver",
                  })}{" "}
                  {clock(a.at)}
                </span>{" "}
                {a.by}: {a.what}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {editing && (
        <NightSheet
          night={editing}
          listing={listings.get(editing.date)}
          venue={season.venue}
          now={now}
          organizer={organizer}
          onClose={() => setEditing(null)}
          clubAct={clubAct}
        />
      )}
    </div>
  );
}

const MARK_STYLE: Record<Mark, string> = {
  today: "bg-lime-400 text-slate-950",
  open: "bg-lime-400 text-slate-950",
  registered: "bg-sky-400 text-slate-950",
  upcoming: "text-lime-200 ring-2 ring-lime-300/70",
  completed: "bg-white/10 text-white/50",
  cancelled: "bg-rose-500/70 text-white line-through decoration-2",
};

const MARK_WORDS: Record<Mark, string> = {
  today: "Tonight",
  open: "Registration open",
  registered: "You're registered",
  upcoming: "Badminton coming up",
  completed: "Completed",
  cancelled: "Cancelled",
};

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 px-1 text-xs text-white/70">
      <li className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-full outline-2 outline-offset-1 outline-white" />{" "}
        Today
      </li>
      {(
        ["upcoming", "open", "registered", "completed", "cancelled"] as const
      ).map((m) => (
        <li key={m} className="flex items-center gap-1.5">
          <span className={cx("h-3 w-3 rounded-full", MARK_STYLE[m])} />{" "}
          {MARK_WORDS[m]}
        </li>
      ))}
    </ul>
  );
}

function Month({
  month,
  byDate,
  listings,
  now,
  today,
  onPick,
}: {
  month: string;
  byDate: Map<string, Night>;
  listings: Map<string, SessionListing>;
  now: number;
  today: string;
  onPick: (n: Night) => void;
}) {
  const [y, m] = month.split("-").map(Number);
  const firstDay = new Date(Date.UTC(y!, m! - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  const cells: (number | null)[] = [
    ...Array<null>(firstDay).fill(null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
  return (
    <Card>
      <h2 className="mb-2 font-bold">
        {MONTHS[m! - 1]} {y}
      </h2>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i} className="pb-1 text-white/40">
            {d}
          </span>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <span key={i} />;
          const date = `${month}-${String(d).padStart(2, "0")}`;
          const n = byDate.get(date);
          const isToday = date === today;
          const todayRing =
            isToday && "outline-2 outline-offset-2 outline-white";
          if (!n)
            return (
              <span
                key={i}
                data-today={isToday || undefined}
                aria-label={isToday ? `Today, ${longDate(date)}` : undefined}
                className={cx(
                  "flex h-8 items-center justify-center rounded-full text-sm",
                  isToday ? "font-black text-white" : "text-white/25",
                  todayRing,
                )}
              >
                {d}
              </span>
            );
          const mark = markOf(n, listings.get(date), now);
          const label = `${isToday ? "Today, " : ""}${n.label}${n.status === "cancelled" ? ` — cancelled: ${n.reason}` : `, ${n.hours} — ${MARK_WORDS[mark].toLowerCase()}`}`;
          return (
            <button
              key={i}
              aria-label={label}
              title={label}
              data-mark={mark}
              data-today={isToday || undefined}
              onClick={() => onPick(n)}
            >
              <span
                className={cx(
                  "relative flex h-8 w-full items-center justify-center rounded-full text-sm font-bold",
                  MARK_STYLE[mark],
                  todayRing,
                )}
              >
                {d}
                {mark === "completed" && (
                  <span
                    aria-hidden
                    className="absolute -top-1 -right-0.5 text-[9px] text-lime-300"
                  >
                    ✓
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

/** One night: details and sign-up for everyone; cancel or restore for organizers. */
function NightSheet({
  night,
  listing,
  venue,
  now,
  organizer,
  onClose,
  clubAct,
}: {
  night: Night;
  listing: SessionListing | undefined;
  venue: string;
  now: number;
  organizer: boolean;
  onClose: () => void;
  clubAct: (cmd: object) => Promise<boolean>;
}) {
  const mark = markOf(night, listing, now);
  return (
    <Sheet open onClose={onClose} title={longDate(night.date)}>
      <p className="text-white/80">
        {night.hours} · {venue}
      </p>
      <p className="mt-1 text-sm font-bold text-lime-200">{MARK_WORDS[mark]}</p>
      <div className="mt-3 rounded-xl bg-white/[0.06] p-3">
        <RegistrationNote
          date={night.date}
          now={now}
          confirmed={listing?.confirmed}
          capacity={listing?.capacity ?? 25}
          cancelled={night.status === "cancelled" ? night.reason : null}
          over={mark === "completed"}
        />
        {listing && mark !== "cancelled" && (
          <p className="mt-1 text-sm text-white/70">
            {listing.confirmed} of {listing.capacity} signed up
            {listing.waitlisted
              ? ` · ${listing.waitlisted} on the waitlist`
              : ""}
          </p>
        )}
        {listing?.mine === "confirmed" && (
          <p className="mt-1 font-bold text-lime-300">
            ✓ You&apos;re registered
          </p>
        )}
        {listing?.mine === "waitlist" && (
          <p className="mt-1 font-bold text-amber-300">
            You&apos;re on the waitlist
          </p>
        )}
      </div>
      {organizer && mark !== "completed" && (
        <div className="mt-4 border-t border-white/10 pt-4">
          <EditNight night={night} onClose={onClose} clubAct={clubAct} />
        </div>
      )}
    </Sheet>
  );
}

function EditNight({
  night,
  onClose,
  clubAct,
}: {
  night: Night;
  onClose: () => void;
  clubAct: (cmd: object) => Promise<boolean>;
}) {
  const [reason, setReason] = useState(night.reason ?? "");
  const cancelled = night.status === "cancelled";
  return (
    <>
      {!cancelled && (
        <label className="mb-3 block">
          <span className="text-sm text-white/70">Why (shown to players)</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="No gym — school event"
            className="mt-1 w-full rounded-xl bg-white/10 p-3"
          />
        </label>
      )}
      <Btn
        kind={cancelled ? "primary" : "danger"}
        className="w-full"
        onClick={() =>
          clubAct({
            type: "cancel-night",
            date: night.date,
            cancelled: !cancelled,
            reason: reason || "Cancelled",
          }).then((ok) => ok && onClose())
        }
      >
        {cancelled ? "Put this night back on" : "Cancel this night"}
      </Btn>
      <p className="mt-2 text-xs text-white/50">
        Kept in the schedule&apos;s history with your name.
      </p>
    </>
  );
}
