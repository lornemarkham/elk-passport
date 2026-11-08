"use client";

import { useState } from "react";
import type { Mountain } from "@/domain/snow/mountains";
import {
  checkedWords,
  dateChoices,
  isStaleFact,
  liftHoursOn,
  seasonOn,
  type ResortFacts,
} from "@/domain/snow/resorts";
import { clockWords } from "@/domain/snow/itinerary";
import type { TabProps } from "./tabs";
import { newId } from "./store";
import { Source, btn, btnOn, field, styles } from "./kit";

export const dayWords = (ymd: string) =>
  new Date(`${ymd}T12:00:00`).toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

/**
 * **What the resort has published — quoted, linked and dated.** Opening
 * dates are the resort's plan with its own caveat; status is what its page
 * said when Passport last read it, never "now".
 */
export function ResortFactsCard({
  mountain,
  facts,
  today,
}: {
  mountain?: Mountain;
  facts?: ResortFacts;
  today: string;
}) {
  if (!mountain)
    return (
      <p className={`text-sm ${styles.muted}`}>
        Pick a mountain and Passport shows what its resort has published.
      </p>
    );
  if (!facts)
    return (
      <div className="space-y-2 text-sm" data-testid="resort-facts">
        <Source kind="missing">resort facts</Source>
        <p className={styles.muted}>
          Passport hasn&apos;t read {mountain.name}&apos;s published season yet,
          so it won&apos;t guess an opening date, lift hours or status.
        </p>
        <a
          className="font-semibold underline"
          href={mountain.site}
          target="_blank"
          rel="noreferrer"
        >
          {mountain.name} — official site
        </a>
      </div>
    );
  const s = facts.season;
  const status = facts.statusWhenChecked;
  const hours = facts.liftHours;
  const old = s && isStaleFact(s.opens.checked, today);
  return (
    <div className="space-y-3 text-sm" data-testid="resort-facts">
      <div className="flex flex-wrap gap-2">
        <Source kind="static">
          published by {mountain.name} ·{" "}
          {checkedWords(s?.opens.checked ?? today, today)}
        </Source>
        {old && (
          <span className="rounded-full bg-[var(--sn-glow)]/20 px-2.5 py-1 text-[11px] font-bold">
            Old — read the resort&apos;s page before relying on it
          </span>
        )}
      </div>
      {s && (
        <div>
          <p className="text-xs font-bold tracking-wide text-[var(--sn-frost)] uppercase">
            {s.label}
          </p>
          <p className="text-lg font-extrabold" data-testid="opening-day">
            Opening day {dayWords(s.opens.value)}
          </p>
          <p className={styles.muted}>
            “{s.opens.quote}”
            {s.also?.map((a) => ` · “${a.date.quote}”`).join("")}
          </p>
          <p className="text-xs text-[var(--sn-frost)]">{s.caveat}</p>
        </div>
      )}
      {hours && (
        <p>
          <span className="font-semibold">Lift hours:</span>{" "}
          {clockWords(hours.value.from)}–{clockWords(hours.value.to)} · “
          {hours.quote}”
        </p>
      )}
      {status && (
        <p data-testid="status-when-checked">
          <span className="font-semibold">
            Status on {dayWords(status.checked)}:
          </span>{" "}
          “{status.value}”. Not live — today&apos;s lifts and runs are on the
          resort&apos;s page.
        </p>
      )}
      <ul className="flex flex-wrap gap-2" aria-label="Official pages">
        {(
          [
            ["Snow report", facts.links.conditions],
            ["Lift status", facts.links.lifts],
            ["Hours", facts.links.hours],
            ["Lift tickets", facts.links.tickets],
            ["Events", facts.links.events],
            ["Official site", facts.official],
          ] as const
        )
          .filter(([, url]) => url)
          .map(([label, url]) => (
            <li key={label}>
              <a
                className={`${btn} inline-flex items-center`}
                href={url}
                target="_blank"
                rel="noreferrer"
              >
                {label} ↗
              </a>
            </li>
          ))}
      </ul>
    </div>
  );
}

/**
 * **When: the dates a crew actually means**, then any date. Opening weekend
 * appears only from a published opening day. A shared day's guest
 * suggests a date to the crew; the host (or a one-phone day) sets it.
 */
export function DatePicker({
  day,
  me,
  act,
  today,
  shared,
  facts,
  mountain,
}: TabProps & { facts?: ResortFacts; mountain?: Mountain }) {
  const [picking, setPicking] = useState(false);
  const choices = dateChoices(today, facts);
  const canSet = !shared || shared.isOwner;
  function choose(date: string) {
    if (canSet) act({ type: "when", date, meetTime: day.meetTime });
    else
      act({
        type: "propose",
        proposal: {
          id: newId(),
          topic: "date",
          label: date,
          by: me.id,
          source: "crew",
        },
      });
  }
  const season = day.date ? seasonOn(facts, day.date) : undefined;
  const hours = day.date ? liftHoursOn(facts, day.date) : undefined;
  return (
    <div className="space-y-3" data-testid="date-picker">
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Pick a day"
      >
        {choices.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={day.date === c.date}
            onClick={() => choose(c.date)}
            className={`${btn} ${day.date === c.date ? btnOn : ""} text-left`}
            data-testid={`date-${c.key}`}
          >
            {c.label} · {dayWords(c.date)}
          </button>
        ))}
        <button
          type="button"
          aria-expanded={picking}
          onClick={() => setPicking((p) => !p)}
          className={btn}
        >
          Pick a date
        </button>
      </div>
      {choices[0]?.key === "opening" && (
        <p className="text-xs text-[var(--sn-frost)]">
          Opening weekend, from {mountain?.name}&apos;s own page:{" "}
          {choices[0].because}
        </p>
      )}
      {picking && (
        <label className="block max-w-xs space-y-1.5">
          <span className="text-sm font-semibold">Date</span>
          <input
            type="date"
            min={today}
            className={field}
            value={day.date ?? ""}
            onChange={(e) => e.target.value && choose(e.target.value)}
          />
        </label>
      )}
      <label className="block max-w-xs space-y-1.5">
        <span className="text-sm font-semibold">Meet at</span>
        <input
          type="time"
          className={field}
          value={day.meetTime ?? ""}
          disabled={!canSet}
          onChange={(e) =>
            act({ type: "when", date: day.date, meetTime: e.target.value })
          }
        />
      </label>
      {!canSet && (
        <p className="text-xs text-[var(--sn-frost)]">
          The host sets the date; yours goes to the crew as a suggestion.
        </p>
      )}
      {day.date && (
        <p className="text-sm" data-testid="date-season">
          {season === "open" &&
            `Inside ${mountain?.name ?? "the resort"}'s published season. ${facts?.season?.caveat ?? ""}`}
          {season === "before" &&
            `Before ${mountain?.name}'s published opening day (${dayWords(facts!.season!.opens.value)}) — the lifts may not be running.`}
          {season === "after" &&
            `After ${mountain?.name}'s published closing day.`}
          {season === "unknown" &&
            "Passport doesn't have this resort's published season, so it can't say whether it's open that day."}
          {hours &&
            ` Lifts ${clockWords(hours.value.from)}–${clockWords(hours.value.to)} (published).`}
        </p>
      )}
    </div>
  );
}
