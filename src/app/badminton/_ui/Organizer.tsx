"use client";

import { useEffect, useState } from "react";
import { localHHMM } from "@/lib/courtqueue/clock";
import type { Court } from "@/lib/courtqueue/model";
import type { GameView, LiveView } from "@/lib/courtqueue/view";
import { Btn, Card, Person, Sheet, clock, cx } from "./bits";
import { post } from "./api";

type SessionAct = (cmd: object, sessionId?: string) => Promise<boolean>;

/** The one link everybody joins by, as text and as a QR code to hold up. */
function InviteCard() {
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const u = `${window.location.origin}/badminton`;
    void import("qrcode").then((q) =>
      q
        .toDataURL(u, { margin: 2, width: 480, errorCorrectionLevel: "M" })
        .then((data) => {
          setUrl(u);
          setQr(data);
        }),
    );
  }, []);
  return (
    <Card>
      <h2 className="mb-1 font-bold">Invite players</h2>
      <p className="mb-3 text-sm text-white/70">
        Everyone scans this (or opens the link), adds their name, email and a
        PIN, and is in the same night.
      </p>
      {qr && (
        <img
          src={qr}
          alt="QR code to join CourtQueue"
          className="mx-auto h-56 w-56 rounded-xl bg-white"
        />
      )}
      <p className="mt-3 text-center font-mono text-sm break-all">{url}</p>
      <div className="mt-2 flex justify-center gap-2">
        <Btn
          kind="ghost"
          onClick={async () => {
            await navigator.clipboard?.writeText(url).catch(() => {});
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy link"}
        </Btn>
        {typeof navigator !== "undefined" && "share" in navigator && (
          <Btn
            kind="ghost"
            onClick={() =>
              navigator.share({ title: "CourtQueue", url }).catch(() => {})
            }
          >
            Share
          </Btn>
        )}
      </div>
    </Card>
  );
}

export function Organizer({
  view,
  act,
  clubAct,
  addSessions,
  focus,
  setFocus,
}: {
  view: LiveView;
  act: SessionAct;
  clubAct: (cmd: object) => Promise<boolean>;
  addSessions: () => Promise<boolean>;
  focus: string | null;
  setFocus: (id: string | null) => void;
}) {
  const o = view.organizer!;
  const sessionId = focus ?? view.night?.id ?? null;
  const session = view.sessions.find((s) => s.id === sessionId) ?? null;
  const live = view.night && view.night.id === sessionId ? view.night : null;
  const sact = (cmd: object) => act(cmd, sessionId ?? undefined);
  const [fixing, setFixing] = useState<GameView | null>(null);
  const [assigning, setAssigning] = useState<number | null>(null);
  const [editing, setEditing] = useState<Court | null>(null);
  const [pinFor, setPinFor] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [filter, setFilter] = useState("");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">Organizer</h1>
      {o.alerts.length > 0 && (
        <Card tone="warn">
          <ul className="space-y-1 text-sm">
            {o.alerts.map((a) => (
              <li key={a}>⚠️ {a}</li>
            ))}
          </ul>
        </Card>
      )}

      <InviteCard />

      <Card>
        <div className="flex items-center justify-between gap-2">
          <select
            aria-label="Session"
            value={sessionId ?? ""}
            onChange={(e) => setFocus(e.target.value || null)}
            className="min-w-0 flex-1 rounded-xl bg-white/10 p-3 font-bold"
          >
            {!view.sessions.length && <option value="">No sessions</option>}
            {view.sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} — {s.status}
              </option>
            ))}
          </select>
          <Btn kind="ghost" onClick={addSessions}>
            + Mon/Thu
          </Btn>
        </div>
        {session && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Btn
              kind="ghost"
              onClick={() => sact({ type: "registration", open: session.held })}
            >
              {session.held ? "Reopen sign-up" : "Close sign-up"}
            </Btn>
            {session.status === "upcoming" && (
              <Btn kind="ghost" onClick={() => sact({ type: "go-live" })}>
                Open check-in now
              </Btn>
            )}
            {session.status === "live" && (
              <Btn
                kind="danger"
                onClick={() => {
                  if (
                    confirm(
                      "End the session? Games still playing are finished now; the queue is cleared.",
                    )
                  )
                    void sact({ type: "end" });
                }}
              >
                End session
              </Btn>
            )}
          </div>
        )}
        {session && (
          <p className="mt-2 text-sm text-white/60">
            {session.confirmed}/{session.capacity} confirmed ·{" "}
            {session.waitlisted} on waitlist
            {o.spread
              ? ` · games tonight range ${o.spread.fewest}–${o.spread.most}`
              : ""}
          </p>
        )}
      </Card>

      {live && (
        <Card>
          <h2 className="mb-2 font-bold">Courts</h2>
          <div className="space-y-3">
            {live.courts.map((c) => (
              <div key={c.id} className="rounded-xl bg-white/5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold">
                    {c.id}. {c.name}
                  </p>
                  <span className="text-sm">
                    {c.closed ? "Closed" : c.game ? c.game.status : "Available"}
                  </span>
                </div>
                <p className="text-xs text-white/50">{c.where}</p>
                {c.game && (
                  <p className="mt-1 text-sm text-white/80">
                    {c.game.slots.map((p) => p?.name ?? "—").join(", ")}
                    {c.game.startedAt
                      ? ` · since ${clock(c.game.startedAt)}`
                      : ""}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {!c.game && !c.closed && (
                    <Btn kind="ghost" onClick={() => setAssigning(c.id)}>
                      Assign four
                    </Btn>
                  )}
                  {c.game && (
                    <>
                      <Btn kind="ghost" onClick={() => setFixing(c.game)}>
                        Fix times
                      </Btn>
                      {c.game.status === "playing" && (
                        <Btn
                          kind="ghost"
                          onClick={() =>
                            sact({ type: "finish", gameId: c.game!.id })
                          }
                        >
                          Finish now
                        </Btn>
                      )}
                      <Btn
                        kind="ghost"
                        onClick={() => {
                          if (
                            confirm(
                              "Cancel this game? Its players go back in line where they were.",
                            )
                          )
                            void sact({
                              type: "cancel-game",
                              gameId: c.game!.id,
                              reason: "Organizer",
                            });
                        }}
                      >
                        Cancel game
                      </Btn>
                    </>
                  )}
                  {!c.game && (
                    <Btn
                      kind="ghost"
                      onClick={() =>
                        sact({
                          type: "court-closed",
                          court: c.id,
                          closed: !c.closed,
                        })
                      }
                    >
                      {c.closed ? "Reopen" : "Close court"}
                    </Btn>
                  )}
                  <Btn
                    kind="ghost"
                    onClick={() =>
                      setEditing(o.courts.find((x) => x.id === c.id) ?? null)
                    }
                  >
                    Rename
                  </Btn>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {o.games.length > 0 && (
        <Card>
          <h2 className="mb-2 font-bold">Games tonight</h2>
          <ul className="divide-y divide-white/10 text-sm">
            {o.games.map((g) => (
              <li
                key={g.id}
                className="flex items-center justify-between gap-2 py-2"
              >
                <span className="min-w-0">
                  <span className="block truncate">
                    C{g.court} ·{" "}
                    {g.slots
                      .map((p) => p?.name.split(" ")[0] ?? "—")
                      .join(", ")}
                  </span>
                  <span className="text-white/60">
                    {g.status}
                    {g.score ? ` · ${g.score[0]}–${g.score[1]}` : ""}
                    {g.startedAt ? ` · ${clock(g.startedAt)}` : ""}
                    {g.finishedAt
                      ? `–${clock(g.finishedAt)} (${g.minutes} min)`
                      : ""}
                    {g.startEstimated || g.endEstimated ? " · estimated" : ""}
                  </span>
                </span>
                <Btn kind="ghost" onClick={() => setFixing(g)}>
                  Fix
                </Btn>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {session && (
        <Card>
          <h2 className="mb-2 font-bold">
            Roster ({o.roster.filter((r) => r.status === "confirmed").length})
          </h2>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Find a player"
            className="mb-2 w-full rounded-xl bg-white/10 p-2"
          />
          <ul className="space-y-2">
            {o.roster
              .filter(
                (r) =>
                  r.status !== "cancelled" &&
                  r.person.name.toLowerCase().includes(filter.toLowerCase()),
              )
              .map((r) => (
                <li
                  key={r.person.id}
                  className="rounded-xl bg-white/5 p-2 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Person p={r.person} small />
                    <span
                      className={cx(
                        "shrink-0 text-xs font-bold",
                        r.status === "waitlist"
                          ? "text-amber-300"
                          : r.status === "no-show"
                            ? "text-rose-300"
                            : "text-white/60",
                      )}
                    >
                      {r.status === "confirmed"
                        ? r.here
                          ? "here"
                          : r.left
                            ? "left"
                            : "not here"
                        : r.status}
                    </span>
                  </div>
                  {r.here && (
                    <p className="mt-1 text-xs text-white/60">
                      {r.games} games · {r.minutes} min
                      {r.waitingMin !== null
                        ? ` · waiting ${r.waitingMin} min`
                        : ""}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.here && (
                      <Mini
                        onClick={() =>
                          sact({
                            type: "play-next",
                            playerId: r.person.id,
                            on: !r.nextUp,
                          })
                        }
                      >
                        {r.nextUp ? "✓ Playing next" : "Play next"}
                      </Mini>
                    )}
                    {r.status === "waitlist" && (
                      <Mini
                        onClick={() =>
                          sact({ type: "promote", playerId: r.person.id })
                        }
                      >
                        Promote
                      </Mini>
                    )}
                    {r.status !== "waitlist" &&
                      !r.here &&
                      session.status !== "ended" && (
                        <Mini
                          onClick={() =>
                            sact({ type: "check-in", playerId: r.person.id })
                          }
                        >
                          Check in
                        </Mini>
                      )}
                    {r.status === "confirmed" && !r.here && (
                      <Mini
                        onClick={() =>
                          sact({ type: "no-show", playerId: r.person.id })
                        }
                      >
                        No-show
                      </Mini>
                    )}
                    {r.here && (
                      <Mini
                        onClick={() =>
                          sact({ type: "leave", playerId: r.person.id })
                        }
                      >
                        Sign out for night
                      </Mini>
                    )}
                    <Mini
                      onClick={() =>
                        sact({ type: "cancel", playerId: r.person.id })
                      }
                    >
                      Remove
                    </Mini>
                  </div>
                </li>
              ))}
          </ul>
          <AddToRoster
            players={o.players}
            roster={o.roster.map((r) => r.person.id)}
            onAdd={(id) => sact({ type: "register", playerId: id })}
          />
        </Card>
      )}

      <Card>
        <h2 className="mb-2 font-bold">Players ({o.players.length})</h2>
        <ul className="space-y-1.5 text-sm">
          {o.players.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2">
              <span className="min-w-0">
                <Person p={p} small />
                {p.email && (
                  <span className="block truncate pl-10 text-xs text-white/50">
                    {p.email}
                  </span>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <Mini onClick={() => setPinFor({ id: p.id, name: p.name })}>
                  PIN
                </Mini>
                <Mini
                  onClick={() =>
                    clubAct({
                      type: "organizer",
                      playerId: p.id,
                      on: !p.organizer,
                    })
                  }
                >
                  {p.organizer ? "★ org" : "make org"}
                </Mini>
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Rules view={view} clubAct={clubAct} />

      {o.audit.length > 0 && (
        <Card>
          <h2 className="mb-2 font-bold">Audit trail</h2>
          <ul className="space-y-1 text-xs text-white/70">
            {o.audit.map((a, i) => (
              <li key={i}>
                {clock(a.at)} · {a.by}: {a.what}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {fixing && (
        <FixSheet g={fixing} onClose={() => setFixing(null)} act={sact} />
      )}
      {assigning !== null && live && (
        <AssignSheet
          court={assigning}
          present={live.present.filter(
            (p) =>
              !live.courts.some((c) =>
                c.game?.slots.some((s) => s?.id === p.id),
              ),
          )}
          onClose={() => setAssigning(null)}
          act={sact}
        />
      )}
      {editing && (
        <CourtSheet
          court={editing}
          onClose={() => setEditing(null)}
          clubAct={clubAct}
        />
      )}
      {pinFor && <PinSheet who={pinFor} onClose={() => setPinFor(null)} />}
    </div>
  );
}

function Mini({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg bg-white/10 px-2 py-1 text-xs font-semibold"
    >
      {children}
    </button>
  );
}

function AddToRoster({
  players,
  roster,
  onAdd,
}: {
  players: { id: string; name: string }[];
  roster: string[];
  onAdd: (id: string) => void;
}) {
  const left = players.filter((p) => !roster.includes(p.id));
  if (!left.length) return null;
  return (
    <select
      aria-label="Add a player"
      className="mt-3 w-full rounded-xl bg-white/10 p-2 text-sm"
      value=""
      onChange={(e) => e.target.value && onAdd(e.target.value)}
    >
      <option value="">+ Add a registered player to this session</option>
      {left.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

function FixSheet({
  g,
  onClose,
  act,
}: {
  g: GameView;
  onClose: () => void;
  act: SessionAct;
}) {
  const [start, setStart] = useState(g.startedAt ? localHHMM(g.startedAt) : "");
  const [end, setEnd] = useState(g.finishedAt ? localHHMM(g.finishedAt) : "");
  const [reason, setReason] = useState("");
  const send = async () => {
    const cmd: Record<string, unknown> = {
      type: "correct",
      gameId: g.id,
      reason,
    };
    if (start && start !== (g.startedAt ? localHHMM(g.startedAt) : ""))
      cmd.startedAt = start;
    if (end && end !== (g.finishedAt ? localHHMM(g.finishedAt) : ""))
      cmd.finishedAt = end;
    if (await act(cmd)) onClose();
  };
  return (
    <Sheet open onClose={onClose} title={`Fix court ${g.court}`}>
      <p className="mb-3 text-sm text-white/70">
        {g.slots.map((p) => p?.name ?? "—").join(", ")}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className="text-sm text-white/70">Started</span>
          <input
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="mt-1 w-full rounded-xl bg-white/10 p-3"
          />
        </label>
        <label>
          <span className="text-sm text-white/70">Finished</span>
          <input
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="mt-1 w-full rounded-xl bg-white/10 p-3"
          />
        </label>
      </div>
      <label className="mt-3 block">
        <span className="text-sm text-white/70">
          Why (kept in the audit trail)
        </span>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Forgot to finish"
          className="mt-1 w-full rounded-xl bg-white/10 p-3"
        />
      </label>
      <div className="mt-4 flex gap-2">
        <Btn className="flex-1" disabled={!reason.trim()} onClick={send}>
          Save correction
        </Btn>
        {g.status === "finished" && (
          <Btn
            kind="danger"
            onClick={() => {
              if (confirm("Remove this game from the record?"))
                void act({
                  type: "cancel-game",
                  gameId: g.id,
                  reason: reason || "Didn't happen",
                }).then(onClose);
            }}
          >
            Void
          </Btn>
        )}
      </div>
    </Sheet>
  );
}

function AssignSheet({
  court,
  present,
  onClose,
  act,
}: {
  court: number;
  present: { id: string; name: string }[];
  onClose: () => void;
  act: SessionAct;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) =>
    setPicked((p) =>
      p.includes(id)
        ? p.filter((x) => x !== id)
        : p.length < 4
          ? [...p, id]
          : p,
    );
  return (
    <Sheet open onClose={onClose} title={`Assign court ${court}`}>
      <p className="mb-2 text-sm text-white/70">
        Tap four players. First two are one team.
      </p>
      <ul className="grid grid-cols-2 gap-2">
        {present.map((p) => (
          <li key={p.id}>
            <button
              onClick={() => toggle(p.id)}
              className={cx(
                "w-full rounded-xl p-2 text-left text-sm",
                picked.includes(p.id)
                  ? "bg-lime-400 text-slate-950"
                  : "bg-white/10",
              )}
            >
              {picked.includes(p.id) ? `${picked.indexOf(p.id) + 1}. ` : ""}
              {p.name}
            </button>
          </li>
        ))}
      </ul>
      <Btn
        className="mt-4 w-full"
        disabled={picked.length !== 4}
        onClick={() =>
          act({ type: "assign", court, slots: picked }).then(
            (ok) => ok && onClose(),
          )
        }
      >
        Call this game
      </Btn>
    </Sheet>
  );
}

function CourtSheet({
  court,
  onClose,
  clubAct,
}: {
  court: Court;
  onClose: () => void;
  clubAct: (cmd: object) => Promise<boolean>;
}) {
  const [name, setName] = useState(court.name);
  const [where, setWhere] = useState(court.where);
  return (
    <Sheet open onClose={onClose} title={court.name}>
      <p className="mb-3 text-sm text-white/70">
        Every court is for everyone. Just a name and where it is, so people can
        find it.
      </p>
      <label className="block">
        <span className="text-sm text-white/70">Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-xl bg-white/10 p-3"
        />
      </label>
      <label className="mt-3 block">
        <span className="text-sm text-white/70">Where it is</span>
        <input
          value={where}
          onChange={(e) => setWhere(e.target.value)}
          className="mt-1 w-full rounded-xl bg-white/10 p-3"
        />
      </label>
      <Btn
        className="mt-4 w-full"
        onClick={() =>
          clubAct({
            type: "court",
            court: court.id,
            patch: { name, where },
          }).then((ok) => ok && onClose())
        }
      >
        Save
      </Btn>
    </Sheet>
  );
}

function PinSheet({
  who,
  onClose,
}: {
  who: { id: string; name: string };
  onClose: () => void;
}) {
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <Sheet open onClose={onClose} title={`New PIN for ${who.name}`}>
      <input
        inputMode="numeric"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
        className="w-full rounded-xl bg-white/10 p-3 text-2xl"
        placeholder="4–8 digits"
      />
      <p className="mt-2 text-xs text-white/60">
        Signs them out everywhere. Tell them the new PIN in person.
      </p>
      {msg && <p className="mt-2 text-sm">{msg}</p>}
      <Btn
        className="mt-3 w-full"
        disabled={pin.length < 4}
        onClick={async () => {
          const out = await post("/api/badminton/me", {
            action: "reset-pin",
            playerId: who.id,
            pin,
          });
          setMsg(out.ok ? "Done." : (out.error ?? "Couldn't."));
        }}
      >
        Set PIN
      </Btn>
    </Sheet>
  );
}

function Rules({
  view,
  clubAct,
}: {
  view: LiveView;
  clubAct: (cmd: object) => Promise<boolean>;
}) {
  const r = view.organizer!.rules;
  const [cap, setCap] = useState(String(r.capacity));
  const [long, setLong] = useState(String(r.longGameMinutes));
  return (
    <Card>
      <h2 className="mb-2 font-bold">Rules</h2>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <label>
          <span className="text-white/70">Players max</span>
          <input
            inputMode="numeric"
            value={cap}
            onChange={(e) => setCap(e.target.value)}
            className="mt-1 w-full rounded-xl bg-white/10 p-2"
          />
        </label>
        <label>
          <span className="text-white/70">Long game (min)</span>
          <input
            inputMode="numeric"
            value={long}
            onChange={(e) => setLong(e.target.value)}
            className="mt-1 w-full rounded-xl bg-white/10 p-2"
          />
        </label>
      </div>
      <Btn
        kind="ghost"
        className="mt-3"
        onClick={() =>
          clubAct({
            type: "rules",
            patch: {
              capacity: Number(cap),
              longGameMinutes: Number(long),
            },
          })
        }
      >
        Save rules
      </Btn>
    </Card>
  );
}
