"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { primary, Problem, secondary } from "@/components/conference/ui";
import {
  freshness,
  SHARE_MINUTES,
  type ShareMinutes,
} from "@/domain/conference-people/people";
import type { PeopleView } from "@/lib/conference-people/service";
import { Directions } from "./Directions";
import { PeopleMap, type MapPin } from "./PeopleMap";
import { send, usePoll } from "./usePoll";

const LENGTH: Record<ShareMinutes, string> = {
  15: "15 min",
  30: "30 min",
  60: "1 hour",
  120: "2 hours",
  240: "4 hours",
};

/** How often a moving phone sends a new position while sharing. */
const MOVE_EVERY_MS = 20_000;

/**
 * **Find my people.** Share where you are for a while — you choose how long,
 * and Stop deletes it at once. Coworkers who are sharing appear on the map
 * with how fresh their position is, and a tap gives walking directions.
 *
 * The phone's position is read only after the person presses Share, and
 * only while this page is open: close it and updates stop (the share still
 * ends on its own at the time chosen).
 */
export function FindMyPeople({
  conferenceId,
  initial,
  centre,
  pins,
  accent,
}: {
  conferenceId: string;
  initial: PeopleView;
  /** `null` when Passport can't place the conference: the list still works. */
  centre: readonly [number, number] | null;
  pins: readonly MapPin[];
  accent: string;
}) {
  const api = `/api/conferences/${conferenceId}/people`;
  const { data: view, refresh } = usePoll(
    api,
    (j) => j.people as PeopleView,
    initial,
    5_000,
  );
  const [minutes, setMinutes] = useState<ShareMinutes>(60);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [, tick] = useState(0);
  const watch = useRef<number | null>(null);
  const last = useRef(0);
  const now = new Date();

  // While sharing and on this page: follow the phone, gently.
  useEffect(() => {
    if (!view.you.sharing || !("geolocation" in navigator)) return;
    watch.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (Date.now() - last.current < MOVE_EVERY_MS) return;
        last.current = Date.now();
        void send(api, {
          action: "move",
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 15_000 },
    );
    return () => {
      if (watch.current !== null)
        navigator.geolocation.clearWatch(watch.current);
    };
  }, [view.you.sharing, api]);

  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const start = () => {
    setProblem("");
    if (!("geolocation" in navigator))
      return setProblem("This browser can't tell where you are.");
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const r = await send(api, {
          action: "share",
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          minutes,
          note,
        });
        setBusy(false);
        if (!r.ok) return setProblem(r.message);
        last.current = Date.now();
        await refresh();
      },
      (err) => {
        setBusy(false);
        setProblem(
          err.code === err.PERMISSION_DENIED
            ? "Your phone said no to sharing location. Nothing was shared."
            : "Couldn't find where you are. Nothing was shared.",
        );
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };

  const stop = async () => {
    setBusy(true);
    const r = await send(api, undefined, "DELETE");
    setBusy(false);
    if (!r.ok) setProblem(r.message);
    await refresh();
  };

  const others = view.people.filter((p) => !p.you);
  const left = view.you.expiresAt
    ? Math.max(
        0,
        Math.round((Date.parse(view.you.expiresAt) - now.getTime()) / 60_000),
      )
    : 0;

  return (
    <div className="mx-auto max-w-[1180px] px-4 pb-16 *:max-w-[820px] sm:px-8">
      {centre ? (
        <div className="mt-6">
          <PeopleMap
            centre={centre}
            people={view.people}
            pins={pins}
            accent={accent}
          />
        </div>
      ) : null}

      <section
        className="border-cf-line mt-5 rounded-2xl border bg-white p-5 shadow-[0_1px_2px_rgba(23,24,27,0.04)]"
        aria-label="Your location"
      >
        {view.you.sharing ? (
          <>
            <p className="text-[18px] font-semibold" data-testid="sharing">
              📡 You&apos;re sharing where you are
            </p>
            <p className="text-cf-slate mt-1 text-[15px]">
              For {left} more minute{left === 1 ? "" : "s"}, with people in this
              conference. It stops by itself, or now:
            </p>
            <button
              type="button"
              onClick={stop}
              disabled={busy}
              className="mt-3 min-h-12 w-full rounded-xl bg-[#b42318] px-5 text-[17px] font-semibold text-white"
            >
              Stop sharing now
            </button>
          </>
        ) : view.you.canShare ? (
          <>
            <p className="text-[18px] font-semibold">Share where you are</p>
            <p className="text-cf-slate mt-1 text-[15px]">
              Coworkers in this conference see you on this map until the time
              runs out or you stop. Nobody else ever does.
            </p>
            <div
              className="mt-3 flex flex-wrap gap-2"
              role="group"
              aria-label="For how long"
            >
              {SHARE_MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={minutes === m}
                  onClick={() => setMinutes(m)}
                  className={`min-h-11 rounded-full border px-3 text-[15px] ${
                    minutes === m
                      ? "border-cf-ink bg-cf-ink font-bold text-white"
                      : "border-cf-line"
                  }`}
                >
                  {LENGTH[m]}
                </button>
              ))}
            </div>
            <label className="mt-3 block text-[14px] font-bold">
              A note (optional)
              <input
                value={note}
                maxLength={60}
                onChange={(e) => setNote(e.target.value)}
                placeholder="By the big blue heron"
                className="border-cf-line mt-1 w-full rounded-xl border px-4 py-3 text-[16px] font-normal"
              />
            </label>
            <button
              type="button"
              onClick={start}
              disabled={busy}
              className={`${primary} mt-3 w-full`}
            >
              {busy ? "Finding you…" : `Share for ${LENGTH[minutes]}`}
            </button>
          </>
        ) : (
          <p className="text-cf-slate text-[15px]">
            To share where you are, first choose a name and to be seen on the{" "}
            <Link
              href={`/conferences/${conferenceId}#you`}
              className="underline"
            >
              conference page
            </Link>
            . You can still see coworkers who are sharing.
          </p>
        )}
        <Problem>{problem}</Problem>
      </section>

      <section className="mt-8" aria-label="Who's sharing">
        <h2 className="text-cf-mist text-[13px] font-bold tracking-[0.14em] uppercase">
          Sharing now · {others.length}
        </h2>
        {others.length ? (
          <ul className="mt-3 flex flex-col gap-2" data-testid="people-here">
            {others.map((p) => (
              <li
                key={p.memberId}
                className="border-cf-line flex items-center justify-between gap-3 rounded-2xl border p-3"
              >
                <span className="min-w-0">
                  <span className="block text-[17px] font-bold">{p.name}</span>
                  <span className="text-cf-mist text-[13px]">
                    {p.kmFromYou !== null
                      ? `${p.kmFromYou < 1 ? `${Math.round((p.kmFromYou * 1000) / 10) * 10} m` : `${p.kmFromYou.toFixed(1)} km`} away (straight line) · `
                      : ""}
                    {freshness(p.updatedAt, now)}
                    {p.accuracyM && p.accuracyM > 100
                      ? ` · within ${Math.round(p.accuracyM)} m`
                      : ""}
                    {p.note ? ` · “${p.note}”` : ""}
                  </span>
                </span>
                <Directions name={p.name} at={p.at} compact />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-cf-mist mt-3 text-[15px]">
            Nobody&apos;s sharing right now.
          </p>
        )}
      </section>
      <p className={`${secondary} text-cf-mist mt-8 border-0 px-0 text-[13px]`}>
        Positions are rounded to about 10 metres, kept only until each share
        ends, and deleted when you stop. Map © OpenStreetMap contributors,
        OpenFreeMap.
      </p>
    </div>
  );
}
