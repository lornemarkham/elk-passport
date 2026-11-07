"use client";

import { useCallback, useEffect, useState } from "react";
import {
  dayFor,
  headline,
  nowWords,
  skyWords,
  type Conditions,
} from "@/domain/snow/conditions";
import { MOUNTAINS } from "@/domain/snow/mountains";
import { Card, Source, btn } from "./kit";

const KEY = (id: string) => `passport.snow.conditions.${id}`;

function readCached(id: string): Conditions | null {
  try {
    const raw = localStorage.getItem(KEY(id));
    return raw ? (JSON.parse(raw) as Conditions) : null;
  } catch {
    return null;
  }
}

function ago(iso: string, now: Date): string {
  const min = Math.max(
    0,
    Math.round((now.getTime() - Date.parse(iso)) / 60000),
  );
  if (min < 2) return "just now";
  if (min < 90) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 36 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}

const dow = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("en-CA", {
    weekday: "short",
  });

/**
 * **What the sky is doing at the mountain, said honestly.**
 *
 * One model forecast for the resort's coordinates (never a position of the
 * person), the chosen day first, the next few days beside it. It keeps its
 * last good answer on the phone, so a chairlift with no signal still shows
 * "as of 9:40" instead of nothing — and says it is old. It never says the
 * snow is good: that is the resort's to say, and the link is right there.
 */
export function ConditionsCard({
  mountainName,
  date,
  today,
  now,
  compact = false,
}: {
  mountainName: string | undefined;
  date: string | undefined;
  today: string;
  now: Date;
  compact?: boolean;
}) {
  const known = MOUNTAINS.find((m) => m.name === mountainName);
  const id = known?.id;
  const [data, setData] = useState<Conditions | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "failed">("idle");

  const load = useCallback(async () => {
    if (!id) return;
    setState("loading");
    try {
      const res = await fetch(`/snow/api/conditions?mountain=${id}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { conditions?: Conditions };
      if (!body.conditions) throw new Error("empty");
      setData(body.conditions);
      setState("idle");
      try {
        localStorage.setItem(KEY(id), JSON.stringify(body.conditions));
      } catch {
        /* a full phone just means no offline copy */
      }
    } catch {
      setData((d) => d ?? readCached(id));
      setState("failed");
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- shows the offline copy first, then asks */
    setData(readCached(id));
    void load();
  }, [id, load]);

  if (!known)
    return (
      <Card className="space-y-2" data-testid="conditions">
        <h2 className="text-xl font-extrabold">Conditions</h2>
        <p className="text-sm text-[var(--sn-frost)]">
          {mountainName
            ? `Passport has no forecast for ${mountainName}. Ask the resort directly.`
            : "Choose a mountain and the forecast for it shows up here."}
        </p>
      </Card>
    );

  const want = date ?? today;
  const forDay = data ? dayFor(data, want) : undefined;
  const h = forDay ? headline(forDay) : null;
  const upcoming = data
    ? data.days.filter((d) => d.date >= today).slice(0, 4)
    : [];
  const farOut =
    data && !forDay && date && date > data.days[data.days.length - 1].date;
  const stale = data && state === "failed";

  return (
    <Card className="space-y-3" data-testid="conditions">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-extrabold">Conditions · {known.name}</h2>
        {data && (
          <Source kind={stale ? "static" : "live"}>
            Open-Meteo model, {ago(data.fetchedAt, now)}
          </Source>
        )}
      </div>

      {!data && state === "loading" && (
        <p className="text-sm" role="status">
          Asking for the forecast…
        </p>
      )}
      {!data && state === "failed" && (
        <p className="text-sm" role="status" data-testid="conditions-failed">
          Couldn&apos;t reach the forecast, and this phone has none saved. The
          resort&apos;s own report below is the real answer anyway.
        </p>
      )}
      {stale && (
        <p className="text-sm text-[var(--sn-glow)]" role="status">
          No signal right now. This is the last forecast this phone got (
          {ago(data.fetchedAt, now)}).
        </p>
      )}

      {data?.now && today === want && (
        <p className="text-lg font-bold" data-testid="conditions-now">
          Right now: {nowWords(data.now)}
        </p>
      )}

      {h && forDay && (
        <div data-testid="conditions-day" className="space-y-2">
          <p className="text-lg font-bold">
            {today === want ? "Today" : dow(want)}: {h.line}
          </p>
          {h.tips.length > 0 && !compact && (
            <ul className="space-y-1 text-sm">
              {h.tips.map((t) => (
                <li key={t} className="flex gap-2">
                  <span aria-hidden="true">•</span>
                  {t}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {farOut && (
        <p className="text-sm text-[var(--sn-frost)]">
          Your day is further out than any forecast reaches (it stops at{" "}
          {data.days[data.days.length - 1].date}). Check back closer to it.
        </p>
      )}

      {upcoming.length > 0 && !compact && (
        <ul
          className="grid grid-cols-4 gap-2 text-center text-sm"
          aria-label="Next days"
        >
          {upcoming.map((d) => (
            <li
              key={d.date}
              className="rounded-xl border border-[var(--sn-line)] p-2"
            >
              <div className="font-bold">{dow(d.date)}</div>
              <div>{skyWords(d.code)}</div>
              <div className="tabular-nums">
                {Math.round(d.minC)}° / {Math.round(d.maxC)}°
              </div>
              {d.snowCm >= 0.5 && (
                <div className="font-semibold text-[var(--sn-aurora)]">
                  {Math.round(d.snowCm)} cm
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-[var(--sn-frost)]">
        A weather model for the valley point near the resort
        {data?.elevationM != null &&
          ` (about ${Math.round(data.elevationM)} m)`}
        , not a reading from the hill. It is colder and snowier up top. Snow
        depth, open lifts and runs are the resort&apos;s to say.{" "}
        <a
          className="underline"
          href="https://open-meteo.com/"
          target="_blank"
          rel="noreferrer"
        >
          Weather data by Open-Meteo.com
        </a>{" "}
        (CC BY 4.0).
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn} onClick={() => void load()}>
          {state === "loading" ? "Checking…" : "Refresh"}
        </button>
        <a
          className={`${btn} inline-flex items-center`}
          href={known.site}
          target="_blank"
          rel="noreferrer"
        >
          Snow report &amp; lift status ↗
        </a>
      </div>
    </Card>
  );
}
