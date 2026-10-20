"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ArrivalRow } from "@/domain/conference-arrivals/board";
import { distanceKm } from "@/domain/conference-arrivals/geo";
import type { ConferenceKind } from "@/domain/conference/types";
import type { ArrivalsView } from "@/lib/conference-arrivals/service";
import { inkOn } from "@/domain/conference/branding";
import { Section } from "@/components/conference/ui";
import { MyFlight } from "./MyFlight";
import {
  ago,
  clock,
  day,
  headline,
  statusLine,
  timeCell,
  versusSchedule,
  type TimeKind,
} from "./words";

const JUST_LANDED_MS = 45 * 60_000;

const ArrivalsMap = dynamic(
  () => import("./ArrivalsMap").then((m) => m.ArrivalsMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[56vh] min-h-[340px] bg-[#0b111b] lg:h-full" />
    ),
  },
);

/** Poll fast only while something is actually moving. */
function pollMs(view: ArrivalsView | null): number {
  const rows = view?.board?.rows ?? [];
  if (rows.some((r) => r.phase === "airborne")) return 10_000;
  if (rows.some((r) => r.phase === "searching" || r.phase === "lost"))
    return 30_000;
  return 120_000;
}

export function ArrivalsBoard({
  conferenceId,
  name,
  kind,
  timeZone,
  accent,
  ink,
}: {
  conferenceId: string;
  name: string;
  kind: ConferenceKind;
  timeZone: string;
  accent: string;
  ink: string;
}) {
  const [view, setView] = useState<ArrivalsView | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/conferences/${conferenceId}/arrivals`, {
        cache: "no-store",
      });
      if (!r.ok) throw new Error(String(r.status));
      const body = (await r.json()) as { view: ArrivalsView };
      setView(body.view);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [conferenceId]);

  // Load now, then poll while the page is visible. A phone in a pocket
  // asks for nothing.
  useEffect(() => {
    const id = setTimeout(
      () => {
        if (!view || document.visibilityState === "visible") void load();
      },
      view ? pollMs(view) : 0,
    );
    const wake = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", wake);
    return () => {
      clearTimeout(id);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [view, load]);

  // "12 s ago" keeps counting between polls.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 5_000);
    return () => clearInterval(id);
  }, []);

  const board = view?.board ?? null;
  const words = board
    ? headline(board, view!.place, kind, now)
    : { big: "Arrivals", small: "" };
  const rows = board?.rows ?? [];
  const chosen = rows.find((r) => r.memberId === selected) ?? null;

  return (
    <>
      <header style={{ background: accent, color: ink }}>
        <div className="mx-auto max-w-[1280px] px-5 pt-8 pb-6">
          <Link
            href={`/conferences/${conferenceId}`}
            className="text-[14px] underline opacity-75"
          >
            ← {name}
          </Link>
          <h1
            className="mt-3 text-[34px] leading-[0.98] font-black tracking-[-0.03em] sm:text-[48px]"
            data-testid="arrivals-headline"
          >
            {words.big}
          </h1>
          {words.small ? (
            <p className="mt-2 text-[18px] font-semibold opacity-85">
              {words.small}
            </p>
          ) : null}
          {board && board.counts.total ? (
            <p className="mt-4 text-[13px] font-bold tracking-[0.12em] uppercase opacity-75">
              {board.counts.airborne} in the air · {board.counts.landed} landed
              · {board.counts.total} shared
            </p>
          ) : null}
        </div>
      </header>

      {failed && !view ? (
        <p className="mx-auto max-w-[760px] px-5 pt-6 text-black/60">
          Couldn&apos;t reach Passport. Are you online?
        </p>
      ) : null}

      {view && !board ? (
        <p className="mx-auto max-w-[760px] px-5 pt-6 text-black/60">
          Passport can&apos;t tell which airport {view.place} flies into, so
          there&apos;s nothing to track yet. An organiser can pick a town
          Passport knows in Organiser settings.
        </p>
      ) : null}

      {board ? (
        <div className="bg-[#070b12] lg:grid lg:grid-cols-[minmax(0,1fr)_440px]">
          <div className="lg:sticky lg:top-0 lg:h-[100dvh]">
            <ArrivalsMap
              rows={rows}
              arrival={board.arrival}
              place={view!.place}
              accent={accent}
              selected={selected}
              onSelect={setSelected}
            />
          </div>
          <div className="text-white lg:min-h-[100dvh] lg:border-l lg:border-white/10">
            <div className="px-5 pt-6 pb-8">
              {chosen ? (
                <Details
                  row={chosen}
                  now={now}
                  timeZone={timeZone}
                  onClose={() => setSelected(null)}
                />
              ) : null}

              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-[13px] font-bold tracking-[0.18em] text-white/55 uppercase">
                  Arrivals · {board.arrival.iata ?? board.arrival.icao}
                </h2>
                <p className="text-[12px] text-white/40">
                  Times in {view!.place}
                </p>
              </div>
              {rows.length ? null : (
                <p className="mt-3 text-[15px] text-white/60">
                  Nobody has shared a flight yet. Planes only appear when people
                  choose to share.
                </p>
              )}
              <ul
                className="mt-3 divide-y divide-white/10 border-y border-white/10"
                data-testid="arrivals-list"
              >
                {rows.map((r) => (
                  <BoardRow
                    key={r.memberId}
                    row={r}
                    now={now}
                    timeZone={timeZone}
                    accent={accent}
                    onSelect={() => setSelected(r.memberId)}
                  />
                ))}
              </ul>
              <Legend />
            </div>

            <div className="rounded-t-3xl bg-white px-5 pt-2 pb-10 text-black lg:rounded-none">
              <Section title="Your flight">
                {view ? (
                  <MyFlight
                    conferenceId={conferenceId}
                    place={view.place}
                    airport={board.arrival.iata ?? board.arrival.icao}
                    conferenceName={name}
                    you={view.you}
                    mine={view.mine}
                    onSaved={load}
                  />
                ) : null}
              </Section>

              <p className="mt-10 text-[12px] leading-relaxed text-black/45">
                Positions are real ADS-B reports from volunteer receivers via
                ADSB.lol (ODbL), checked against your flight before
                anyone&apos;s name goes on a plane. Over oceans and remote land
                the receivers can&apos;t hear aircraft, and the map shows the
                last real position, labelled with its age. It never guesses one.
                Scheduled times are what each person typed from their booking;
                Passport doesn&apos;t check them with the airline.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

const KIND_INK: Readonly<Record<TimeKind, string>> = {
  landed: "text-white",
  estimated: "text-[#fbbf24]",
  scheduled: "text-white/85",
  leaves: "text-white/55",
};

/** One line of the board: when, who, and what kind of claim each is. */
function BoardRow({
  row: r,
  now,
  timeZone,
  accent,
  onSelect,
}: {
  row: ArrivalRow;
  now: Date;
  timeZone: string;
  accent: string;
  onSelect: () => void;
}) {
  const t = timeCell(r, timeZone);
  const fresh =
    r.phase === "landed" &&
    r.landedAt &&
    now.getTime() - Date.parse(r.landedAt) < JUST_LANDED_MS;
  return (
    <li data-phase={r.phase}>
      <button
        type="button"
        onClick={onSelect}
        aria-label={`${r.isYou ? "You" : r.name} ${r.flight}. ${t.says}.`}
        className="flex w-full items-start gap-4 py-3.5 text-left"
      >
        <span className="w-[68px] shrink-0">
          <span
            className={`block text-[20px] leading-none font-black tabular-nums ${KIND_INK[t.kind]}`}
          >
            {t.time}
          </span>
          <span
            className="mt-1 block text-[10px] font-bold tracking-[0.14em] text-white/45 uppercase"
            data-testid="time-kind"
          >
            {t.tag}
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[17px] leading-tight font-bold">
              {r.isYou ? "You" : r.name}
            </span>
            <span className="text-[15px] font-semibold text-white/45">
              {r.flight}
            </span>
            <Status phase={r.phase} />
            {fresh ? (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-black tracking-[0.12em] uppercase"
                style={{ background: accent, color: inkOn(accent) }}
              >
                Just landed
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 block text-[14px] text-white/60">
            {statusLine(r, now, timeZone)}
          </span>
        </span>
      </button>
    </li>
  );
}

/**
 * The one word that says where a row's information comes from. "Live" only
 * for an identified aircraft with a current ADS-B position.
 */
function Status({ phase }: { phase: ArrivalRow["phase"] }) {
  const [label, style] =
    phase === "airborne"
      ? ["Live", "bg-[#12b76a]/15 text-[#34d399] ring-[#34d399]/40"]
      : phase === "lost"
        ? ["Last seen", "bg-white/5 text-white/60 ring-white/20"]
        : phase === "landed"
          ? ["Landed", "bg-white/10 text-white ring-white/25"]
          : phase === "searching"
            ? ["Looking", "bg-transparent text-white/55 ring-white/20"]
            : phase === "missed"
              ? ["Not seen", "bg-transparent text-white/45 ring-white/15"]
              : [
                  "Not flying yet",
                  "bg-transparent text-white/55 ring-white/20",
                ];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black tracking-[0.12em] uppercase ring-1 ${style}`}
      data-testid="row-status"
    >
      {phase === "airborne" ? (
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full bg-[#34d399]"
        />
      ) : null}
      {label}
    </span>
  );
}

function Legend() {
  return (
    <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[12px] text-white/50">
      <dt className="font-black tracking-[0.12em] text-[#34d399] uppercase">
        Live
      </dt>
      <dd>The aircraft&apos;s own ADS-B position, under 2 minutes old.</dd>
      <dt className="font-black tracking-[0.12em] text-[#fbbf24] uppercase">
        ~ Estimate
      </dt>
      <dd>
        From a live aircraft&apos;s distance and speed. Approaches take longer.
      </dd>
      <dt className="font-black tracking-[0.12em] text-white/80 uppercase">
        Scheduled
      </dt>
      <dd>From the person&apos;s booking, as they typed it.</dd>
    </dl>
  );
}

function Details({
  row: r,
  now,
  timeZone,
  onClose,
}: {
  row: ArrivalRow;
  now: Date;
  timeZone: string;
  onClose: () => void;
}) {
  const from = r.from ? (r.from.city ?? r.from.name) : null;
  const to = r.to.city ?? r.to.name;
  const p = r.position;
  const out = p ? Math.round(distanceKm(p, r.to)) : null;
  const t = timeCell(r, timeZone);
  const scheduled =
    r.lands && t.kind !== "scheduled"
      ? `${day(r.lands.slice(0, 10))} ${r.lands.slice(11, 16)}`
      : null;
  const versus = versusSchedule(r, timeZone);
  return (
    <section
      className="mb-6 rounded-2xl bg-white p-4 text-black shadow-lg"
      data-testid="arrival-details"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[22px] leading-tight font-black">
            {r.isYou ? "You" : r.name}
          </p>
          <p className="text-[15px] text-black/60">
            {r.airline ? `${r.airline} ` : ""}
            {r.flight} · {day(r.date)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-3 py-1 text-[14px] text-black/55"
          aria-label="Close details"
        >
          ✕
        </button>
      </div>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-[15px]">
        <dt className="text-black/50">From</dt>
        <dd>
          {from ?? "Not given"}
          {r.from && r.fromBasis === "route-record" ? (
            <span className="text-black/45"> (route record)</span>
          ) : null}
        </dd>
        <dt className="text-black/50">To</dt>
        <dd>{to}</dd>
        <dt className="text-black/50">
          {t.kind === "leaves" ? "Leaves" : "Lands"}
        </dt>
        <dd data-testid="details-time">
          {t.says}
          {versus ? (
            <span className="block text-black/55">{versus}</span>
          ) : null}
        </dd>
        {scheduled ? (
          <>
            <dt className="text-black/50">Scheduled</dt>
            <dd>
              {scheduled}{" "}
              <span className="text-black/45">
                ({r.isYou ? "your" : "their"} booking)
              </span>
            </dd>
          </>
        ) : null}
        {r.aircraft ? (
          <>
            <dt className="text-black/50">Aircraft</dt>
            <dd>
              {r.aircraft.callsign}
              {r.aircraft.registration ? ` · ${r.aircraft.registration}` : ""}
              {r.aircraft.type ? ` · ${r.aircraft.type}` : ""}
            </dd>
          </>
        ) : null}
        {p ? (
          <>
            <dt className="text-black/50">
              {r.phase === "lost" ? "Last seen" : "Telemetry"}
            </dt>
            <dd>
              {ago(p.at, now)} ({clock(p.at, timeZone)})
            </dd>
            <dt className="text-black/50">Altitude</dt>
            <dd>
              {p.onGround
                ? "On the ground"
                : p.altitudeFt !== null
                  ? `${p.altitudeFt.toLocaleString("en-CA")} ft`
                  : "—"}
            </dd>
            <dt className="text-black/50">Speed</dt>
            <dd>
              {p.groundSpeedKt !== null
                ? `${Math.round(p.groundSpeedKt * 1.852)} km/h`
                : "—"}
            </dd>
            <dt className="text-black/50">To go</dt>
            <dd>{out} km</dd>
          </>
        ) : null}
      </dl>
      {r.phase === "lost" ? (
        <p className="mt-3 rounded-xl bg-black/5 p-3 text-[14px]">
          <strong>Stale.</strong> {r.lostBecause} The plane on the map is where
          it was {p ? ago(p.at, now) : "last heard"}, not where it is.
        </p>
      ) : null}
      {r.phase === "landed" && r.landedBasis === "inferred" ? (
        <p className="mt-3 rounded-xl bg-black/5 p-3 text-[14px]">
          Its signal ended at {p?.altitudeFt ?? "low"} ft, {out} km from the
          runway. Receivers rarely hear aircraft on the ground, so that&apos;s
          as close to &ldquo;landed&rdquo; as ADS-B gets.
        </p>
      ) : null}
      {r.waiting ? (
        <p className="mt-3 rounded-xl bg-black/5 p-3 text-[14px]">
          <strong>
            Waiting to identify {r.isYou ? "your" : "their"} aircraft.
          </strong>{" "}
          {r.waiting}
        </p>
      ) : null}
      {r.evidence.length ? (
        <details className="mt-3 text-[14px]">
          <summary className="cursor-pointer font-semibold">
            {r.aircraft ? "How we know it's this plane" : "What we checked"}
          </summary>
          <ul className="mt-2 space-y-1">
            {r.evidence.map((e) => (
              <li key={e.check} className="flex gap-2">
                <span aria-hidden="true">
                  {e.result === "pass" ? "✓" : e.result === "fail" ? "✗" : "?"}
                </span>
                <span className="text-black/70">{e.says}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
