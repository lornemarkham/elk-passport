"use client";

import { useState } from "react";
import { Plane, Trash2 } from "lucide-react";
import type { Participant, Visibility } from "@/domain/sycle/board";
import type { FlightRecord } from "@/domain/sycle/flight";
import { clock, dayOf } from "./words";

type Me = Omit<Participant, "id"> | null;

/**
 * **Your flight, and how you appear — in that order, and both reversible.**
 *
 * Number and date → the flights that match → you point at yours → you choose
 * how the board shows you. "Just me" is preselected: nobody lands on a shared
 * surface by not reading a radio button.
 */
export function MyFlight({
  me,
  lookupConnected,
  onChanged,
  today,
}: {
  readonly me: Me;
  readonly lookupConnected: boolean;
  readonly onChanged: () => void;
  readonly today: string;
}) {
  const [editing, setEditing] = useState(!me?.flight);
  const [number, setNumber] = useState(me?.flight?.flightNumber ?? "");
  const [date, setDate] = useState(me?.flight?.date ?? today);
  const [found, setFound] = useState<readonly FlightRecord[] | null>(null);
  const [chosen, setChosen] = useState<FlightRecord | null>(null);
  const [visibility, setVisibility] = useState<Visibility>(
    me?.visibility ?? "off",
  );
  const [name, setName] = useState(me?.displayName ?? "");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const lookUp = async () => {
    setBusy(true);
    setProblem(null);
    setFound(null);
    setChosen(null);
    const r = await fetch("/api/sycle/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flightNumber: number, date }),
    });
    const body = await r.json().catch(() => null);
    setBusy(false);
    if (body?.ok) {
      setFound(body.flights);
      const only = body.flights.filter(
        (f: FlightRecord) =>
          f.arrival.airport.iata === "YVR" || f.arrival.airport.icao === "CYVR",
      );
      if (only.length === 1) setChosen(only[0]);
      return;
    }
    setProblem(
      body?.reason === "invalid"
        ? "That doesn't look like a flight number — try something like AC 855."
        : body?.reason === "not-connected"
          ? "Flight lookup isn't switched on yet. Your flight can't be added until it is."
          : "The flight-data service didn't answer. Try again in a minute.",
    );
  };

  const save = async (patch: Record<string, unknown>) => {
    setBusy(true);
    setProblem(null);
    const r = await fetch("/api/sycle/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const body = await r.json().catch(() => null);
    setBusy(false);
    if (!body?.ok) {
      setProblem(body?.reason ?? "That didn't save. Try again?");
      return false;
    }
    onChanged();
    return true;
  };

  const confirm = async () => {
    if (!chosen) return;
    const ok = await save({
      flightKey: chosen.key,
      flightNumber: number,
      date,
      visibility,
      displayName: name,
    });
    if (ok) {
      setEditing(false);
      setFound(null);
    }
  };

  const forget = async () => {
    if (
      !window.confirm(
        "Delete your flight, your name and your adventures from the board? This can't be undone.",
      )
    )
      return;
    await fetch("/api/sycle/me", { method: "DELETE" });
    window.location.reload();
  };

  return (
    <section
      className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-white sm:p-6"
      data-testid="sycle-my-flight"
    >
      <h2 className="text-[13px] font-bold tracking-[0.14em] text-[#ffd27a] uppercase">
        Your flight
      </h2>

      {!editing && me?.flight ? (
        <div className="mt-3">
          <p className="text-[22px] font-extrabold tracking-tight">
            {me.flight.flightNumber}{" "}
            <span className="text-white/50">· {me.flight.date}</span>
          </p>
          <p className="mt-1 text-[14px] text-white/60">
            {me.visibility === "named"
              ? `On the board as ${me.displayName}.`
              : me.visibility === "anonymous"
                ? "On the board anonymously."
                : "Only you can see this."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="sycle-chip" onClick={() => setEditing(true)}>
              Change flight or name
            </button>
            <button
              className="sycle-chip"
              disabled={busy}
              onClick={() => save({ flightKey: null })}
            >
              Remove my flight
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              lookUp();
            }}
          >
            <label className="flex-1">
              <span className="sr-only">Flight number</span>
              <input
                className="sycle-input w-full uppercase"
                placeholder="Flight — AC 855"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                autoCapitalize="characters"
                autoComplete="off"
                data-testid="sycle-flight-number"
              />
            </label>
            <label>
              <span className="sr-only">Departure date</span>
              <input
                type="date"
                className="sycle-input w-full"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                data-testid="sycle-flight-date"
              />
            </label>
            <button
              className="sycle-button"
              disabled={busy || !lookupConnected || !number}
            >
              {busy ? "Looking…" : "Find it"}
            </button>
          </form>
          <p className="mt-2 text-[12px] text-white/45">
            The flight that lands at YVR, and the date it <em>leaves</em>.
            Connecting? Enter the last leg.
          </p>
          {!lookupConnected ? (
            <p className="mt-3 text-[14px] text-[#ffb59e]">
              Flight lookup isn&apos;t switched on yet, so flights can&apos;t be
              added. The board, and everything below it, still works.
            </p>
          ) : null}

          {found && found.length === 0 ? (
            <p className="mt-4 text-[14px] text-white/70">
              No flight by that number on that date. Check the date is the day
              it departs.
            </p>
          ) : null}

          {found && found.length > 0 ? (
            <ul
              className="mt-4 flex flex-col gap-2"
              data-testid="sycle-candidates"
            >
              {found.map((f) => {
                const toYvr =
                  f.arrival.airport.iata === "YVR" ||
                  f.arrival.airport.icao === "CYVR";
                const picked = chosen?.key === f.key;
                return (
                  <li key={f.key}>
                    <button
                      type="button"
                      disabled={!toYvr}
                      onClick={() => setChosen(f)}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        picked
                          ? "border-[#ffd27a] bg-[#ffd27a]/10"
                          : "border-white/10 hover:border-white/30"
                      } disabled:opacity-50`}
                    >
                      <p className="flex items-center gap-2 font-bold">
                        <Plane size={14} />{" "}
                        {f.departure.airport.city ?? f.departure.airport.name} →{" "}
                        {f.arrival.airport.city ?? f.arrival.airport.name}
                        {f.source === "demo" ? <Demo /> : null}
                      </p>
                      <p className="mt-0.5 text-[13px] text-white/60">
                        {f.airline ?? f.flightNumber}
                        {f.operatedAs ? ` · operated as ${f.operatedAs}` : ""}
                        {f.departure.times.scheduled
                          ? ` · leaves ${dayOf(f.departure.times.scheduled, f.departure.airport.timeZone ?? undefined)} ${clock(
                              f.departure.times.scheduled,
                              f.departure.airport.timeZone ?? undefined,
                            )} local`
                          : ""}
                        {f.arrival.times.scheduled
                          ? ` · lands ${clock(f.arrival.times.scheduled)} Vancouver time`
                          : ""}
                      </p>
                      {!toYvr ? (
                        <p className="mt-1 text-[12px] text-[#ffb59e]">
                          This one lands in{" "}
                          {f.arrival.airport.city ?? f.arrival.airport.name}.
                          The board is for the leg into YVR.
                        </p>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {chosen ? (
            <fieldset className="mt-5" data-testid="sycle-visibility">
              <legend className="text-[15px] font-bold">
                How should the board show you?
              </legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <Choice
                  value="off"
                  current={visibility}
                  set={setVisibility}
                  title="Just me"
                  body="Your flight, your countdown. Nobody else sees it or counts it."
                />
                <Choice
                  value="anonymous"
                  current={visibility}
                  set={setVisibility}
                  title="Anonymously"
                  body="A line from your city, no name. If you're the only one from there, people may guess."
                />
                <Choice
                  value="named"
                  current={visibility}
                  set={setVisibility}
                  title="By name"
                  body="Your name, city and landing time. Never your flight number."
                />
              </div>
              {visibility === "named" ? (
                <input
                  className="sycle-input mt-3 w-full"
                  placeholder="What colleagues call you"
                  maxLength={40}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="sycle-name"
                />
              ) : null}
              <button
                type="button"
                className="sycle-button mt-4"
                disabled={busy || (visibility === "named" && !name.trim())}
                onClick={confirm}
                data-testid="sycle-confirm"
              >
                That&apos;s my flight
              </button>
            </fieldset>
          ) : null}
        </div>
      )}

      {problem ? (
        <p className="mt-3 text-[14px] text-[#ffb59e]" role="alert">
          {problem}
        </p>
      ) : null}

      {me ? (
        <button
          onClick={forget}
          className="mt-6 inline-flex items-center gap-1.5 text-[12px] text-white/40 underline-offset-4 hover:text-white/70 hover:underline"
          data-testid="sycle-forget"
        >
          <Trash2 size={12} /> Delete everything about me
        </button>
      ) : null}
    </section>
  );
}

function Choice({
  value,
  current,
  set,
  title,
  body,
}: {
  value: Visibility;
  current: Visibility;
  set: (v: Visibility) => void;
  title: string;
  body: string;
}) {
  const on = value === current;
  return (
    <label
      className={`cursor-pointer rounded-xl border p-3 transition ${
        on
          ? "border-[#ffd27a] bg-[#ffd27a]/10"
          : "border-white/10 hover:border-white/30"
      }`}
    >
      <input
        type="radio"
        name="sycle-visibility"
        value={value}
        checked={on}
        onChange={() => set(value)}
        className="sr-only"
      />
      <span className="block font-bold">{title}</span>
      <span className="mt-1 block text-[12px] leading-snug text-white/55">
        {body}
      </span>
    </label>
  );
}

export const Demo = () => (
  <span className="rounded bg-[#ff7a59] px-1.5 py-0.5 text-[10px] font-black tracking-wider text-black uppercase">
    Demo
  </span>
);
