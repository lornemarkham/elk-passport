"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ArrivalRow } from "@/domain/conference-arrivals/board";
import { distanceKm } from "@/domain/conference-arrivals/geo";
import type { ConferenceKind } from "@/domain/conference/types";
import type { ArrivalsView } from "@/lib/conference-arrivals/service";
import { Section } from "@/components/conference/ui";
import { MyFlight } from "./MyFlight";
import { ago, clock, day, headline, statusLine } from "./words";

const ArrivalsMap = dynamic(
  () => import("./ArrivalsMap").then((m) => m.ArrivalsMap),
  {
    ssr: false,
    loading: () => <div className="h-[62vh] min-h-[360px] bg-[#e9edf0]" />,
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
        <div className="mx-auto max-w-[760px] px-5 pt-8 pb-6">
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
        <>
          <ArrivalsMap
            rows={rows}
            arrival={board.arrival}
            accent={accent}
            selected={selected}
            onSelect={setSelected}
          />
          <div className="mx-auto max-w-[760px] px-5">
            {chosen ? (
              <Details
                row={chosen}
                now={now}
                timeZone={timeZone}
                onClose={() => setSelected(null)}
              />
            ) : null}

            <Section
              title="Who's coming"
              hint={
                rows.length
                  ? undefined
                  : "Nobody has shared a flight yet. Planes only appear when people choose to share."
              }
            >
              <ul
                className="divide-y divide-black/10"
                data-testid="arrivals-list"
              >
                {rows.map((r) => (
                  <li key={r.memberId}>
                    <button
                      type="button"
                      onClick={() => setSelected(r.memberId)}
                      className="flex w-full items-start gap-3 py-3 text-left"
                    >
                      <PhaseDot phase={r.phase} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[17px] font-bold">
                          {r.isYou ? "You" : r.name}{" "}
                          <span className="font-semibold text-black/45">
                            {r.flight}
                          </span>
                        </span>
                        <span className="block text-[14px] text-black/60">
                          {statusLine(r, now, timeZone)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Your flight">
              {view ? (
                <MyFlight
                  conferenceId={conferenceId}
                  place={view.place}
                  conferenceName={name}
                  you={view.you}
                  mine={view.mine}
                  onSaved={load}
                />
              ) : null}
            </Section>

            <p className="mt-10 text-[12px] leading-relaxed text-black/45">
              Positions are real ADS-B reports from volunteer receivers via
              ADSB.lol (ODbL), checked against your flight before anyone&apos;s
              name goes on a plane. Over oceans and remote land the receivers
              can&apos;t hear aircraft, and the map shows the last real
              position, labelled with its age. It never guesses one.
            </p>
          </div>
        </>
      ) : null}
    </>
  );
}

function PhaseDot({ phase }: { phase: ArrivalRow["phase"] }) {
  const colour =
    phase === "airborne"
      ? "bg-[#12b76a]"
      : phase === "lost"
        ? "bg-[#9e9e9e]"
        : phase === "landed"
          ? "bg-black"
          : "bg-transparent border border-black/30";
  return (
    <span
      aria-hidden="true"
      className={`mt-2 h-3 w-3 shrink-0 rounded-full ${colour}`}
    />
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
  return (
    <section
      className="mt-6 rounded-2xl border border-black/10 p-4 shadow-sm"
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
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[15px]">
        <dt className="text-black/50">From</dt>
        <dd>
          {from ?? "Not given"}
          {r.from && r.fromBasis === "route-record" ? (
            <span className="text-black/45"> (route record)</span>
          ) : null}
        </dd>
        <dt className="text-black/50">To</dt>
        <dd>{to}</dd>
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
