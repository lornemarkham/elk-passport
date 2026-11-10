"use client";

import { useState } from "react";
import type { LiveView, SeasonView } from "@/lib/courtqueue/view";
import { Btn, Card, Sheet, clock, cx } from "./bits";

type Night = SeasonView["nights"][number];

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
  clubAct,
}: {
  view: LiveView;
  clubAct: (cmd: object) => Promise<boolean>;
}) {
  const season = view.season;
  const organizer = !!view.me?.organizer;
  const [editing, setEditing] = useState<Night | null>(null);
  const byDate = new Map(season.nights.map((n) => [n.date, n]));
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
          onPick={organizer ? setEditing : undefined}
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
        <EditNight
          night={editing}
          onClose={() => setEditing(null)}
          clubAct={clubAct}
        />
      )}
    </div>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-3 px-1 text-xs text-white/70">
      <li className="flex items-center gap-1">
        <span className="h-3 w-3 rounded-full bg-lime-400" /> Tonight
      </li>
      <li className="flex items-center gap-1">
        <span className="h-3 w-3 rounded-full ring-2 ring-lime-300" /> Coming up
      </li>
      <li className="flex items-center gap-1">
        <span className="h-3 w-3 rounded-full bg-white/20" /> Played
      </li>
      <li className="flex items-center gap-1">
        <span className="h-3 w-3 rounded-full bg-rose-500/80" /> Cancelled
      </li>
    </ul>
  );
}

function Month({
  month,
  byDate,
  onPick,
}: {
  month: string;
  byDate: Map<string, Night>;
  onPick?: (n: Night) => void;
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
          if (!n)
            return (
              <span key={i} className="py-1.5 text-white/25">
                {d}
              </span>
            );
          const body = (
            <span
              className={cx(
                "flex h-8 w-full items-center justify-center rounded-full text-sm font-bold",
                n.status === "today" && "bg-lime-400 text-slate-950",
                n.status === "upcoming" &&
                  "text-lime-200 ring-2 ring-lime-300/70",
                n.status === "past" && "bg-white/10 text-white/50",
                n.status === "cancelled" &&
                  "bg-rose-500/70 text-white line-through decoration-2",
              )}
            >
              {d}
            </span>
          );
          const label = `${n.label}${n.status === "cancelled" ? ` — cancelled: ${n.reason}` : `, ${n.hours}`}`;
          return onPick ? (
            <button
              key={i}
              aria-label={label}
              title={label}
              onClick={() => onPick(n)}
            >
              {body}
            </button>
          ) : (
            <span key={i} aria-label={label} title={label}>
              {body}
            </span>
          );
        })}
      </div>
    </Card>
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
    <Sheet open onClose={onClose} title={night.label}>
      <p className="mb-3 text-white/70">
        {night.hours}
        {cancelled ? ` · cancelled: ${night.reason}` : ""}
      </p>
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
    </Sheet>
  );
}
