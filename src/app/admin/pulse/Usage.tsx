"use client";

import { useEffect, useState } from "react";
import type { Usage as U } from "@/lib/pulse/store";
import { usageName } from "@/lib/pulse/templates";

const cell = "py-1.5 pr-3 text-right tabular-nums";

/**
 * **Which experiences people actually use and share**, last 30 days. Counts
 * only: questions made, votes, votes that came through a shared link, shares,
 * results cards, opened links, and browsers that came back another day.
 */
export function Usage() {
  const [u, setU] = useState<U | null | "missing">(null);
  useEffect(() => {
    fetch("/api/pulse/admin", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => setU(b?.usage ?? "missing"))
      .catch(() => setU("missing"));
  }, []);
  if (u === null) return <p className="text-[14px] text-[#5c6370]">Loading…</p>;
  if (u === "missing")
    return (
      <p
        className="rounded-xl bg-amber-50 p-3 text-[14px] text-amber-900"
        data-testid="pulse-usage-missing"
      >
        Usage needs the Quick Ideas migration
        (20261119000000_passport_pulse_modes.sql).
      </p>
    );
  const sum = (f: (d: U["daily"][number]) => number) =>
    u.daily.reduce((a, d) => a + f(d), 0);
  const created = sum((d) => d.created);
  const votes = sum((d) => d.votes);
  const referred = sum((d) => d.referredVotes);
  const ev = (k: keyof U["daily"][number]["events"]) =>
    sum((d) => d.events[k] ?? 0);
  const tiles = [
    ["Questions created", created],
    ["Votes", votes],
    ["Shares started", ev("share") + ev("circle-ask")],
    ["Results cards", ev("card")],
    ["Shared links opened", ev("link-open")],
    ["Votes via a shared link", referred],
    [
      "Link opens → votes",
      ev("link-open")
        ? `${Math.round((referred * 100) / ev("link-open"))}%`
        : "—",
    ],
    ["Returning voters", `${u.returningVoters} of ${u.voters}`],
  ] as const;
  return (
    <div className="grid gap-5" data-testid="pulse-usage">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map(([label, value]) => (
          <li
            key={label}
            className="rounded-xl border border-[#e7e3da] bg-white p-3"
          >
            <p className="text-[12px] text-[#5c6370]">{label}</p>
            <p className="text-[22px] font-bold tabular-nums">{value}</p>
          </li>
        ))}
      </ul>
      <div className="grid gap-5 sm:grid-cols-2">
        <table className="w-full text-[14px]">
          <caption className="text-left text-[13px] font-semibold">
            By experience
          </caption>
          <thead>
            <tr className="text-[12px] text-[#5c6370]">
              <th className="py-1.5 text-left font-medium">Experience</th>
              <th className={cell}>Made</th>
              <th className={cell}>Votes</th>
            </tr>
          </thead>
          <tbody>
            {u.byKind.map((k) => (
              <tr key={k.kind} className="border-t border-[#f0ede6]">
                <td className="py-1.5">{usageName(k.kind)}</td>
                <td className={cell}>{k.created}</td>
                <td className={cell}>{k.votes}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="w-full text-[14px]">
          <caption className="text-left text-[13px] font-semibold">
            Templates used
          </caption>
          <tbody>
            {u.byTemplate.length === 0 ? (
              <tr>
                <td className="py-1.5 text-[#5c6370]">None yet.</td>
              </tr>
            ) : (
              u.byTemplate.map((t) => (
                <tr key={t.template} className="border-t border-[#f0ede6]">
                  <td className="py-1.5">
                    {usageName(t.template.replace(/^topic-/, ""))}
                  </td>
                  <td className={cell}>{t.created}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[12.5px] text-[#5c6370]">
        UTC days. A returning voter is a browser that voted on two or more days;
        nothing here identifies a person, and link opens are counted once per
        tab.
      </p>
    </div>
  );
}
