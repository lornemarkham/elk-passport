"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { REPORT_REASONS, type PulseStatus } from "@/lib/pulse/model";
import type { Reported } from "@/lib/pulse/store";

const ACTIONS: { status: PulseStatus; label: string }[] = [
  { status: "live", label: "Put back live" },
  { status: "review", label: "Pause" },
  { status: "removed", label: "Remove" },
];

export function Moderation() {
  const [items, setItems] = useState<Reported[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/pulse/admin", { cache: "no-store" });
    if (res.ok) setItems((await res.json()).items);
    else setError(`Couldn't load the queue (${res.status}).`);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the first read of the queue from the server
    void load();
  }, [load]);

  async function set(id: string, status: PulseStatus) {
    const res = await fetch("/api/pulse/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) setError(`That didn't save (${res.status}).`);
    await load();
  }

  if (error)
    return (
      <p role="alert" className="text-[#b42318]">
        {error}
      </p>
    );
  if (!items) return <p>Loading…</p>;
  if (items.length === 0)
    return <p data-testid="pulse-admin-empty">Nothing reported. 🎉</p>;
  return (
    <ul className="grid gap-3" data-testid="pulse-admin-list">
      {items.map(({ pulse, total, reports }) => (
        <li
          key={pulse.id}
          className="rounded-2xl border border-[#e7e3da] bg-white p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <Link
              href={`/labs/pulse/${pulse.id}`}
              className="font-semibold underline-offset-2 hover:underline"
            >
              {pulse.question}
            </Link>
            <span className="shrink-0 rounded-full border px-2 py-0.5 text-[12px] font-semibold uppercase">
              {pulse.status}
            </span>
          </div>
          <p className="mt-1 text-[13px] text-[#5c6370]">
            {total} votes · {reports.length} report
            {reports.length === 1 ? "" : "s"}
          </p>
          {reports.length ? (
            <ul className="mt-2 grid gap-1 text-[13.5px]">
              {reports.map((r, i) => (
                <li key={i}>
                  <strong>{REPORT_REASONS[r.reason] ?? r.reason}</strong>
                  {r.note ? ` — ${r.note}` : ""}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {ACTIONS.filter((a) => a.status !== pulse.status).map((a) => (
              <button
                key={a.status}
                type="button"
                onClick={() => set(pulse.id, a.status)}
                className="min-h-10 rounded-full border border-[#d9d4c8] px-4 text-[13px] font-semibold hover:border-[#14161a]"
              >
                {a.label}
              </button>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
