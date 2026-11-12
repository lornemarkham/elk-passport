"use client";

import { useState } from "react";
import { MOODS, type Mood } from "@/lib/courtqueue/model";
import type {
  GameView,
  LiveView,
  NightView,
  Phase,
} from "@/lib/courtqueue/view";
import { Btn, Card, Elapsed, Person, Sheet, clock, cx, plural } from "./bits";
import { NextSession, RegistrationNote, useNow } from "./Countdown";
import { NotificationsCard } from "./Me";
import type { Alerts } from "./notify";

export type Act = (cmd: object, sessionId?: string) => Promise<boolean>;

/**
 * **Home.** One glance from a phone lying on a bench: where am I in my
 * night (one word, big), the one thing to do next (one big button), and the
 * three courts. Everything else is below the fold.
 */
export function Tonight({
  view,
  act,
  offset,
  onFinish,
  onRequest,
  onCourts,
  alerts,
}: {
  view: LiveView;
  act: Act;
  offset: number;
  onFinish: () => void;
  onRequest: () => void;
  onCourts?: () => void;
  alerts?: Alerts;
}) {
  const night = view.night;
  const meId = view.me!.id;
  const nudge =
    alerts &&
    (alerts.state === "off" || alerts.state === "needs-home-screen") ? (
      <NotificationsCard alerts={alerts} />
    ) : null;
  if (!night)
    return (
      <>
        <NoNightToday view={view} offset={offset} onCourts={onCourts} />
        <div className="mt-4">{nudge}</div>
      </>
    );
  const me = night.me!;
  const checkedIn = ["ready", "waiting", "up", "playing", "finished"].includes(
    me.phase,
  );
  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs font-bold tracking-widest text-lime-300/80 uppercase">
          {view.season.club}
        </p>
        <div className="flex items-baseline justify-between gap-2">
          <h1 className="text-2xl font-black">{night.label}</h1>
          <span className="text-sm text-white/60 tabular-nums">
            {night.confirmed}/{night.capacity} in
            {night.waitlisted ? ` · ${night.waitlisted} waitlist` : ""}
          </span>
        </div>
        <p className="text-sm text-white/60">
          {night.hours} · {view.season.venue}
        </p>
      </header>
      {night.status === "upcoming" && !night.cancelled && (
        <TodaySignUp night={night} offset={offset} />
      )}
      <StatusCard
        night={night}
        meId={meId}
        act={act}
        offset={offset}
        onFinish={onFinish}
      />
      {["registered", "ready", "waiting", "finished"].includes(me.phase) &&
        night.status !== "ended" && <MoodPicker mood={me.mood} act={act} />}
      {nudge}
      <Invites night={night} meId={meId} act={act} />
      <MyResults night={night} meId={meId} act={act} />
      <CourtMap night={night} meId={meId} offset={offset} onCourts={onCourts} />
      <Line night={night} meId={meId} />
      <HereTonight night={night} meId={meId} />
      {checkedIn && night.status === "live" && (
        <div className="flex flex-wrap justify-between gap-3 px-1 text-sm">
          <button className="text-lime-300 underline" onClick={onRequest}>
            Request a game with friends
          </button>
          {me.phase !== "playing" && me.phase !== "up" && (
            <button
              className="text-white/60 underline"
              onClick={() => act({ type: "leave" })}
            >
              I&apos;m heading home
            </button>
          )}
        </div>
      )}
      <NextSession
        view={view}
        offset={offset}
        skip={night.date}
        title="Next session after tonight"
      />
    </div>
  );
}

const PHASE: Record<Phase, { word: string; tone: string }> = {
  "not-registered": { word: "NOT SIGNED UP", tone: "bg-white/15 text-white" },
  waitlist: { word: "WAITLIST", tone: "bg-amber-400 text-slate-950" },
  registered: { word: "REGISTERED", tone: "bg-sky-400 text-slate-950" },
  ready: { word: "READY TO PLAY", tone: "bg-lime-400 text-slate-950" },
  waiting: { word: "WAITING", tone: "bg-white text-slate-950" },
  up: { word: "YOU'RE UP", tone: "bg-lime-400 text-slate-950" },
  playing: { word: "PLAYING", tone: "bg-lime-400 text-slate-950" },
  finished: { word: "FINISHED", tone: "bg-violet-300 text-slate-950" },
  left: { word: "HEADED HOME", tone: "bg-white/15 text-white" },
  ended: { word: "THAT'S A WRAP", tone: "bg-white/15 text-white" },
};

export function PhaseBadge({ phase }: { phase: Phase }) {
  const p = PHASE[phase];
  return (
    <span
      data-testid="phase"
      className={cx(
        "inline-block rounded-full px-3 py-1 text-sm font-black tracking-wider",
        p.tone,
      )}
    >
      {p.word}
    </span>
  );
}

function StatusCard({
  night,
  meId,
  act,
  offset,
  onFinish,
}: {
  night: NightView;
  meId: string;
  act: Act;
  offset: number;
  onFinish: () => void;
}) {
  const me = night.me!;
  const [declining, setDeclining] = useState(false);
  const tally = (
    <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
      {[
        [me.games, me.games === 1 ? "game" : "games"],
        [me.minutes, "min played"],
        [me.waited, "min waited"],
      ].map(([n, label]) => (
        <div key={String(label)} className="rounded-xl bg-black/15 py-2">
          <dt className="sr-only">{label}</dt>
          <dd className="text-2xl font-black tabular-nums">{n}</dd>
          <dd className="text-[11px] opacity-70">{label}</dd>
        </div>
      ))}
    </dl>
  );
  const hot = me.phase === "up" || me.phase === "playing";
  const frame = (body: React.ReactNode) => (
    <Card tone={hot ? "hot" : undefined}>
      <PhaseBadge phase={me.phase} />
      <div className="mt-3">{body}</div>
    </Card>
  );
  if (night.cancelled)
    return frame(
      <p className="text-lg font-bold">
        Tonight is cancelled — {night.cancelled}.
      </p>,
    );
  switch (me.phase) {
    case "ended":
      return frame(
        <>
          <p className="text-lg font-bold">Thanks for playing tonight.</p>
          {tally}
        </>,
      );
    case "not-registered": {
      const full = night.confirmed >= night.capacity;
      return frame(
        <>
          <p className="mb-1 font-semibold text-lime-300">
            Everyone is welcome. Come play, meet people, and have fun!
          </p>
          <p className="mb-3 text-white/80">
            {night.registration === "open"
              ? full
                ? `All ${night.capacity} spots are taken. Join the waitlist — you move up by yourself if someone cancels.`
                : `${night.capacity - night.confirmed} of ${night.capacity} spots left. First come, first served.`
              : night.registrationNote}
          </p>
          <Btn
            big
            disabled={night.registration !== "open"}
            onClick={() => act({ type: "register" })}
          >
            {full ? "JOIN THE WAITLIST" : "SIGN ME UP"}
          </Btn>
        </>,
      );
    }
    case "waitlist":
      return frame(
        <>
          <p className="text-4xl font-black">#{me.waitlistPosition}</p>
          <p className="text-white/80">
            on the waitlist. You move up by yourself when someone cancels —
            we&apos;ll tell you.
          </p>
          <button
            className="mt-3 text-sm text-white/60 underline"
            onClick={() => act({ type: "cancel" })}
          >
            Take me off the waitlist
          </button>
        </>,
      );
    case "registered":
      return frame(
        <>
          <p className="mb-3 text-white/80">
            You have a spot tonight. At the gym? Check in.
          </p>
          <Btn big onClick={() => act({ type: "check-in" })}>
            I&apos;M HERE
          </Btn>
          <button
            className="mt-3 text-sm text-white/60 underline"
            onClick={() => act({ type: "cancel" })}
          >
            Can&apos;t make it — give my spot away
          </button>
        </>,
      );
    case "left":
      return frame(
        <>
          <p className="mb-3">You&apos;ve headed home. Changed your mind?</p>
          <Btn onClick={() => act({ type: "check-in" })}>I&apos;m back</Btn>
          {tally}
        </>,
      );
    case "ready":
      return frame(
        <>
          <p className="mb-3 text-white/80">
            You&apos;re checked in. Join the queue and put your phone down —
            we&apos;ll call you to a court.
          </p>
          <Btn big onClick={() => act({ type: "play" })}>
            JOIN THE QUEUE
          </Btn>
          {tally}
        </>,
      );
    case "finished": {
      const last = me.played[0];
      return frame(
        <>
          {last && (
            <p className="text-white/80">
              Court {last.court} · {last.minutes} min — thanks for playing!
            </p>
          )}
          {last && <ResultLine g={last} meId={meId} act={act} />}
          <p className="mt-1 mb-3 text-sm text-white/60">
            Grab some water. When you&apos;re ready for another game, tap below
            — nobody puts you back in line but you.
          </p>
          <Btn big onClick={() => act({ type: "play" })}>
            BACK IN THE QUEUE
          </Btn>
          {tally}
        </>,
      );
    }
    case "waiting": {
      if (me.state === "challenge")
        return frame(
          <>
            <p className="text-lg font-bold">Your requested game is on</p>
            <p className="text-white/70">
              It gets a court once all four are free and nobody who has played
              fewer games is waiting.
            </p>
            {tally}
          </>,
        );
      return frame(
        <>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs tracking-wider text-white/60 uppercase">
                Place in line
              </p>
              <p className="text-6xl leading-none font-black tabular-nums">
                #{me.queuePosition}
              </p>
            </div>
            <p className="text-right text-lg">
              {me.estimateMin === 0 ? "Next court" : `~${me.estimateMin} min`}
              {me.queuedSince ? (
                <span className="block text-sm text-white/60">
                  waiting <Elapsed from={me.queuedSince} offset={offset} />
                </span>
              ) : null}
            </p>
          </div>
          {me.next && (
            <div className="mt-3 rounded-xl bg-lime-400/15 p-3 ring-1 ring-lime-300/50">
              <p className="font-black text-lime-300">
                ON DECK · Court {me.next.court} is next for you
              </p>
              <p className="text-sm text-white/80">
                With{" "}
                {me.next.slots
                  .filter((p) => p && p.id !== meId)
                  .map((p) => p!.name)
                  .join(", ")}
              </p>
            </div>
          )}
          {me.lineRule && (
            <p className="mt-2 text-sm text-white/60">{me.lineRule}</p>
          )}
          <p className="mt-1 text-sm text-white/60">
            Put your phone down — it will call you.
          </p>
          {tally}
          <Btn
            kind="ghost"
            className="mt-3 w-full"
            onClick={() => act({ type: "pause" })}
          >
            Take a break (leave the line)
          </Btn>
        </>,
      );
    }
    case "up":
    case "playing": {
      const g = me.game!;
      const court = night.courts.find((c) => c.id === g.court)!;
      const full = g.slots.every(Boolean);
      return frame(
        <>
          <p className="text-5xl font-black">Court {g.court}</p>
          <p className="font-semibold">
            {court.name} · {court.where}
          </p>
          {g.status === "playing" && (
            <p className="mt-1 text-lg font-bold tabular-nums">
              Playing <Elapsed from={g.startedAt!} offset={offset} />
            </p>
          )}
          <Teams g={g} meId={meId} dark />
          {g.status === "called" && (
            <ul className="mt-2 list-disc pl-5 text-sm">
              {g.why.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          <div className="mt-4 space-y-2">
            {g.status === "called" ? (
              <>
                <Btn
                  big
                  kind="dark"
                  disabled={!full}
                  onClick={() => act({ type: "start", gameId: g.id })}
                >
                  START GAME
                </Btn>
                {!full && (
                  <p className="text-center text-sm font-semibold">
                    Finding a fourth player…
                  </p>
                )}
                <div className="flex gap-2">
                  {!g.accepted.includes(meId) && (
                    <Btn
                      kind="dark"
                      className="flex-1"
                      onClick={() => act({ type: "accept", gameId: g.id })}
                    >
                      On my way
                    </Btn>
                  )}
                  <Btn
                    kind="ghost"
                    className="flex-1 !bg-slate-950/20 !text-slate-950"
                    onClick={() => setDeclining(true)}
                  >
                    Not this one
                  </Btn>
                </div>
                {full && (
                  <button
                    className="w-full text-center text-sm underline"
                    onClick={onFinish}
                  >
                    Already played? Forgot to tap start
                  </button>
                )}
              </>
            ) : (
              <Btn big kind="dark" onClick={onFinish}>
                FINISH GAME
              </Btn>
            )}
          </div>
          <DeclineSheet
            open={declining}
            onClose={() => setDeclining(false)}
            g={g}
            act={act}
          />
          {tally}
        </>,
      );
    }
  }
}

export function DeclineSheet({
  open,
  onClose,
  g,
  act,
}: {
  open: boolean;
  onClose: () => void;
  g: GameView;
  act: Act;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Skip this game?">
      <p className="mb-4 text-white/70">
        No penalty. The next person in line takes your spot.
      </p>
      <div className="space-y-2">
        <Btn
          className="w-full"
          onClick={() =>
            act({ type: "decline", gameId: g.id }).then(() => onClose())
          }
        >
          Keep my place in line
        </Btn>
        <Btn
          kind="ghost"
          className="w-full"
          onClick={() =>
            act({ type: "decline", gameId: g.id, pause: true }).then(() =>
              onClose(),
            )
          }
        >
          I&apos;m taking a break
        </Btn>
      </div>
    </Sheet>
  );
}

/** "COURT 2 — YOU'RE UP!", over everything, until they start or skip. */
export function UpTakeover({
  night,
  meId,
  act,
  onFinish,
  onHide,
}: {
  night: NightView;
  meId: string;
  act: Act;
  onFinish: () => void;
  onHide: () => void;
}) {
  const g = night.me?.game;
  const [declining, setDeclining] = useState(false);
  if (!g || g.status !== "called") return null;
  const court = night.courts.find((c) => c.id === g.court);
  const full = g.slots.every(Boolean);
  return (
    <div
      role="alertdialog"
      aria-label={`Court ${g.court} — you're up`}
      className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-lime-400 px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-slate-950"
    >
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
        <p className="text-center text-6xl font-black tracking-tight">
          COURT {g.court}
        </p>
        <p className="text-center text-4xl font-black">YOU&apos;RE UP!</p>
        <p className="mt-1 text-center font-semibold">
          {court?.name} · {court?.where}
        </p>
        <Teams g={g} meId={meId} dark />
        <ul className="mt-3 space-y-1 text-center text-sm font-semibold">
          {g.why.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
        <div className="mt-auto space-y-3 pt-6">
          <Btn
            big
            kind="dark"
            disabled={!full}
            onClick={() => act({ type: "start", gameId: g.id })}
          >
            {full ? "START GAME" : "Finding a fourth…"}
          </Btn>
          <div className="flex gap-2">
            <Btn
              kind="ghost"
              className="flex-1 !bg-slate-950/15 !text-slate-950"
              onClick={() => setDeclining(true)}
            >
              Not this one
            </Btn>
            <Btn
              kind="ghost"
              className="flex-1 !bg-slate-950/15 !text-slate-950"
              onClick={onHide}
            >
              Hide
            </Btn>
          </div>
          {full && (
            <button
              className="w-full text-center text-sm underline"
              onClick={onFinish}
            >
              Already played? Forgot to tap start
            </button>
          )}
        </div>
      </div>
      <DeclineSheet
        open={declining}
        onClose={() => setDeclining(false)}
        g={g}
        act={act}
      />
    </div>
  );
}

export function Teams({
  g,
  meId,
  dark,
}: {
  g: GameView;
  meId: string;
  dark?: boolean;
}) {
  return (
    <div
      className={cx(
        "mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl p-3",
        dark ? "bg-slate-950/10" : "bg-white/5",
      )}
    >
      <div className="min-w-0 space-y-1">
        <Person p={g.slots[0]!} me={meId} small hot={dark} />
        <Person p={g.slots[1]!} me={meId} small hot={dark} />
      </div>
      <span className="text-sm font-black opacity-60">vs</span>
      <div className="min-w-0 space-y-1">
        <Person p={g.slots[2]!} me={meId} small hot={dark} />
        <Person p={g.slots[3]!} me={meId} small hot={dark} />
      </div>
    </div>
  );
}

/**
 * The final score of a doubles game, as the four players see it: the team of
 * the first two names, then the team of the last two. Two whole numbers, no
 * tie. Used when finishing and, later, to add or fix a score.
 */
export function ScoreFields({
  g,
  a,
  b,
  setA,
  setB,
}: {
  g: GameView;
  a: string;
  b: string;
  setA: (v: string) => void;
  setB: (v: string) => void;
}) {
  const team = (i: number) =>
    [g.slots[i]?.name, g.slots[i + 1]?.name].filter(Boolean).join(" & ");
  const box = (
    label: string,
    v: string,
    set: (v: string) => void,
    id: string,
  ) => (
    <label className="block min-w-0 flex-1 text-center">
      <span className="block truncate text-xs text-white/70">{label}</span>
      <input
        aria-label={id}
        value={v}
        onChange={(e) => set(e.target.value.replace(/\D/g, "").slice(0, 2))}
        inputMode="numeric"
        className="mt-1 w-full rounded-xl bg-white/10 p-3 text-center text-3xl font-black tabular-nums"
      />
    </label>
  );
  return (
    <div className="flex items-end gap-3">
      {box(team(0), a, setA, "Score, first team")}
      <span className="pb-4 text-xl text-white/50">–</span>
      {box(team(2), b, setB, "Score, second team")}
    </div>
  );
}

const scoreOf = (a: string, b: string): [number, number] | null =>
  a !== "" && b !== "" && a !== b ? [Number(a), Number(b)] : null;

export function FinishSheet({
  open,
  onClose,
  g,
  act,
}: {
  open: boolean;
  onClose: () => void;
  g: GameView;
  act: Act;
}) {
  const [late, setLate] = useState(0);
  const [startAgo, setStartAgo] = useState(15);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [noScore, setNoScore] = useState(false);
  const score = scoreOf(a, b);
  const neverStarted = g.status === "called";
  const send = async () => {
    const ok = await act({
      type: "finish",
      gameId: g.id,
      score: noScore ? undefined : (score ?? undefined),
      finishedMinutesAgo: late || undefined,
      startedMinutesAgo: neverStarted ? startAgo : undefined,
    });
    if (ok) onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Finish game">
      <div className="space-y-4">
        {neverStarted && (
          <label className="block">
            <span className="text-sm text-white/70">
              Nobody tapped START. When did you start?
            </span>
            <select
              value={startAgo}
              onChange={(e) => setStartAgo(Number(e.target.value))}
              className="mt-1 w-full rounded-xl bg-white/10 p-3"
            >
              {[5, 10, 15, 20, 25, 30].map((m) => (
                <option key={m} value={m}>
                  About {m} min ago
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block">
          <span className="text-sm text-white/70">Finished</span>
          <select
            value={late}
            onChange={(e) => setLate(Number(e.target.value))}
            className="mt-1 w-full rounded-xl bg-white/10 p-3"
          >
            <option value={0}>Just now</option>
            {[2, 5, 10, 15].map((m) => (
              <option key={m} value={m}>
                {m} min ago (forgot to tap)
              </option>
            ))}
          </select>
        </label>
        {!noScore && (
          <div>
            <p className="mb-1 text-sm text-white/70">Final score</p>
            <ScoreFields g={g} a={a} b={b} setA={setA} setB={setB} />
            {a !== "" && a === b && (
              <p className="mt-1 text-xs text-amber-300">
                Badminton doesn&apos;t end in a tie — check the score.
              </p>
            )}
          </div>
        )}
        <Btn
          className="w-full"
          disabled={!noScore && !score}
          onClick={() => send()}
        >
          Finish game
        </Btn>
        <button
          type="button"
          className="w-full text-center text-sm text-white/60 underline"
          onClick={() => setNoScore((v) => !v)}
        >
          {noScore ? "Enter the score after all" : "We didn't keep score"}
        </button>
      </div>
    </Sheet>
  );
}

/** The result of the player's last game, or the way to add the score. */
function ResultLine({ g, meId, act }: { g: GameView; meId: string; act: Act }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [open, setOpen] = useState(false);
  const score = scoreOf(a, b);
  const idx = g.slots.findIndex((p) => p?.id === meId);
  if (g.score && g.winner !== null) {
    const won = idx >= 0 && (idx < 2 ? 0 : 1) === g.winner;
    return (
      <p className="mt-1 font-bold">
        {won ? "🎉 You won" : "Good game — they took this one"}{" "}
        <span className="tabular-nums">
          {g.score[0]}–{g.score[1]}
        </span>{" "}
        <button
          type="button"
          className="text-sm font-normal text-white/60 underline"
          onClick={() => setOpen((v) => !v)}
        >
          fix
        </button>
        {open && (
          <ScoreEdit
            g={g}
            a={a}
            b={b}
            setA={setA}
            setB={setB}
            score={score}
            act={act}
            done={() => setOpen(false)}
          />
        )}
      </p>
    );
  }
  return (
    <div className="mt-2">
      {!open ? (
        <Btn kind="ghost" onClick={() => setOpen(true)}>
          Add the score
        </Btn>
      ) : (
        <ScoreEdit
          g={g}
          a={a}
          b={b}
          setA={setA}
          setB={setB}
          score={score}
          act={act}
          done={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function ScoreEdit({
  g,
  a,
  b,
  setA,
  setB,
  score,
  act,
  done,
}: {
  g: GameView;
  a: string;
  b: string;
  setA: (v: string) => void;
  setB: (v: string) => void;
  score: [number, number] | null;
  act: Act;
  done: () => void;
}) {
  return (
    <span className="mt-2 block space-y-2 font-normal">
      <ScoreFields g={g} a={a} b={b} setA={setA} setB={setB} />
      <Btn
        className="w-full"
        disabled={!score}
        onClick={async () => {
          if (score && (await act({ type: "score", gameId: g.id, score })))
            done();
        }}
      >
        Save score
      </Btn>
    </span>
  );
}

function Invites({
  night,
  meId,
  act,
}: {
  night: NightView;
  meId: string;
  act: Act;
}) {
  const mine = night.challenges.filter(
    (c) =>
      c.status === "pending" || c.status === "ready" || c.status === "declined",
  );
  if (!mine.length) return null;
  return (
    <>
      {mine.map((c) => {
        const by = c.slots.find((p) => p.id === c.by)?.name ?? "Someone";
        const accepted = c.accepted.includes(meId);
        return (
          <Card key={c.id} tone={c.status === "declined" ? undefined : "warn"}>
            <p className="font-bold">
              {c.status === "declined"
                ? "Challenge called off"
                : c.status === "ready"
                  ? "Challenge on — waiting for a court"
                  : c.by === meId
                    ? "Your challenge"
                    : `${by} challenged you`}
            </p>
            <p className="text-sm">
              {c.slots[0]!.name} & {c.slots[1]!.name}{" "}
              <span className="opacity-60">vs</span> {c.slots[2]!.name} &{" "}
              {c.slots[3]!.name}
            </p>
            {c.status === "pending" && (
              <p className="mt-1 text-sm text-white/70">
                {c.accepted.length}/4 said yes. It goes ahead once all four are
                signed up and in the queue — you keep your place in line
                meanwhile.
              </p>
            )}
            {(c.status === "pending" || c.status === "ready") && (
              <div className="mt-3 flex gap-2">
                {!accepted && (
                  <Btn
                    className="flex-1"
                    onClick={() =>
                      act({ type: "challenge-accept", challengeId: c.id })
                    }
                  >
                    Accept
                  </Btn>
                )}
                <Btn
                  kind="ghost"
                  className="flex-1"
                  onClick={() =>
                    act({ type: "challenge-decline", challengeId: c.id })
                  }
                >
                  {c.by === meId
                    ? "Call it off"
                    : accepted
                      ? "Pull out"
                      : "No thanks"}
                </Btn>
              </div>
            )}
          </Card>
        );
      })}
    </>
  );
}

function MyResults({
  night,
  meId,
  act,
}: {
  night: NightView;
  meId: string;
  act: Act;
}) {
  const todo = night.me!.played.filter((g) => !g.kudosFrom.includes(meId));
  if (!todo.length) return null;
  const g = todo[0]!;
  return (
    <Card>
      <p className="text-sm tracking-wider text-white/60 uppercase">
        Your last game · Court {g.court} · {g.minutes} min
      </p>
      <Teams g={g} meId={meId} />
      <div className="mt-3">
        <p className="text-sm text-white/70">
          Say thanks to someone who made it fun
        </p>
        <div className="mt-1 flex flex-wrap gap-2">
          {g.slots
            .filter((p) => p && p.id !== meId)
            .map((p) => (
              <button
                key={p!.id}
                className="rounded-full bg-white/10 px-3 py-1 text-sm"
                onClick={() => act({ type: "kudos", gameId: g.id, to: p!.id })}
              >
                👏 {p!.name}
              </button>
            ))}
        </div>
      </div>
    </Card>
  );
}

/**
 * **Playing mood.** Optional, friendly and changeable any time tonight. It is
 * never shown on a card or next to a name; it only nudges who is mixed
 * together. Leave it blank and nothing changes.
 */
export function MoodPicker({ mood, act }: { mood: Mood | null; act: Act }) {
  return (
    <Card>
      <fieldset>
        <legend className="font-bold">
          What&apos;s your playing mood tonight?
        </legend>
        <p className="mt-1 text-sm text-white/60">
          Totally optional, and you can change it any time.
        </p>
        <div className="mt-3 space-y-2">
          {MOODS.map((m) => (
            <label
              key={m.id}
              className={cx(
                "flex cursor-pointer items-center gap-3 rounded-xl p-3 ring-1",
                mood === m.id
                  ? "bg-lime-400/15 ring-lime-300"
                  : "bg-white/5 ring-white/10",
              )}
            >
              <input
                type="radio"
                name="mood"
                checked={mood === m.id}
                onChange={() => act({ type: "mood", mood: m.id })}
                className="accent-lime-400"
              />
              <span>
                <span className="block font-semibold">{m.label}</span>
                <span className="block text-sm text-white/60">{m.hint}</span>
              </span>
            </label>
          ))}
        </div>
        {mood && (
          <button
            className="mt-2 text-sm text-white/60 underline"
            onClick={() => act({ type: "mood", mood: null })}
          >
            Skip this — any game is fun
          </button>
        )}
      </fieldset>
    </Card>
  );
}

/**
 * The three courts, drawn as courts: who is on each side of the net, how
 * long they've played, and who is prepared to go on next.
 */
export function CourtMap({
  night,
  meId,
  offset,
  onCourts,
}: {
  night: NightView;
  meId: string;
  offset: number;
  onCourts?: () => void;
}) {
  return (
    <section aria-label="Courts" className="space-y-2">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-sm font-bold tracking-wider text-white/60 uppercase">
          Courts
        </h2>
        {onCourts && (
          <button
            onClick={onCourts}
            className="text-sm font-bold text-lime-300 underline"
          >
            All courts →
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {night.courts.map((c) => {
          const g = c.game;
          const mine = g?.slots.some((p) => p?.id === meId);
          const next = night.prepared.find((p) => p.court === c.id);
          const status = c.closed
            ? "Closed"
            : !g
              ? "Open"
              : g.status === "called"
                ? "Called"
                : "Playing";
          return (
            <div
              key={c.id}
              data-testid={`court-${c.id}`}
              data-status={status.toLowerCase()}
              className={cx(
                "flex min-h-44 flex-col rounded-xl p-1.5 text-center ring-2",
                c.closed
                  ? "bg-white/5 text-white/40 ring-white/10"
                  : mine
                    ? "bg-lime-400 text-slate-950 ring-lime-300"
                    : !g
                      ? "bg-emerald-950/60 ring-lime-400/60"
                      : g.status === "called"
                        ? "animate-pulse bg-amber-300/15 ring-amber-300"
                        : "bg-emerald-950/60 ring-white/15",
              )}
            >
              <p className="text-lg leading-tight font-black">{c.id}</p>
              <p
                className={cx(
                  "mt-0.5 text-xs font-black uppercase",
                  !mine && !g && !c.closed && "text-lime-300",
                  !mine && g?.status === "called" && "text-amber-300",
                )}
              >
                {status}
                {g?.status === "playing" && g.startedAt && (
                  <>
                    {" "}
                    <Elapsed from={g.startedAt} offset={offset} />
                  </>
                )}
              </p>
              {g && (
                <div className="mt-1 flex flex-1 flex-col justify-center text-[11px] leading-tight font-semibold">
                  {[0, 1].map((team) => (
                    <div key={team}>
                      {team === 1 && (
                        <div
                          aria-hidden
                          className="my-1 border-t-2 border-dashed border-current opacity-40"
                        />
                      )}
                      {g.slots.slice(team * 2, team * 2 + 2).map((p, k) => (
                        <p
                          key={k}
                          className={cx(
                            "truncate",
                            p?.id === meId && "font-black underline",
                          )}
                        >
                          {p ? p.name.split(" ")[0] : "—"}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              {next && (
                <p className="mt-1 border-t border-current/20 pt-1 text-[10px] leading-tight opacity-80">
                  Next:{" "}
                  {next.slots
                    .filter(Boolean)
                    .map((p) => p!.name.split(" ")[0])
                    .join(", ")}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Line({ night, meId }: { night: NightView; meId: string }) {
  if (!night.queue.length) return null;
  return (
    <Card>
      <h2 className="mb-2 font-bold">In line ({night.queue.length})</h2>
      <ol className="space-y-1.5">
        {night.queue.map((q, i) => (
          <li key={q.person.id} className="flex items-center gap-3">
            <span className="w-6 text-right text-white/50 tabular-nums">
              {i + 1}
            </span>
            <Person p={q.person} me={meId} small />
          </li>
        ))}
      </ol>
      {night.readyChallenges > 0 && (
        <p className="mt-2 text-sm text-white/60">
          + {plural(night.readyChallenges, "challenge")} waiting for a court
        </p>
      )}
    </Card>
  );
}

function NoNightToday({
  view,
  offset,
  onCourts,
}: {
  view: LiveView;
  offset: number;
  onCourts?: () => void;
}) {
  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs font-bold tracking-widest text-lime-300/80 uppercase">
          {view.season.club}
        </p>
        <h1 className="text-2xl font-black">No badminton today</h1>
        <p className="text-sm text-white/60">{view.season.venue}</p>
      </header>
      <NextSession view={view} offset={offset} onCourts={onCourts} />
    </div>
  );
}

/** Today's night before it starts: the countdown to 8:00, then the spaces. */
function TodaySignUp({ night, offset }: { night: NightView; offset: number }) {
  const now = useNow(offset);
  if (night.registration !== "not-yet" && night.registration !== "open")
    return null;
  return (
    <Card className="ring-2 ring-lime-400/50">
      <RegistrationNote
        date={night.date}
        now={now}
        confirmed={night.confirmed}
        capacity={night.capacity}
        big
      />
    </Card>
  );
}

/**
 * Who's here tonight — the names everyone in the club can already see on
 * the courts and in "Play with friends". Nothing about anyone's level, mood
 * or record.
 */
function HereTonight({ night, meId }: { night: NightView; meId: string }) {
  if (night.status !== "live" || !night.present.length) return null;
  return (
    <Card>
      <h2 className="mb-2 font-bold">Here tonight ({night.present.length})</h2>
      <p className="text-sm leading-relaxed text-white/80">
        {night.present.map((p, i) => (
          <span key={p.id} className={cx(p.id === meId && "font-black")}>
            {i ? ", " : ""}
            {p.name}
          </span>
        ))}
      </p>
    </Card>
  );
}

export { clock };
