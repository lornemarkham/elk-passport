"use client";

import { useState } from "react";
import type { GameView, LiveView, NightView } from "@/lib/courtqueue/view";
import {
  Btn,
  Card,
  Elapsed,
  Person,
  Sheet,
  Toggle,
  clock,
  cx,
  plural,
} from "./bits";

export type Act = (cmd: object, sessionId?: string) => Promise<boolean>;

export function Tonight({
  view,
  act,
  offset,
}: {
  view: LiveView;
  act: Act;
  offset: number;
}) {
  const night = view.night;
  const meId = view.me!.id;
  if (!night) return <Upcoming view={view} act={act} />;
  const me = night.me!;
  return (
    <div className="space-y-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-black">{night.label}</h1>
        <span className="text-sm text-white/60">
          {night.confirmed}/{night.capacity} in
          {night.waitlisted ? ` · ${night.waitlisted} waiting` : ""}
        </span>
      </header>
      <MyCard night={night} meId={meId} act={act} offset={offset} />
      <Invites night={night} meId={meId} act={act} />
      <MyResults night={night} meId={meId} act={act} />
      <CourtStrip night={night} meId={meId} offset={offset} />
      <Line night={night} meId={meId} />
      {night.status !== "ended" &&
        me.state !== "away" &&
        me.state !== "left" && (
          <Card>
            <Toggle
              label="Back in line automatically after each game"
              on={me.autoRequeue}
              onChange={(on) => act({ type: "auto-requeue", on })}
            />
            {me.state !== "playing" && (
              <button
                className="mt-2 text-sm text-white/60 underline"
                onClick={() => act({ type: "leave" })}
              >
                I&apos;m heading home
              </button>
            )}
          </Card>
        )}
      <Upcoming view={view} act={act} skip={night.id} />
    </div>
  );
}

function MyCard({
  night,
  meId,
  act,
  offset,
}: {
  night: NightView;
  meId: string;
  act: Act;
  offset: number;
}) {
  const me = night.me!;
  const [declining, setDeclining] = useState(false);
  const [finishing, setFinishing] = useState(false);
  if (night.status === "ended")
    return (
      <Card>
        <p className="text-lg font-bold">That&apos;s a wrap for tonight.</p>
        <p className="text-white/70">
          You played {plural(me.games, "game")} · {me.minutes} min on court.
        </p>
      </Card>
    );
  const tally = (
    <p className="mt-3 text-sm opacity-80">
      Tonight: {plural(me.games, "game")} · {me.minutes} min played
    </p>
  );
  switch (me.state) {
    case "away":
      if (me.roster === "waitlist")
        return (
          <Card tone="warn">
            <p className="text-lg font-bold">
              You&apos;re #{me.waitlistPosition} on the waitlist
            </p>
            <p className="text-white/70">
              You&apos;ll move up automatically if someone cancels.
            </p>
            <button
              className="mt-3 text-sm underline"
              onClick={() => act({ type: "cancel" })}
            >
              Take me off the waitlist
            </button>
          </Card>
        );
      return (
        <Card>
          <p className="mb-3 text-white/70">
            {me.roster === "confirmed"
              ? "You're signed up. At the gym?"
              : "Not signed up yet — there's room."}
          </p>
          <Btn big onClick={() => act({ type: "check-in" })}>
            I&apos;M HERE
          </Btn>
          {me.roster === "confirmed" && (
            <button
              className="mt-3 text-sm text-white/60 underline"
              onClick={() => act({ type: "cancel" })}
            >
              Can&apos;t make it tonight
            </button>
          )}
        </Card>
      );
    case "left":
      return (
        <Card>
          <p className="mb-3">You&apos;ve headed home. Changed your mind?</p>
          <Btn onClick={() => act({ type: "check-in" })}>I&apos;m back</Btn>
          {tally}
        </Card>
      );
    case "idle":
      return (
        <Card>
          <Btn big onClick={() => act({ type: "play" })} aria-label="Play">
            🏸 PLAY
          </Btn>
          <p className="mt-3 text-center text-sm text-white/60">
            {courtsFree(night)} · {night.queue.length} waiting
          </p>
          {tally}
        </Card>
      );
    case "queued":
      return (
        <Card>
          <p className="text-sm tracking-wider text-white/60 uppercase">
            You&apos;re in line
          </p>
          <p className="text-5xl font-black">#{me.queuePosition}</p>
          <p className="text-lg">
            {me.estimateMin === 0
              ? "Next court that opens"
              : `About ${me.estimateMin} min`}
            {me.queuedSince ? (
              <span className="text-white/60">
                {" "}
                · waiting <Elapsed from={me.queuedSince} offset={offset} />
              </span>
            ) : null}
          </p>
          <p className="mt-1 text-sm text-white/60">
            Fewest games tonight goes first, then whoever has waited longest.
            Put your phone down — we&apos;ll call you.
          </p>
          {tally}
          <Btn
            kind="ghost"
            className="mt-3"
            onClick={() => act({ type: "pause" })}
          >
            Take a break
          </Btn>
        </Card>
      );
    case "challenge":
      return (
        <Card tone="warn">
          <p className="text-lg font-bold">Your challenge is on</p>
          <p className="text-white/70">
            It goes to a court once all four are off court and fairness allows —
            players still waiting for their first game go first.
          </p>
          {tally}
        </Card>
      );
    case "called":
    case "playing": {
      const g = me.game!;
      const court = night.courts.find((c) => c.id === g.court)!;
      const full = g.slots.every(Boolean);
      return (
        <Card tone="hot">
          {g.status === "called" ? (
            <p className="text-sm font-bold tracking-wider uppercase">
              You&apos;re up!
            </p>
          ) : (
            <p className="text-sm font-bold tracking-wider uppercase">
              Playing · <Elapsed from={g.startedAt!} offset={offset} />
            </p>
          )}
          <p className="text-3xl font-black">Court {g.court}</p>
          <p className="font-semibold">
            {court.name} · {court.where}
          </p>
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
                      I&apos;m in
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
                    onClick={() => setFinishing(true)}
                  >
                    Already played? Forgot to tap start
                  </button>
                )}
              </>
            ) : (
              <Btn big kind="dark" onClick={() => setFinishing(true)}>
                FINISH GAME
              </Btn>
            )}
          </div>
          <Sheet
            open={declining}
            onClose={() => setDeclining(false)}
            title="Skip this game?"
          >
            <p className="mb-4 text-white/70">
              No penalty. Someone else takes your spot.
            </p>
            <div className="space-y-2">
              <Btn
                className="w-full"
                onClick={() =>
                  act({ type: "decline", gameId: g.id }).then(() =>
                    setDeclining(false),
                  )
                }
              >
                Keep my place in line
              </Btn>
              <Btn
                kind="ghost"
                className="w-full"
                onClick={() =>
                  act({ type: "decline", gameId: g.id, pause: true }).then(() =>
                    setDeclining(false),
                  )
                }
              >
                I&apos;m taking a break
              </Btn>
            </div>
          </Sheet>
          <FinishSheet
            open={finishing}
            onClose={() => setFinishing(false)}
            g={g}
            act={act}
          />
        </Card>
      );
    }
  }
}

function courtsFree(night: NightView) {
  const n = night.courts.filter((c) => !c.closed && !c.game).length;
  return n === 0 ? "All courts busy" : `${plural(n, "court")} free`;
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

function FinishSheet({
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
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [late, setLate] = useState(0);
  const [startAgo, setStartAgo] = useState(15);
  const neverStarted = g.status === "called";
  const team = (i: number) =>
    g.slots
      .slice(i * 2, i * 2 + 2)
      .map((p) => p?.name.split(" ")[0])
      .join(" & ");
  const send = async (withScore: boolean) => {
    const score = withScore ? [Number(a), Number(b)] : undefined;
    const ok = await act({
      type: "finish",
      gameId: g.id,
      score,
      finishedMinutesAgo: late || undefined,
      startedMinutesAgo: neverStarted ? startAgo : undefined,
    });
    if (ok) onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Finish game">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map((i) => (
            <label key={i} className="block">
              <span className="mb-1 block truncate text-sm text-white/70">
                {team(i)}
              </span>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                aria-label={`Score for ${team(i)}`}
                value={i === 0 ? a : b}
                onChange={(e) =>
                  (i === 0 ? setA : setB)(
                    e.target.value.replace(/\D/g, "").slice(0, 2),
                  )
                }
                className="w-full rounded-xl bg-white/10 p-4 text-center text-4xl font-black"
                placeholder="–"
              />
            </label>
          ))}
        </div>
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
        <Btn
          className="w-full"
          disabled={!a || !b || a === b}
          onClick={() => send(true)}
        >
          Save {a && b ? `${a}–${b}` : "score"} & finish
        </Btn>
        <Btn kind="ghost" className="w-full" onClick={() => send(false)}>
          Finish without a score
        </Btn>
      </div>
    </Sheet>
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
                {c.accepted.length}/4 said yes. You keep your place in line
                until all four have.
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
  const [scoring, setScoring] = useState<GameView | null>(null);
  const todo = night.me!.played.filter(
    (g) =>
      !g.score ||
      (g.score && !g.confirmedBy && g.scoreBy !== meId && !g.disputedBy) ||
      !g.kudosFrom.includes(meId),
  );
  if (!todo.length) return null;
  const g = todo[0]!;
  return (
    <Card>
      <p className="text-sm tracking-wider text-white/60 uppercase">
        Your last game · Court {g.court} · {g.minutes} min
      </p>
      <Teams g={g} meId={meId} />
      {g.score ? (
        <p className="mt-2 text-2xl font-black">
          {g.score[0]}–{g.score[1]}
          {g.confirmedBy ? (
            <span className="ml-2 text-sm font-normal text-lime-300">
              confirmed
            </span>
          ) : null}
          {g.disputedBy ? (
            <span className="ml-2 text-sm font-normal text-amber-300">
              with the organizer
            </span>
          ) : null}
        </p>
      ) : (
        <Btn kind="ghost" className="mt-3 w-full" onClick={() => setScoring(g)}>
          Add the score
        </Btn>
      )}
      {g.score && !g.confirmedBy && !g.disputedBy && g.scoreBy !== meId && (
        <div className="mt-3 flex gap-2">
          <Btn
            className="flex-1"
            onClick={() => act({ type: "confirm", gameId: g.id })}
          >
            That&apos;s right
          </Btn>
          <Btn
            kind="ghost"
            className="flex-1"
            onClick={() => act({ type: "dispute", gameId: g.id })}
          >
            Not quite
          </Btn>
        </div>
      )}
      {!g.kudosFrom.includes(meId) && (
        <div className="mt-3">
          <p className="text-sm text-white/70">Shout out a good sport</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {g.slots
              .filter((p) => p && p.id !== meId)
              .map((p) => (
                <button
                  key={p!.id}
                  className="rounded-full bg-white/10 px-3 py-1 text-sm"
                  onClick={() =>
                    act({ type: "kudos", gameId: g.id, to: p!.id })
                  }
                >
                  👏 {p!.name}
                </button>
              ))}
          </div>
        </div>
      )}
      {scoring && (
        <ScoreSheet g={scoring} act={act} onClose={() => setScoring(null)} />
      )}
    </Card>
  );
}

function ScoreSheet({
  g,
  act,
  onClose,
}: {
  g: GameView;
  act: Act;
  onClose: () => void;
}) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  return (
    <Sheet open onClose={onClose} title="Final score">
      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <input
            key={i}
            inputMode="numeric"
            aria-label={`Score ${i + 1}`}
            value={i === 0 ? a : b}
            onChange={(e) =>
              (i === 0 ? setA : setB)(
                e.target.value.replace(/\D/g, "").slice(0, 2),
              )
            }
            className="rounded-xl bg-white/10 p-4 text-center text-4xl font-black"
            placeholder={g.slots
              .slice(i * 2, i * 2 + 2)
              .map((p) => p?.name.split(" ")[0])
              .join("+")}
          />
        ))}
      </div>
      <Btn
        className="mt-4 w-full"
        disabled={!a || !b || a === b}
        onClick={() =>
          act({
            type: "score",
            gameId: g.id,
            score: [Number(a), Number(b)],
          }).then((ok) => ok && onClose())
        }
      >
        Save
      </Btn>
    </Sheet>
  );
}

export function CourtStrip({
  night,
  meId,
  offset,
}: {
  night: NightView;
  meId: string;
  offset: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {night.courts.map((c) => (
        <div
          key={c.id}
          data-testid={`court-${c.id}`}
          className={cx(
            "rounded-xl p-2 text-center ring-1",
            c.closed
              ? "bg-white/5 text-white/40 ring-white/10"
              : !c.game
                ? "bg-lime-400/15 ring-lime-300/40"
                : c.game.slots.some((p) => p?.id === meId)
                  ? "bg-lime-400 text-slate-950 ring-lime-300"
                  : "bg-white/5 ring-white/10",
          )}
        >
          <p className="text-xs font-bold uppercase">Court {c.id}</p>
          <p className="text-[11px] opacity-70">{c.kind}</p>
          <p className="mt-1 text-sm font-semibold">
            {c.closed ? (
              "Closed"
            ) : !c.game ? (
              "Available"
            ) : c.game.status === "called" ? (
              "Called"
            ) : (
              <Elapsed from={c.game.startedAt!} offset={offset} />
            )}
          </p>
        </div>
      ))}
    </div>
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

function Upcoming({
  view,
  act,
  skip,
}: {
  view: LiveView;
  act: Act;
  skip?: string;
}) {
  const list = view.sessions.filter(
    (s) => s.id !== skip && s.status !== "ended",
  );
  if (!list.length)
    return skip ? null : (
      <Card>
        <p className="text-lg font-bold">No sessions on the calendar yet.</p>
        <p className="text-white/70">
          The organizer adds Monday and Thursday nights.
        </p>
      </Card>
    );
  return (
    <div className="space-y-2">
      <h2 className="font-bold text-white/80">Coming up</h2>
      {list.map((s) => (
        <Card key={s.id} className="flex items-center justify-between gap-3">
          <div>
            <p className="font-bold">{s.label}</p>
            <p className="text-sm text-white/60">
              {s.confirmed}/{s.capacity} signed up
              {s.waitlisted ? ` · ${s.waitlisted} on waitlist` : ""}
              {!s.registrationOpen ? " · registration closed" : ""}
            </p>
            {s.mine === "confirmed" && (
              <p className="text-sm font-semibold text-lime-300">
                You&apos;re in
              </p>
            )}
            {s.mine === "waitlist" && (
              <p className="text-sm font-semibold text-amber-300">
                Waitlist #{s.waitlistPosition}
              </p>
            )}
          </div>
          {s.mine === "confirmed" || s.mine === "waitlist" ? (
            <Btn kind="ghost" onClick={() => act({ type: "cancel" }, s.id)}>
              Cancel
            </Btn>
          ) : (
            <Btn
              disabled={!s.registrationOpen}
              onClick={() => act({ type: "register" }, s.id)}
            >
              {s.confirmed >= s.capacity ? "Join waitlist" : "I'm in"}
            </Btn>
          )}
        </Card>
      ))}
    </div>
  );
}

export { clock };
