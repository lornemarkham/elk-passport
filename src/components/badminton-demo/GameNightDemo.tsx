"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  TYPICAL_MATCH_MINUTES,
  advance,
  clockLabel,
  estimatedWaits,
  finishMatch,
  newDemo,
  playerById,
  queue,
  restore,
  toggleRest,
  type Demo,
  type DemoPlayer,
  type Level,
  type Match,
  type Team,
} from "@/lib/badminton-demo/scoreboard";

/**
 * **Badminton Game Night — the scoreboard demo.** 25 fictional players on
 * 4 doubles courts, with levels, scores, wins and losses, a waiting queue
 * and estimated waits. Everything lives in this browser (`localStorage`);
 * Reset Demo starts the night again. Not the CourtQueue club app.
 */

export const DEMO_STORAGE_KEY = "ghad_badminton_game_night_v1";

const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

const LEVEL_TONE: Record<Level, string> = {
  1: "bg-sky-400/20 text-sky-200 ring-sky-300/40",
  2: "bg-teal-400/20 text-teal-200 ring-teal-300/40",
  3: "bg-lime-400/20 text-lime-200 ring-lime-300/40",
  4: "bg-amber-400/20 text-amber-200 ring-amber-300/40",
  5: "bg-rose-400/20 text-rose-200 ring-rose-300/40",
};

function LevelChip({ level }: { level: Level }) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[11px] font-black ring-1",
        LEVEL_TONE[level],
      )}
      title={`Level ${level} of 5`}
    >
      L{level}
    </span>
  );
}

const minutes = (n: number) => (n === 0 ? "now" : `~${n} min`);

type Sort = "line" | "wins" | "games" | "level" | "name";

export function GameNightDemo() {
  const [demo, setDemo] = useState<Demo | null>(null);
  const [auto, setAuto] = useState(false);
  const [scoring, setScoring] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("line");

  // Restored from this browser, so a reload (or tomorrow) carries on.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restores the saved demo night from localStorage
    setDemo(restore(localStorage.getItem(DEMO_STORAGE_KEY)) ?? newDemo());
  }, []);
  useEffect(() => {
    if (demo) localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(demo));
  }, [demo]);

  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => setDemo((d) => (d ? advance(d, 1) : d)), 1000);
    return () => clearInterval(t);
  }, [auto]);

  const step = useCallback((n: number) => {
    setDemo((d) => (d ? advance(d, n) : d));
  }, []);
  const reset = useCallback(() => {
    localStorage.removeItem(DEMO_STORAGE_KEY);
    setAuto(false);
    setScoring(null);
    setError(null);
    setDemo(newDemo(Math.floor(Math.random() * 1e6)));
  }, []);
  const finish = useCallback(
    (court: number, score?: readonly [number, number]) => {
      if (!demo) return;
      const out = finishMatch(demo, court, score);
      if (!out.ok) {
        setError(out.error);
        return;
      }
      setError(null);
      setScoring(null);
      setDemo(out.demo);
    },
    [demo],
  );

  const line = useMemo(() => (demo ? queue(demo) : []), [demo]);
  const waits = useMemo(
    () => (demo ? estimatedWaits(demo) : new Map<string, number>()),
    [demo],
  );

  if (!demo)
    return (
      <p className="mt-24 text-center text-white/60">Setting up the courts…</p>
    );

  const position = new Map(line.map((p, i) => [p.id, i + 1]));
  const playing = demo.players.filter((p) => p.status === "playing").length;
  const resting = demo.players.filter((p) => p.status === "resting").length;

  return (
    <main
      data-testid="gn-demo"
      className="mx-auto max-w-7xl px-3 pt-4 pb-20 sm:px-6"
    >
      <header className="space-y-3">
        <p
          data-testid="gn-demo-label"
          className="inline-flex flex-wrap items-center gap-2 rounded-full bg-amber-300 px-3 py-1 text-xs font-black tracking-wide text-slate-950 uppercase"
        >
          Demo · 25 fictional players · nothing here is real
        </p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black sm:text-4xl">
              🏸 Badminton Game Night
            </h1>
            <p className="text-white/70">
              4 courts · doubles · levels 1–5 · scores, wins and losses ·
              automatic rotation
            </p>
          </div>
          <p className="text-right">
            <span
              data-testid="gn-clock"
              className="block text-3xl font-black tabular-nums"
            >
              {clockLabel(demo.now)}
            </span>
            <span className="text-sm text-white/60">
              {demo.now} min in · {playing} playing · {line.length} waiting
              {resting ? ` · ${resting} sitting out` : ""}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Ctl
            testId="gn-auto"
            onClick={() => setAuto((a) => !a)}
            strong
            pressed={auto}
          >
            {auto ? "⏸ Pause" : "▶ Play the night"}
          </Ctl>
          <Ctl testId="gn-advance-1" onClick={() => step(1)}>
            +1 min
          </Ctl>
          <Ctl testId="gn-advance-5" onClick={() => step(5)}>
            +5 min
          </Ctl>
          <Ctl testId="gn-advance-15" onClick={() => step(15)}>
            +15 min
          </Ctl>
          <Ctl testId="gn-reset" onClick={reset} danger>
            Reset Demo
          </Ctl>
        </div>
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-rose-500/20 px-3 py-2 text-rose-100"
          >
            {error}
          </p>
        )}
      </header>

      <section aria-labelledby="gn-courts" className="mt-6">
        <h2 id="gn-courts" className="sr-only">
          Courts
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {demo.courts.map((m, i) => (
            <CourtCard
              key={i}
              court={i + 1}
              match={m}
              demo={demo}
              scoring={scoring === i + 1}
              onScore={() => {
                setError(null);
                setScoring(scoring === i + 1 ? null : i + 1);
              }}
              onFinish={(score) => finish(i + 1, score)}
            />
          ))}
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <section aria-labelledby="gn-queue-title">
          <h2 id="gn-queue-title" className="text-xl font-black">
            Waiting queue{" "}
            <span className="text-base font-semibold text-white/50">
              ({line.length})
            </span>
          </h2>
          <p className="text-sm text-white/60">
            Four go on whenever a court comes free; front of the line always
            plays, with partners close in level. Estimates use each court&apos;s
            finish time, then {TYPICAL_MATCH_MINUTES} min a game.
          </p>
          <ol data-testid="gn-queue" className="mt-2 space-y-1.5">
            {line.map((p, i) => (
              <li
                key={p.id}
                data-testid="gn-queue-row"
                className={cx(
                  "flex items-center gap-2 rounded-xl px-3 py-2 ring-1",
                  i < 4
                    ? "bg-lime-300/10 ring-lime-300/30"
                    : "bg-white/[0.05] ring-white/10",
                )}
              >
                <span className="w-6 shrink-0 text-right font-black text-white/50 tabular-nums">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate font-bold">
                  {p.name}
                </span>
                <LevelChip level={p.level} />
                <span
                  data-testid="gn-wait"
                  className="w-16 shrink-0 text-right text-sm text-white/70 tabular-nums"
                >
                  {minutes(waits.get(p.id) ?? 0)}
                </span>
              </li>
            ))}
            {line.length === 0 && (
              <li className="text-white/50">Nobody waiting.</li>
            )}
          </ol>
        </section>

        <section aria-labelledby="gn-players-title">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="gn-players-title" className="text-xl font-black">
              Players{" "}
              <span className="text-base font-semibold text-white/50">
                ({demo.players.length})
              </span>
            </h2>
            <label className="text-sm text-white/70">
              Sort by{" "}
              <select
                data-testid="gn-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="rounded-lg bg-white/10 px-2 py-1 text-white"
              >
                <option value="line">Status</option>
                <option value="wins">Most wins</option>
                <option value="games">Games played</option>
                <option value="level">Level</option>
                <option value="name">Name</option>
              </select>
            </label>
          </div>
          <div
            aria-hidden
            className="mt-2 hidden grid-cols-[minmax(0,1.6fr)_3rem_5.5rem_3.5rem_4rem_4rem_4rem_6rem] gap-2 px-3 text-xs font-bold tracking-wide text-white/50 uppercase md:grid"
          >
            <span>Player</span>
            <span>Level</span>
            <span>Status</span>
            <span className="text-right">Games</span>
            <span className="text-right">W–L</span>
            <span className="text-right">Played</span>
            <span className="text-right">Waited</span>
            <span />
          </div>
          <ul className="mt-1 space-y-1.5">
            {sorted(demo.players, sort, position).map((p) => (
              <PlayerRow
                key={p.id}
                p={p}
                demo={demo}
                position={position.get(p.id)}
                wait={waits.get(p.id)}
                onRest={() => setDemo((d) => (d ? toggleRest(d, p.id) : d))}
              />
            ))}
          </ul>
        </section>
      </div>

      <section aria-labelledby="gn-results-title" className="mt-6">
        <h2 id="gn-results-title" className="text-xl font-black">
          Results
        </h2>
        {demo.results.length === 0 ? (
          <p className="text-white/60">
            No games finished yet. Press <b>+15 min</b>, or finish a court and
            enter its score.
          </p>
        ) : (
          <ul className="mt-2 grid gap-1.5 md:grid-cols-2">
            {demo.results.slice(0, 12).map((r) => (
              <Result key={r.id} r={r} demo={demo} />
            ))}
          </ul>
        )}
      </section>

      <p className="mt-10 text-center text-sm text-white/50">
        A demonstration with made-up people.{" "}
        <Link href="/badminton" className="text-lime-300 underline">
          Back to CourtQueue
        </Link>
      </p>
    </main>
  );
}

function sorted(
  players: readonly DemoPlayer[],
  sort: Sort,
  position: Map<string, number>,
): DemoPlayer[] {
  const status = (p: DemoPlayer) =>
    p.status === "playing" ? 0 : p.status === "waiting" ? 1 : 2;
  const by: Record<Sort, (a: DemoPlayer, b: DemoPlayer) => number> = {
    line: (a, b) =>
      status(a) - status(b) ||
      (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0) ||
      a.name.localeCompare(b.name),
    wins: (a, b) => b.wins - a.wins || a.losses - b.losses,
    games: (a, b) => b.games - a.games || a.name.localeCompare(b.name),
    level: (a, b) => b.level - a.level || a.name.localeCompare(b.name),
    name: (a, b) => a.name.localeCompare(b.name),
  };
  return [...players].sort(by[sort]);
}

function Ctl({
  children,
  onClick,
  testId,
  strong,
  danger,
  pressed,
}: {
  children: React.ReactNode;
  onClick: () => void;
  testId: string;
  strong?: boolean;
  danger?: boolean;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={pressed}
      onClick={onClick}
      className={cx(
        "min-h-11 rounded-full px-4 font-bold",
        strong
          ? "bg-lime-300 text-slate-950"
          : danger
            ? "bg-rose-500/20 text-rose-100 ring-1 ring-rose-300/40"
            : "bg-white/10 text-white ring-1 ring-white/15",
      )}
    >
      {children}
    </button>
  );
}

function TeamLine({ team, demo }: { team: Team; demo: Demo }) {
  return (
    <span className="flex min-w-0 flex-col gap-1">
      {team.map((id) => {
        const p = playerById(demo, id);
        return (
          <span key={id} className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-bold">{p.name}</span>
            <LevelChip level={p.level} />
          </span>
        );
      })}
    </span>
  );
}

function CourtCard({
  court,
  match,
  demo,
  scoring,
  onScore,
  onFinish,
}: {
  court: number;
  match: Match | null;
  demo: Demo;
  scoring: boolean;
  onScore: () => void;
  onFinish: (score?: readonly [number, number]) => void;
}) {
  const [a, setA] = useState("21");
  const [b, setB] = useState("");
  return (
    <article
      data-testid={`gn-court-${court}`}
      data-status={match ? "playing" : "open"}
      className="rounded-2xl bg-emerald-900/40 p-3 ring-1 ring-emerald-300/20"
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-xl font-black">Court {court}</h3>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-black uppercase">
          {match ? `Playing · ${demo.now - match.startedAt} min` : "Open"}
        </span>
      </div>
      {match ? (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-xl border-2 border-white/30 bg-emerald-700/30 p-2">
            <TeamLine team={match.teams[0]} demo={demo} />
            <span className="text-xs font-black text-white/50">VS</span>
            <TeamLine team={match.teams[1]} demo={demo} />
          </div>
          <p className="mt-2 text-sm text-white/70">
            Started {clockLabel(match.startedAt)} · ends about{" "}
            {clockLabel(match.endsAt)}
          </p>
          {scoring ? (
            <form
              className="mt-2 space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                onFinish([Number(a), Number(b)]);
              }}
            >
              <div className="flex items-center gap-2">
                <input
                  data-testid={`gn-score-a-${court}`}
                  aria-label={`Court ${court} team A points`}
                  inputMode="numeric"
                  value={a}
                  onChange={(e) => setA(e.target.value.replace(/\D/g, ""))}
                  className="w-16 rounded-lg bg-white px-2 py-2 text-center text-lg font-black text-slate-950"
                />
                <span className="font-black">–</span>
                <input
                  data-testid={`gn-score-b-${court}`}
                  aria-label={`Court ${court} team B points`}
                  inputMode="numeric"
                  value={b}
                  onChange={(e) => setB(e.target.value.replace(/\D/g, ""))}
                  className="w-16 rounded-lg bg-white px-2 py-2 text-center text-lg font-black text-slate-950"
                />
                <button
                  type="submit"
                  data-testid={`gn-save-score-${court}`}
                  className="min-h-11 rounded-full bg-lime-300 px-4 font-bold text-slate-950"
                >
                  Save
                </button>
              </div>
              <button
                type="button"
                onClick={() => onFinish()}
                className="text-sm text-lime-300 underline"
              >
                Let the demo decide the score
              </button>
            </form>
          ) : (
            <button
              type="button"
              data-testid={`gn-finish-${court}`}
              onClick={onScore}
              className="mt-2 min-h-11 w-full rounded-full bg-white/10 px-4 font-bold ring-1 ring-white/15"
            >
              Finish · enter score
            </button>
          )}
        </>
      ) : (
        <p className="text-white/60">Waiting for four players.</p>
      )}
    </article>
  );
}

function PlayerRow({
  p,
  demo,
  position,
  wait,
  onRest,
}: {
  p: DemoPlayer;
  demo: Demo;
  position?: number;
  wait?: number;
  onRest: () => void;
}) {
  const court = demo.courts.find(
    (m) => m && [...m.teams[0], ...m.teams[1]].includes(p.id),
  );
  const last = p.lastMatch
    ? demo.results.find((r) => r.id === p.lastMatch)
    : undefined;
  const status =
    p.status === "playing"
      ? `Court ${court?.court}`
      : p.status === "waiting"
        ? `#${position} · ${minutes(wait ?? 0)}`
        : "Sitting out";
  return (
    <li
      data-testid="gn-player-row"
      data-player={p.name}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 rounded-xl bg-white/[0.05] px-3 py-2 ring-1 ring-white/10 md:grid-cols-[minmax(0,1.6fr)_3rem_5.5rem_3.5rem_4rem_4rem_4rem_6rem]"
    >
      <span className="min-w-0">
        <span className="block truncate font-bold">{p.name}</span>
        {last && (
          <span className="block truncate text-xs text-white/50">
            Last: {last.score!.join("–")} {wonBy(last, p.id) ? "win" : "loss"}{" "}
            on court {last.court}
          </span>
        )}
      </span>
      <span className="justify-self-end md:justify-self-start">
        <LevelChip level={p.level} />
      </span>
      <span
        className={cx(
          "col-span-2 text-sm md:col-span-1",
          p.status === "playing" ? "text-lime-300" : "text-white/70",
        )}
      >
        <span className="md:hidden">Status: </span>
        {status}
      </span>
      <span className="col-span-2 flex flex-wrap gap-x-3 text-sm text-white/80 tabular-nums md:contents">
        <span className="md:text-right">
          <span className="text-white/50 md:hidden">Games </span>
          <span data-testid="gn-games">{p.games}</span>
        </span>
        <span className="md:text-right">
          <span className="text-white/50 md:hidden">W–L </span>
          <span data-testid="gn-record">
            {p.wins}–{p.losses}
          </span>
        </span>
        <span className="md:text-right">
          <span className="text-white/50 md:hidden">Played </span>
          {p.minutesPlayed}m
        </span>
        <span className="md:text-right">
          <span className="text-white/50 md:hidden">Waited </span>
          {p.minutesWaiting}m
        </span>
      </span>
      <span className="col-span-2 md:col-span-1 md:justify-self-end">
        {p.status !== "playing" && (
          <button
            type="button"
            onClick={onRest}
            className="min-h-9 rounded-full bg-white/10 px-3 text-sm font-bold ring-1 ring-white/15"
          >
            {p.status === "resting" ? "Back in" : "Sit out"}
          </button>
        )}
      </span>
    </li>
  );
}

const wonBy = (r: Match, id: string) =>
  (r.teams[0].includes(id) ? 0 : 1) === (r.score![0] > r.score![1] ? 0 : 1);

function Result({ r, demo }: { r: Match; demo: Demo }) {
  const aWon = r.score![0] > r.score![1];
  const names = (t: Team) =>
    t.map((id) => playerById(demo, id).name.split(" ")[0]).join(" & ");
  return (
    <li
      data-testid="gn-result"
      className="flex flex-wrap items-center gap-x-2 rounded-xl bg-white/[0.05] px-3 py-2 text-sm ring-1 ring-white/10"
    >
      <span className="text-white/50">
        Court {r.court} · {clockLabel(r.endedAt ?? r.endsAt)}
      </span>
      <span className={cx(aWon ? "font-black text-lime-300" : "text-white/80")}>
        {names(r.teams[0])}
      </span>
      <span data-testid="gn-result-score" className="font-black tabular-nums">
        {r.score![0]}–{r.score![1]}
      </span>
      <span
        className={cx(!aWon ? "font-black text-lime-300" : "text-white/80")}
      >
        {names(r.teams[1])}
      </span>
    </li>
  );
}
