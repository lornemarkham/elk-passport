"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { chosenFor, type Person } from "@/domain/snow/day";
import { countdownToDay, phaseOf, type Phase } from "@/domain/snow/prep";
import { useSnowDay } from "./store";
import { TABS, type TabKey } from "./tabs";
import { Card, SoftLink, btn, field, styles } from "./kit";
import { PlanTab } from "./PlanTab";
import { CrewTab } from "./CrewTab";
import { HypeTab } from "./HypeTab";
import { PlayTab } from "./PlayTab";
import { MountainTab } from "./MountainTab";
import { MemoriesTab } from "./MemoriesTab";

const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const START_TAB: Record<Phase, TabKey> = {
  planning: "plan",
  soon: "hype",
  day: "mountain",
  after: "memories",
};

function useNow(everyMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- reads the browser */
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}

export function SnowDayScreen({ id }: { id: string }) {
  const { day, status, act, problem, clearProblem, me, setMe } = useSnowDay(id);
  const now = useNow();
  const online = useOnline();
  const [tab, setTab] = useState<TabKey | null>(null);
  // Where the day opens follows how close it is — once. Planning a date that
  // happens to fall this week must not yank the screen out from under you.
  const [opening, setOpening] = useState<TabKey | null>(null);
  const openingPhase = day ? phaseOf(day.date, localDay(new Date())) : null;
  useEffect(() => {
    if (openingPhase && opening === null)
      /* eslint-disable-next-line react-hooks/set-state-in-effect -- decided once, when the day first loads */
      setOpening(START_TAB[openingPhase]);
  }, [openingPhase, opening]);

  if (status === "loading")
    return (
      <main className="mx-auto max-w-3xl px-5 pt-28">Opening your day…</main>
    );
  if (status === "missing" || !day)
    return (
      <main className="mx-auto max-w-xl space-y-4 px-5 pt-28 pb-24">
        <h1 className="text-3xl font-black">
          This day isn&apos;t on this phone
        </h1>
        <p className={styles.muted}>
          Snow days are kept on the device that made them. If a friend sent you
          a link, open that link; if you made it on another phone, it&apos;s
          there.
        </p>
        <SoftLink href="/snow/new">Start a new one</SoftLink>
      </main>
    );

  const meP: Person | undefined = day.people.find((p) => p.id === me);
  const today = localDay(now);
  const phase = phaseOf(day.date, today);
  const active: TabKey = tab ?? opening ?? START_TAB[phase];
  const mountain = chosenFor(day, "mountain");
  const cd = countdownToDay(now, day);
  const latest = day.announcements[0];

  if (!meP)
    return (
      <main className="mx-auto max-w-xl space-y-4 px-5 pt-28 pb-24">
        <h1 className="text-3xl font-black">Who&apos;s holding this phone?</h1>
        <div className="grid gap-2">
          {day.people.map((p) => (
            <button
              key={p.id}
              className={`${btn} text-left`}
              onClick={() => setMe(p.id)}
            >
              {p.name}
            </button>
          ))}
        </div>
      </main>
    );

  const props = { day, me: meP, act, today, now };

  return (
    <main className="mx-auto max-w-3xl px-4 pt-20 pb-28 sm:px-5">
      <header className="mb-4 space-y-3">
        <p className="flex flex-wrap items-center gap-2 text-xs font-bold tracking-widest text-[var(--sn-aurora)] uppercase">
          Snow day
          <span
            data-testid="connectivity"
            className={`${online ? styles.live : styles.static} rounded-full px-2.5 py-1 tracking-normal normal-case`}
          >
            {online ? "Online" : "Offline — your day still works here"}
          </span>
        </p>
        <h1
          className="text-4xl leading-none font-black sm:text-5xl"
          data-testid="day-title"
        >
          {day.title}
        </h1>
        <p className="text-[var(--sn-frost)]">
          {[
            mountain?.label,
            day.date &&
              new Date(`${day.date}T12:00:00`).toLocaleDateString("en-CA", {
                weekday: "long",
                month: "long",
                day: "numeric",
              }),
            day.meetTime && `meet ${day.meetTime}`,
            `${day.people.length} in`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {cd && !cd.past && (
          <p
            className="text-3xl font-black tabular-nums"
            data-testid="countdown"
            aria-label="Countdown to the day"
          >
            {cd.units.map((u) => (
              <span key={u.unit} className="mr-3">
                {u.value}
                <span className="ml-1 text-sm font-semibold text-[var(--sn-frost)]">
                  {u.unit}
                </span>
              </span>
            ))}
          </p>
        )}
        {latest && (
          <Card
            className="border-[var(--sn-glow)]"
            role="status"
            data-testid="latest-update"
          >
            <p className="text-xs font-bold text-[var(--sn-glow)] uppercase">
              {latest.kind === "change" ? "Plan changed" : "Update"}
            </p>
            <p className="font-semibold">{latest.text}</p>
          </Card>
        )}
      </header>

      <nav
        aria-label="Snow day sections"
        className="sticky top-14 z-10 -mx-4 mb-4 overflow-x-auto bg-[#0b1d33]/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-full"
      >
        <div role="tablist" className="flex gap-2">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              role="tab"
              id={`tab-${key}`}
              aria-selected={active === key}
              aria-controls={`panel-${key}`}
              onClick={() => {
                setTab(key);
                clearProblem();
              }}
              className={`${styles.tab} ${btn} whitespace-nowrap ${active === key ? styles.on : ""}`}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      {problem && (
        <p
          role="alert"
          className="mb-3 rounded-xl border border-[var(--sn-glow)] p-3 text-sm font-semibold"
          data-testid="problem"
        >
          {problem}
        </p>
      )}

      <div
        role="tabpanel"
        id={`panel-${active}`}
        aria-labelledby={`tab-${active}`}
      >
        {active === "plan" && <PlanTab {...props} />}
        {active === "crew" && <CrewTab {...props} />}
        {active === "hype" && <HypeTab {...props} />}
        {active === "play" && <PlayTab {...props} />}
        {active === "mountain" && <MountainTab {...props} />}
        {active === "memories" && <MemoriesTab {...props} />}
      </div>

      <footer className="mt-10 flex flex-wrap items-center gap-3 text-sm text-[var(--sn-frost)]">
        <label className="flex items-center gap-2">
          You are
          <select
            className={`${field} !w-auto`}
            value={meP.id}
            onChange={(e) => setMe(e.target.value)}
            aria-label="Who is using this phone"
          >
            {day.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <Link href="/snow" className="underline">
          All snow days
        </Link>
      </footer>
    </main>
  );
}
