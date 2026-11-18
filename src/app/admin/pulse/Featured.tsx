"use client";

import { useCallback, useEffect, useState } from "react";
import type { Card } from "@/lib/pulse/service";

interface Data {
  today: string;
  featured: { day: string; id: string; question: string; total: number }[];
  candidates: Card[];
}

const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Choose which Pulse is the Question of the Day: today or a day coming up. */
export function Featured() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [day, setDay] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/pulse/admin", { cache: "no-store" });
    if (!res.ok) return setError(`Couldn't load (${res.status}).`);
    const body: Data = await res.json();
    setData(body);
    setDay((d) => d || body.today);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the first read of the schedule from the server
    void load();
  }, [load]);

  async function pick(id: string | null, forDay = day) {
    setError(null);
    const res = await fetch("/api/pulse/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day: forDay, id }),
    });
    if (!res.ok) setError(`That didn't save (${res.status}).`);
    await load();
  }

  if (!data) return error ? <p role="alert">{error}</p> : <p>Loading…</p>;
  const days = Array.from({ length: 7 }, (_, i) => addDays(data.today, i));
  const chosen = data.featured.find((f) => f.day === day);
  return (
    <section data-testid="pulse-featured-admin" className="grid gap-4">
      {error ? (
        <p role="alert" className="text-[#b42318]">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Day">
        {days.map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={d === day}
            onClick={() => setDay(d)}
            className={`min-h-10 rounded-full border px-4 text-[13px] font-semibold ${
              d === day
                ? "border-[#14161a] bg-[#14161a] text-white"
                : "border-[#d9d4c8] bg-white"
            }`}
          >
            {d === data.today ? "Today" : d.slice(5)}
            {data.featured.some((f) => f.day === d) ? " ✓" : ""}
          </button>
        ))}
      </div>
      <p className="text-[14px]" data-testid="pulse-featured-current">
        {chosen ? (
          <>
            {day}: <strong>{chosen.question}</strong> ({chosen.total} votes){" "}
            <button
              type="button"
              className="ml-1 font-semibold underline"
              onClick={() => pick(null)}
            >
              Clear
            </button>
          </>
        ) : (
          <>{day}: nothing featured.</>
        )}
      </p>
      <ul className="grid gap-2">
        {data.candidates.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-[#e7e3da] bg-white p-3"
          >
            <span className="text-[14px]">
              {c.question}{" "}
              <span className="text-[#5c6370]">· {c.total} votes</span>
            </span>
            <button
              type="button"
              disabled={chosen?.id === c.id}
              data-testid={`pulse-feature-${c.id}`}
              onClick={() => pick(c.id)}
              className="min-h-10 shrink-0 rounded-full border border-[#d9d4c8] px-4 text-[13px] font-semibold hover:border-[#14161a] disabled:opacity-40"
            >
              Feature
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
