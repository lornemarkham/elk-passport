"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addPlayer,
  advance,
  assignFour,
  assignNext,
  finishGame,
  movePlayer,
  newGameNight,
  nextEvent,
  picture,
  playToEnd,
  removePlayer,
  rotate,
  sendBack,
  setCourtClosed,
  setPlayNext,
  setUnavailable,
  startGame,
  type CourtView,
  type GameNight as Night,
  type Picture,
  type PlayerRow,
  type Stage,
} from "@/lib/courtqueue/gamenight";
import { localClock } from "@/lib/courtqueue/clock";
import type { Court } from "@/lib/courtqueue/model";
import { longDate } from "@/lib/courtqueue/countdown";
import { Btn, Card, Sheet, cx } from "./bits";
import { RegistrationNote } from "./Countdown";

/**
 * **Test Game Night.** The organizer's rehearsal: a whole night with 25
 * fictional players, run by the real engine on a copy that exists only in
 * this browser tab (`gamenight.ts`). Nothing on this screen calls the
 * server — no attendance, notifications, Clubhouse posts or statistics can
 * change — and Exit throws the copy away.
 */

export const TEST_NIGHT_KEY = "cq_test_game_night";
const KEY = TEST_NIGHT_KEY;

/** The organizer's way in. */
export function TestNightLauncher({ onOpen }: { onOpen: () => void }) {
  return (
    <Card className="ring-1 ring-amber-300/40">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-black">Rehearse a night</p>
          <p className="text-sm text-white/60">
            25 fictional players on your courts. Nothing real changes.
          </p>
        </div>
        <Btn onClick={onOpen} className="shrink-0">
          🏸 Test Game Night
        </Btn>
      </div>
    </Card>
  );
}

type Outcome = { ok: true; value: Night } | { ok: false; error: string };

export function GameNight({
  courts,
  capacity,
  today,
  onExit,
}: {
  courts?: readonly Court[];
  capacity?: number;
  /** The club's clock now, to pick which night to rehearse. */
  today?: number;
  onExit: () => void;
}) {
  const [night, setNight] = useState<Night | null>(null);
  const [auto, setAuto] = useState(false);
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(
    null,
  );
  const [who, setWho] = useState<string | null>(null);
  const [picking, setPicking] = useState<number | null>(null);
  const [view, setView] = useState<"courts" | "line" | "players" | "summary">(
    "courts",
  );

  // The club's courts and the night are read once, when the rehearsal opens.
  const [setup] = useState(() => ({ courts, capacity, today }));
  const fresh = useCallback(
    (seed?: number) =>
      newGameNight({
        ...setup,
        seed: seed ?? Math.floor(Math.random() * 1e6),
      }),
    [setup],
  );

  // Kept in this tab only, so a reload carries on and closing the tab forgets it.
  useEffect(() => {
    let start: Night | null = null;
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) start = JSON.parse(raw) as Night;
    } catch {
      start = null;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restores this tab's rehearsal from sessionStorage
    setNight(start?.v === 1 ? start : fresh());
  }, [fresh]);
  useEffect(() => {
    if (night) sessionStorage.setItem(KEY, JSON.stringify(night));
  }, [night]);

  const say = useCallback((text: string, bad?: boolean) => {
    setToast({ text, bad });
    setTimeout(() => setToast(null), bad ? 3500 : 2000);
  }, []);
  const control = useCallback(
    (f: (n: Night) => Outcome, done?: string) => {
      if (!night) return false;
      const out = f(night);
      if (!out.ok) {
        say(out.error, true);
        return false;
      }
      setNight(out.value);
      if (done) say(done);
      return true;
    },
    [night, say],
  );

  const p = useMemo(() => (night ? picture(night) : null), [night]);
  const ended = p?.moment.stage === "after";

  useEffect(() => {
    if (!auto || ended) return;
    const t = setInterval(() => setNight((n) => (n ? nextEvent(n) : n)), 1100);
    return () => clearInterval(t);
  }, [auto, ended]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- auto-play stops by itself at the end of the night
    if (ended) setAuto(false);
  }, [ended]);

  const exit = () => {
    sessionStorage.removeItem(KEY);
    onExit();
  };

  if (!night || !p)
    return (
      <p className="mt-24 text-center text-white/60">Setting up the gym…</p>
    );
  const row = who ? p.players.find((r) => r.id === who) : null;

  return (
    <div className="mx-auto min-h-dvh max-w-5xl px-4 pb-44">
      <div
        role="status"
        data-testid="demo-banner"
        className="sticky top-0 z-40 -mx-4 flex items-center justify-between gap-3 bg-amber-400 px-4 py-2 text-slate-950 shadow-lg"
      >
        <p className="text-sm leading-tight font-black tracking-wide sm:text-base">
          DEMO — 25 FICTIONAL PLAYERS
          <span className="block text-xs font-semibold tracking-normal">
            Nothing here is saved, sent or real.
          </span>
        </p>
        <button
          onClick={exit}
          className="shrink-0 rounded-lg bg-slate-950 px-3 py-2 text-sm font-black text-amber-300"
        >
          Exit demo
        </button>
      </div>

      <header className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-widest text-lime-300/80 uppercase">
            🏸 Test Game Night
          </p>
          <h1 className="text-2xl font-black">{longDate(p.date)}</h1>
          <p className="text-sm text-white/60">
            {p.confirmed}/{p.capacity} registered
            {p.waitlisted ? ` · ${p.waitlisted} waitlist` : ""} ·{" "}
            {p.gamesPlayed} games played
          </p>
        </div>
        <div className="text-right">
          <p
            data-testid="demo-clock"
            className="text-3xl font-black text-lime-300 tabular-nums"
          >
            {p.now}
          </p>
          <p className="text-xs text-white/50">simulated time</p>
        </div>
      </header>

      <Stages stage={p.moment.stage} />
      <Card className="mt-3">
        <p data-testid="demo-moment" className="text-xl font-black">
          {p.moment.title}
        </p>
        <p className="text-sm text-white/70">{p.moment.detail}</p>
        {p.moment.stage === "before" && night.session.status !== "live" && (
          <div className="mt-3 rounded-xl bg-slate-950/60 p-3">
            <RegistrationNote
              date={p.date}
              now={night.now}
              confirmed={p.confirmed}
              capacity={p.capacity}
            />
          </div>
        )}
        {p.log[0] && (
          <p
            data-testid="demo-last"
            className="mt-2 border-t border-white/10 pt-2 text-sm text-lime-100"
          >
            {p.log[0].text}
          </p>
        )}
      </Card>

      {p.broken && (
        <Card tone="warn" className="mt-3">
          The engine found a problem: {p.broken}
        </Card>
      )}

      <nav className="mt-4 flex gap-1 rounded-xl bg-white/10 p-1 text-sm font-bold">
        {(
          [
            ["courts", "Courts"],
            ["line", `Line (${p.line.length})`],
            ["players", `Players (${p.players.length})`],
            ["summary", ended ? "Summary" : "So far"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setView(id)}
            aria-pressed={view === id}
            className={cx(
              "flex-1 rounded-lg py-2",
              view === id ? "bg-lime-400 text-slate-950" : "text-white/70",
            )}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="mt-4">
        {view === "courts" && (
          <div className="grid gap-4 md:grid-cols-3">
            {p.courts.map((c) => (
              <CourtCard
                key={c.id}
                c={c}
                ended={!!ended}
                waiting={p.line.length}
                onPlayer={setWho}
                onStart={(id) => control((n) => startGame(n, id))}
                onFinish={(id) => control((n) => finishGame(n, id))}
                onSendBack={(id) => control((n) => sendBack(n, id))}
                onNext={() => control((n) => assignNext(n, c.id))}
                onPick={() => setPicking(c.id)}
                onClosed={(closed) =>
                  control((n) => setCourtClosed(n, c.id, closed))
                }
              />
            ))}
          </div>
        )}
        {(view === "courts" || view === "line") && (
          <LineCard p={p} onPlayer={setWho} full={view === "line"} />
        )}
        {view === "players" && <Players p={p} onPlayer={setWho} />}
        {view === "summary" && <Summary p={p} ended={!!ended} />}
      </div>

      <Card className="mt-4">
        <h2 className="mb-2 font-bold">What happened</h2>
        <ol
          data-testid="demo-log"
          className="max-h-64 space-y-1 overflow-y-auto text-sm"
        >
          {p.log.map((l, i) => (
            <li key={i} className="flex gap-2">
              <span className="w-16 shrink-0 text-white/40 tabular-nums">
                {clockOf(l.at)}
              </span>
              <span className="text-white/80">{l.text}</span>
            </li>
          ))}
        </ol>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto max-w-5xl space-y-2 px-4 py-3">
          <div className="flex gap-2">
            <Btn
              className="flex-1 text-lg"
              disabled={!!ended}
              onClick={() => setNight(nextEvent(night))}
            >
              Next event ▶
              {p.next && (
                <span className="block text-xs font-semibold">at {p.next}</span>
              )}
            </Btn>
            <Btn
              kind="ghost"
              disabled={!!ended}
              onClick={() => setNight(advance(night, 5))}
              aria-label="Five minutes later"
            >
              +5 min
            </Btn>
            <Btn
              kind="ghost"
              disabled={!!ended}
              onClick={() => setAuto((a) => !a)}
              aria-label={auto ? "Pause" : "Auto play"}
            >
              {auto ? "❚❚" : "Auto"}
            </Btn>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <button
              className="rounded-lg bg-white/10 px-3 py-2 font-semibold disabled:opacity-40"
              disabled={!!ended}
              onClick={() => control(rotate, "Courts rotated.")}
            >
              Rotate all courts
            </button>
            <button
              className="rounded-lg bg-white/10 px-3 py-2 font-semibold disabled:opacity-40"
              disabled={!!ended}
              onClick={() => control(addPlayer)}
            >
              + Add a player
            </button>
            <button
              className="rounded-lg bg-white/10 px-3 py-2 font-semibold disabled:opacity-40"
              disabled={!!ended}
              onClick={() => setNight(playToEnd(night))}
            >
              Skip to the end
            </button>
            <button
              className="rounded-lg bg-white/10 px-3 py-2 font-semibold"
              onClick={() => {
                setAuto(false);
                setNight(fresh());
                say("A fresh night.");
              }}
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {row && (
        <PlayerSheet
          r={row}
          p={p}
          onClose={() => setWho(null)}
          control={control}
        />
      )}
      {picking !== null && (
        <PickFour
          court={picking}
          p={p}
          onClose={() => setPicking(null)}
          onPick={(four) =>
            control((n) => assignFour(n, picking, four)) && setPicking(null)
          }
        />
      )}
      {toast && (
        <div
          role="alert"
          className={cx(
            "fixed inset-x-4 bottom-36 z-50 mx-auto max-w-md rounded-xl px-4 py-3 text-center font-semibold shadow-xl",
            toast.bad ? "bg-rose-500 text-white" : "bg-lime-400 text-slate-950",
          )}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

const clockOf = localClock;

function Stages({ stage }: { stage: Stage }) {
  const all: [Stage, string][] = [
    ["before", "Before badminton"],
    ["during", "During"],
    ["after", "After"],
  ];
  return (
    <ol className="mt-3 flex gap-1 text-center text-xs font-bold">
      {all.map(([id, label]) => (
        <li
          key={id}
          aria-current={id === stage ? "step" : undefined}
          className={cx(
            "flex-1 rounded-full px-2 py-1.5",
            id === stage
              ? "bg-lime-400 text-slate-950"
              : "bg-white/10 text-white/50",
          )}
        >
          {label}
        </li>
      ))}
    </ol>
  );
}

const firstName = (name: string) => name.split(" ")[0];

/**
 * A court as it looks from the seats: green floor, white lines, the net
 * across the middle, two players each side.
 */
function CourtCard({
  c,
  ended,
  waiting,
  onPlayer,
  onStart,
  onFinish,
  onSendBack,
  onNext,
  onPick,
  onClosed,
}: {
  c: CourtView;
  ended: boolean;
  waiting: number;
  onPlayer: (id: string) => void;
  onStart: (id: string) => void;
  onFinish: (id: string) => void;
  onSendBack: (id: string) => void;
  onNext: () => void;
  onPick: () => void;
  onClosed: (closed: boolean) => void;
}) {
  const g = c.game;
  const status = c.closed
    ? "Closed"
    : !g
      ? "Open"
      : g.status === "called"
        ? `Called · ${g.minutes} min ago`
        : `Playing · ${g.minutes} min`;
  return (
    <section
      data-testid={`demo-court-${c.id}`}
      data-status={c.closed ? "closed" : (g?.status ?? "open")}
      className="rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10"
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-xl font-black">Court {c.id}</h2>
        <span
          className={cx(
            "rounded-full px-2 py-0.5 text-xs font-black uppercase",
            c.closed
              ? "bg-white/10 text-white/50"
              : !g
                ? "bg-lime-400 text-slate-950"
                : g.status === "called"
                  ? "bg-amber-300 text-slate-950"
                  : "bg-emerald-300 text-slate-950",
          )}
        >
          {status}
        </span>
      </div>
      <p className="mb-2 text-xs text-white/50">{c.where}</p>
      <div
        className={cx(
          "relative aspect-[13.4/6.1] w-full overflow-hidden rounded-md border-2 border-white/90",
          c.closed ? "bg-slate-700/60" : "bg-emerald-700",
          g?.status === "called" && "ring-4 ring-amber-300/70",
        )}
      >
        {/* Singles sidelines, back doubles service lines, short service lines, centre lines. */}
        <div className="absolute inset-x-0 top-[7.5%] border-t border-white/70" />
        <div className="absolute inset-x-0 bottom-[7.5%] border-t border-white/70" />
        <div className="absolute inset-y-0 left-[5.7%] border-l border-white/70" />
        <div className="absolute inset-y-0 right-[5.7%] border-l border-white/70" />
        <div className="absolute inset-y-0 left-[35.2%] border-l border-white/70" />
        <div className="absolute inset-y-0 right-[35.2%] border-l border-white/70" />
        <div className="absolute top-1/2 left-0 w-[35.2%] border-t border-white/70" />
        <div className="absolute top-1/2 right-0 w-[35.2%] border-t border-white/70" />
        {/* The net. */}
        <div className="absolute inset-y-[-4%] left-1/2 w-1 -translate-x-1/2 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.95)_0_3px,rgba(15,23,42,0.6)_3px_6px)]" />
        {g && (
          <div className="absolute inset-0 grid grid-cols-2">
            {g.teams.map((team, t) => (
              <div
                key={t}
                className="flex flex-col items-center justify-around px-1 py-2"
              >
                {team.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onPlayer(s.id)}
                    className="max-w-full truncate rounded-full bg-slate-950/80 px-2 py-1 text-xs font-bold text-white shadow sm:text-sm"
                  >
                    {firstName(s.name)}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
        {!g && !c.closed && (
          <p className="absolute inset-0 flex items-center justify-center text-sm font-black text-lime-200">
            {waiting >= 4 || ended ? "" : "Waiting for four"}
          </p>
        )}
      </div>
      {g && (
        <div className="mt-2 space-y-1 text-sm">
          <p className="font-bold">
            {g.teams[0].map((s) => firstName(s.name)).join(" & ")}
            <span className="mx-1 text-white/40">vs</span>
            {g.teams[1].map((s) => firstName(s.name)).join(" & ")}
          </p>
          <p className="text-white/60">
            <span className="font-semibold text-white/80">Why: </span>
            {g.why.join(" · ")}
          </p>
        </div>
      )}
      {c.next && (
        <p className="mt-2 rounded-lg bg-slate-950/50 p-2 text-xs text-white/70">
          <span className="font-black text-lime-300">Next here: </span>
          {c.next.players.map((s) => firstName(s.name)).join(", ")}
          <span className="block text-white/50">{c.next.why.join(" · ")}</span>
        </p>
      )}
      {!ended && (
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          {g?.status === "called" && (
            <>
              <SmallBtn hot onClick={() => onStart(g.id)}>
                Start game
              </SmallBtn>
              <SmallBtn onClick={() => onSendBack(g.id)}>Send back</SmallBtn>
            </>
          )}
          {g?.status === "playing" && (
            <>
              <SmallBtn hot onClick={() => onFinish(g.id)}>
                Finish game
              </SmallBtn>
              <SmallBtn onClick={onNext}>Next group on</SmallBtn>
            </>
          )}
          {!g && !c.closed && <SmallBtn onClick={onPick}>Pick four</SmallBtn>}
          {!g && (
            <SmallBtn onClick={() => onClosed(!c.closed)}>
              {c.closed ? "Open court" : "Close court"}
            </SmallBtn>
          )}
        </div>
      )}
    </section>
  );
}

function SmallBtn({
  children,
  onClick,
  hot,
}: {
  children: React.ReactNode;
  onClick: () => void;
  hot?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "rounded-lg px-3 py-1.5 font-bold",
        hot ? "bg-lime-400 text-slate-950" : "bg-white/10 text-white",
      )}
    >
      {children}
    </button>
  );
}

function LineCard({
  p,
  onPlayer,
  full,
}: {
  p: Picture;
  onPlayer: (id: string) => void;
  full: boolean;
}) {
  const shown = full ? p.line : p.line.slice(0, 8);
  return (
    <Card className="mt-4">
      <h2 className="font-bold">Waiting ({p.line.length})</h2>
      <p className="mb-2 text-xs text-white/50">
        Fewest games tonight goes first; then fewest minutes on court; then
        whoever has waited longest.
      </p>
      {shown.length ? (
        <ol data-testid="demo-line" className="space-y-1">
          {shown.map((r, i) => (
            <li key={r.id}>
              <button
                onClick={() => onPlayer(r.id)}
                className="flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left hover:bg-white/5"
              >
                <span className="w-6 text-right text-white/50 tabular-nums">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {r.name}
                </span>
                {i < 4 && (
                  <span className="shrink-0 rounded bg-lime-400/20 px-1.5 text-xs font-bold text-lime-300">
                    next
                  </span>
                )}
                {r.playNext && (
                  <span className="shrink-0 text-xs text-amber-300">
                    play next
                  </span>
                )}
                <span className="text-xs text-white/60 tabular-nums">
                  {r.games} {r.games === 1 ? "game" : "games"} · waiting{" "}
                  <span data-testid="wait">{r.waitingNow ?? 0}</span> min
                </span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-white/60">Nobody is waiting.</p>
      )}
      {!full && p.line.length > shown.length && (
        <p className="mt-1 text-xs text-white/50">
          + {p.line.length - shown.length} more — see Line
        </p>
      )}
    </Card>
  );
}

const STATE_TONE: Partial<Record<PlayerRow["state"], string>> = {
  playing: "text-emerald-300",
  called: "text-amber-300",
  "in line": "text-white",
  unavailable: "text-rose-300",
  "on a break": "text-sky-300",
  waitlist: "text-amber-300",
  "no-show": "text-white/40",
  removed: "text-white/40",
};

function Players({
  p,
  onPlayer,
}: {
  p: Picture;
  onPlayer: (id: string) => void;
}) {
  return (
    <Card>
      <h2 className="font-bold">Everyone ({p.players.length})</h2>
      <p className="mb-2 text-xs text-white/50">
        Made-up people. Their experience is a private guide each one chose for
        themselves — shown here only so the demo can tell its story. In the club
        app nobody sees anyone else&apos;s.
      </p>
      <ul data-testid="demo-players" className="divide-y divide-white/10">
        {p.players.map((r) => (
          <li key={r.id}>
            <button
              onClick={() => onPlayer(r.id)}
              className="flex w-full items-center gap-3 py-2 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{r.name}</span>
                <span className="block truncate text-xs text-white/50">
                  {r.nights === 0
                    ? "First night at the club"
                    : `${r.nights} night${r.nights === 1 ? "" : "s"} this season`}
                  {r.level ? ` · ${r.level}` : ""}
                  {r.mood ? ` · ${r.mood}` : ""}
                </span>
              </span>
              <span className="text-right text-xs tabular-nums">
                <span
                  className={cx(
                    "block font-bold",
                    STATE_TONE[r.state] ?? "text-white/70",
                  )}
                >
                  {r.state}
                  {r.court ? ` · court ${r.court}` : ""}
                </span>
                <span className="text-white/50">
                  {r.games}g · {r.minutes}m on court · {r.waited}m waited
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Summary({ p, ended }: { p: Picture; ended: boolean }) {
  const came = p.players.filter(
    (r) => r.games > 0 || ["done", "headed home"].includes(r.state),
  );
  const waits = came.map((r) => r.waited / Math.max(1, r.games));
  const avg = waits.length
    ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length)
    : 0;
  return (
    <div className="space-y-4" data-testid="demo-summary">
      <Card>
        <h2 className="text-xl font-black">
          {ended ? "Session complete" : "Participation so far"}
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Stat label="Games played" value={p.gamesPlayed} />
          <Stat label="Players who played" value={came.length} />
          <Stat
            label="Games each"
            value={p.spread ? `${p.spread.fewest}–${p.spread.most}` : "—"}
          />
          <Stat label="Average wait per game" value={`${avg} min`} />
        </dl>
        <p className="mt-3 text-xs text-white/50">
          Nobody is ranked. Everyone&apos;s own night, in alphabetical order.
        </p>
      </Card>
      <div className="grid gap-2 sm:grid-cols-2">
        {[...came]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((r) => (
            <Card key={r.id}>
              <p className="font-bold">{r.name}</p>
              <p className="text-sm text-white/70">
                {r.games} {r.games === 1 ? "game" : "games"} · {r.minutes} min
                on court · played with {r.met}{" "}
                {r.met === 1 ? "person" : "people"}
              </p>
              <p className="mt-1 text-sm text-lime-200">{progress(r)}</p>
            </Card>
          ))}
      </div>
    </div>
  );
}

function progress(r: PlayerRow) {
  if (r.nights === 0) return "First night at the club — welcome! 🎉";
  if (r.partners >= 3) return `${r.partners} different partners tonight.`;
  return `Night ${r.nights + 1} of the season.`;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-slate-950/50 p-3">
      <dt className="text-xs text-white/60">{label}</dt>
      <dd className="text-2xl font-black tabular-nums">{value}</dd>
    </div>
  );
}

function PlayerSheet({
  r,
  p,
  onClose,
  control,
}: {
  r: PlayerRow;
  p: Picture;
  onClose: () => void;
  control: (f: (n: Night) => Outcome, done?: string) => boolean;
}) {
  const others = p.courts
    .filter((c) => c.game && c.id !== r.court)
    .flatMap((c) =>
      [...c.game!.teams[0], ...c.game!.teams[1]].map((s) => ({
        ...s,
        court: c.id,
      })),
    );
  const ended = p.moment.stage === "after";
  const unavailable = r.state === "unavailable";
  const act = (f: (n: Night) => Outcome, done: string) => {
    if (control(f, done)) onClose();
  };
  return (
    <Sheet open onClose={onClose} title={r.name}>
      <p className="text-white/80">
        <b>{r.state}</b>
        {r.court ? ` on court ${r.court}` : ""}
        {r.linePosition ? ` · #${r.linePosition} in line` : ""}
      </p>
      <p className="mt-1 text-sm text-white/60">
        {r.games} games · {r.minutes} min on court · waited {r.waited} min
        tonight
        {r.waitingNow !== null ? ` (${r.waitingNow} min now)` : ""}
      </p>
      {!ended && (
        <div className="mt-4 space-y-2">
          {!["removed", "no-show", "headed home", "not signed up"].includes(
            r.state,
          ) && (
            <Btn
              kind="ghost"
              className="w-full"
              onClick={() =>
                act(
                  (n) => setUnavailable(n, r.id, !unavailable),
                  unavailable ? "Available again." : "Marked unavailable.",
                )
              }
            >
              {unavailable ? "Available again" : "Mark unavailable"}
            </Btn>
          )}
          {r.state === "in line" && (
            <Btn
              kind="ghost"
              className="w-full"
              onClick={() =>
                act(
                  (n) => setPlayNext(n, r.id, !r.playNext),
                  r.playNext ? "Back in turn." : "They'll play next.",
                )
              }
            >
              {r.playNext ? "Back in turn" : "Play next"}
            </Btn>
          )}
          {r.court && others.length > 0 && (
            <label className="block">
              <span className="text-sm text-white/70">
                Move to another court — swap with
              </span>
              <select
                defaultValue=""
                onChange={(e) =>
                  e.target.value &&
                  act((n) => movePlayer(n, r.id, e.target.value), "Moved.")
                }
                className="mt-1 w-full rounded-xl bg-white/10 p-3"
              >
                <option value="">Choose…</option>
                {others.map((o) => (
                  <option key={o.id} value={o.id}>
                    Court {o.court}: {o.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!["removed", "not signed up"].includes(r.state) && (
            <Btn
              kind="danger"
              className="w-full"
              onClick={() =>
                act((n) => removePlayer(n, r.id), `${r.name} removed.`)
              }
            >
              Remove from tonight
            </Btn>
          )}
        </div>
      )}
    </Sheet>
  );
}

function PickFour({
  court,
  p,
  onClose,
  onPick,
}: {
  court: number;
  p: Picture;
  onClose: () => void;
  onPick: (four: [string, string, string, string]) => void;
}) {
  const pool = p.players.filter((r) =>
    ["in line", "catching breath", "on a break"].includes(r.state),
  );
  const [four, setFour] = useState<string[]>(
    p.line.slice(0, 4).map((r) => r.id),
  );
  const set = (i: number, id: string) =>
    setFour((f) => f.map((x, k) => (k === i ? id : x)));
  return (
    <Sheet open onClose={onClose} title={`Pick four for court ${court}`}>
      <p className="mb-3 text-sm text-white/60">
        Filled in with the next four in line. Change anyone you like.
      </p>
      {[0, 1, 2, 3].map((i) => (
        <label key={i} className="mb-2 block">
          <span className="text-sm text-white/70">
            {i < 2 ? "Team one" : "Team two"}
          </span>
          <select
            value={four[i] ?? ""}
            onChange={(e) => set(i, e.target.value)}
            className="mt-1 w-full rounded-xl bg-white/10 p-3"
          >
            <option value="">Choose…</option>
            {pool.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} — {r.games} games
              </option>
            ))}
          </select>
        </label>
      ))}
      <Btn
        className="mt-2 w-full"
        disabled={
          four.length !== 4 || new Set(four).size !== 4 || four.some((x) => !x)
        }
        onClick={() => onPick(four as [string, string, string, string])}
      >
        Call them to court {court}
      </Btn>
    </Sheet>
  );
}
