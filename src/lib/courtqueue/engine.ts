import { screenText } from "./chat";
import { instantOn, localDate, localClock, weekdayLabel } from "./clock";
import {
  propose,
  rebalance,
  replacement,
  slotsMayUse,
  tonight,
  typicalGameMinutes,
} from "./fair";
import {
  MINUTE,
  SKILL_NAMES,
  filled,
  isActiveGame,
  isBeginnerRated,
  isHeldChallenge,
  isSkill,
  type Challenge,
  type Club,
  type Court,
  type Game,
  type Session,
  type Skill,
  type Slots,
} from "./model";
import {
  cancellationOf,
  isDate,
  isScheduled,
  registrationState,
  registrationWords,
  sessionWindow,
  WIND_DOWN_MS,
} from "./schedule";

/**
 * **Every change to a night, as a pure function.** `(club, session, who,
 * what, server time) → new session | a reason it can't happen`.
 *
 * Works on a copy; the store writes the copy only if nobody else wrote first
 * (`store.ts`), so two phones tapping at once are applied one after the
 * other, each against the other's result. After every change `tick` fills any
 * free court from the queue, and `sound` checks the invariants — one game per
 * court, one place per player — and refuses to save a night that breaks them.
 */

export type Outcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

export interface Actor {
  readonly id: string;
  readonly organizer: boolean;
}

type Score = [number, number];

export type SessionCommand =
  | { type: "register"; playerId?: string }
  | { type: "cancel"; playerId?: string }
  | { type: "check-in"; playerId?: string }
  | { type: "leave"; playerId?: string }
  | { type: "play"; playerId?: string }
  | { type: "pause"; playerId?: string }
  | { type: "auto-requeue"; on: boolean }
  | { type: "accept"; gameId: string }
  | { type: "decline"; gameId: string; pause?: boolean }
  | { type: "start"; gameId: string }
  | {
      type: "finish";
      gameId: string;
      startedMinutesAgo?: number;
      finishedMinutesAgo?: number;
      score?: Score;
    }
  | { type: "score"; gameId: string; score: Score }
  | { type: "confirm"; gameId: string }
  | { type: "dispute"; gameId: string }
  | { type: "kudos"; gameId: string; to: string }
  | {
      type: "challenge";
      slots: [string, string, string, string];
      note?: string;
      rematch?: boolean;
    }
  | { type: "challenge-accept"; challengeId: string }
  | { type: "challenge-decline"; challengeId: string }
  // The organizer's.
  | { type: "registration"; open: boolean }
  | { type: "go-live" }
  | { type: "no-show"; playerId: string }
  | { type: "promote"; playerId: string }
  | {
      type: "correct";
      gameId: string;
      startedAt?: string;
      finishedAt?: string;
      score?: Score | null;
      reason: string;
    }
  | { type: "cancel-game"; gameId: string; reason?: string }
  | { type: "assign"; court: number; slots: [string, string, string, string] }
  | { type: "court-closed"; court: number; closed: boolean }
  | { type: "award"; playerId: string; reason: string }
  | { type: "end" };

const ORGANIZER_ONLY = new Set<SessionCommand["type"]>([
  "registration",
  "go-live",
  "no-show",
  "promote",
  "correct",
  "cancel-game",
  "assign",
  "court-closed",
  "award",
  "end",
]);

const fail = (error: string): Outcome<never> => ({ ok: false, error });

class Refused extends Error {}
function refuse(why: string): never {
  throw new Refused(why);
}

/** Only real players: never `__proto__` or anything else an object inherits. */
const known = (club: Club, id: unknown): id is string =>
  typeof id === "string" && Object.hasOwn(club.players, id);

export function applySession(
  club: Club,
  session: Session,
  actor: Actor,
  cmd: SessionCommand,
  now: number,
): Outcome<Session> {
  if (ORGANIZER_ONLY.has(cmd.type) && !actor.organizer)
    return fail("Only the organizer can do that.");
  if (
    session.status === "ended" &&
    cmd.type !== "correct" &&
    cmd.type !== "award" &&
    cmd.type !== "score" &&
    cmd.type !== "confirm" &&
    cmd.type !== "dispute" &&
    cmd.type !== "kudos"
  )
    return fail("This session has ended.");
  const s = structuredClone(session);
  try {
    run(club, s, actor, cmd, now);
    tick(club, s, now);
    const broken = unsound(club, s);
    if (broken) return fail(`That would break the night (${broken}).`);
    return { ok: true, value: s };
  } catch (e) {
    if (e instanceof Refused) return fail(e.message);
    throw e;
  }
}

/** For a read: has time alone made a court fillable? */
export function tickOnly(club: Club, session: Session, now: number) {
  const s = structuredClone(session);
  const changed = tick(club, s, now);
  if (!changed || unsound(club, s)) return null;
  return s;
}

// ---------------------------------------------------------------------------

const nextId = (s: Session, prefix: string) => `${prefix}${++s.seq}`;

function subject(actor: Actor, given: string | undefined): string {
  if (given !== undefined && given !== actor.id) {
    if (!actor.organizer) refuse("You can only do that for yourself.");
    return given;
  }
  return actor.id;
}

const activeGameOf = (s: Session, id: string) =>
  s.games.find((g) => isActiveGame(g) && g.slots.includes(id));

/**
 * A **ready** challenge is a reservation: its four have left the queue and
 * are waiting for a court together. Accepting a challenge that is still
 * waiting for the others holds nothing — you keep your place in line and
 * may play fair games meanwhile.
 */
const heldChallengeOf = (s: Session, id: string) =>
  s.challenges.find((c) => c.status === "ready" && c.slots.includes(id));

/** The open challenge this player has said yes to, if any. */
const acceptedChallengeOf = (s: Session, id: string) =>
  s.challenges.find((c) => isHeldChallenge(c) && c.accepted[id] !== undefined);

const queued = (s: Session, id: string) =>
  s.queue.find((q) => q.playerId === id);

const isHere = (s: Session, id: string) =>
  !!s.present[id] && s.present[id]!.leftAt === undefined;

function unqueue(s: Session, id: string): number | undefined {
  const q = queued(s, id);
  s.queue = s.queue.filter((x) => x.playerId !== id);
  return q?.since;
}

function requeue(s: Session, id: string, since: number) {
  if (!isHere(s, id) || queued(s, id)) return;
  if (activeGameOf(s, id) || heldChallengeOf(s, id)) return;
  s.queue.push({ playerId: id, since });
}

const confirmedCount = (s: Session) =>
  s.roster.filter((r) => r.status === "confirmed").length;

function promoteNext(club: Club, s: Session, now: number) {
  while (confirmedCount(s) < club.rules.capacity) {
    const next = s.roster
      .filter((r) => r.status === "waitlist")
      .sort((a, b) => a.at - b.at)[0];
    if (!next) return;
    next.status = "confirmed";
    next.promotedAt = now;
  }
}

function gameById(s: Session, id: string): Game {
  return s.games.find((g) => g.id === id) ?? refuse("That game isn't here.");
}

function courtById(club: Club, id: number): Court {
  return club.courts.find((c) => c.id === id) ?? refuse("No such court.");
}

function mustBeIn(actor: Actor, g: Game) {
  if (!actor.organizer && !g.slots.includes(actor.id))
    refuse("Only the four players can do that.");
}

function validScore(score: unknown): Score {
  if (
    !Array.isArray(score) ||
    score.length !== 2 ||
    !score.every((n) => Number.isInteger(n) && n >= 0 && n <= 99)
  )
    refuse("A score is two whole numbers, like 21–17.");
  const [a, b] = score as Score;
  if (a === b) refuse("Badminton doesn't end in a tie — check the score.");
  return [a, b];
}

function audit(
  s: Session,
  actor: Actor,
  now: number,
  what: string,
  extra: { gameId?: string; playerId?: string } = {},
) {
  s.audit.push({ at: now, by: actor.id, what, ...extra });
  if (s.audit.length > 400) s.audit.splice(0, s.audit.length - 400);
}

/**
 * The court is free the moment a game finishes. Its four are **not** put
 * back in line: each taps BACK IN THE QUEUE when they're ready, so someone
 * who wants water or a break is never called while they're away.
 */
function completeGame(s: Session, g: Game) {
  g.status = "finished";
  if (g.challengeId) {
    const ch = s.challenges.find((c) => c.id === g.challengeId);
    if (ch) ch.status = "done";
  }
}

/** Put everyone in an abandoned call back where they were in line. */
function releaseCall(s: Session, g: Game) {
  for (const id of filled(g.slots))
    requeue(s, id, g.waitedSince[id] ?? g.calledAt);
}

function dropChallenge(
  s: Session,
  ch: Challenge,
  status: "declined" | "cancelled",
  by?: string,
) {
  const held = ch.status === "ready";
  ch.status = status;
  if (by) ch.declinedBy = by;
  if (held)
    for (const id of ch.slots)
      requeue(s, id, ch.restore[id] ?? ch.readyAt ?? ch.createdAt);
}

function run(
  club: Club,
  s: Session,
  actor: Actor,
  cmd: SessionCommand,
  now: number,
) {
  switch (cmd.type) {
    case "register": {
      const id = subject(actor, cmd.playerId);
      if (!known(club, id)) refuse("Register your profile first.");
      const mine = s.roster.find((r) => r.playerId === id);
      if (mine && (mine.status === "confirmed" || mine.status === "waitlist"))
        return;
      // Same-day sign-up, from 8:00 am, never on a cancelled night — for
      // everyone, the organizer included: nobody holds a spot in advance.
      if (registrationState(s.date, now, club.cancelled) !== "open")
        refuse(registrationWords(s.date, now, club.cancelled));
      if (!s.registrationOpen && !actor.organizer)
        refuse("Registration is closed for this session.");
      const status =
        confirmedCount(s) < club.rules.capacity ? "confirmed" : "waitlist";
      s.roster = s.roster.filter((r) => r.playerId !== id);
      s.roster.push({ playerId: id, at: now, status });
      return;
    }
    case "cancel": {
      const id = subject(actor, cmd.playerId);
      const mine = s.roster.find((r) => r.playerId === id);
      if (!mine || mine.status === "cancelled") return;
      if (activeGameOf(s, id)?.status === "playing")
        refuse("Finish your game first.");
      leave(s, id, now);
      mine.status = "cancelled";
      promoteNext(club, s, now);
      return;
    }
    case "check-in": {
      const id = subject(actor, cmd.playerId);
      if (!known(club, id)) refuse("Register your profile first.");
      if (cancellationOf(s.date, club.cancelled))
        refuse(registrationWords(s.date, now, club.cancelled));
      if (s.status !== "live") {
        if (s.date !== localDate(now) && !actor.organizer)
          refuse("Check-in opens on the day.");
        s.status = "live";
      }
      let mine = s.roster.find((r) => r.playerId === id);
      if (!mine || mine.status === "cancelled") {
        if (registrationState(s.date, now, club.cancelled) !== "open")
          refuse(registrationWords(s.date, now, club.cancelled));
        if (confirmedCount(s) >= club.rules.capacity)
          refuse(
            `Tonight is full (${club.rules.capacity}). Join the waitlist instead.`,
          );
        if (!s.registrationOpen && !actor.organizer)
          refuse("Registration is closed — ask the organizer.");
        s.roster = s.roster.filter((r) => r.playerId !== id);
        mine = { playerId: id, at: now, status: "confirmed" };
        s.roster.push(mine);
      }
      if (mine.status === "waitlist")
        refuse("You're on the waitlist — you'll move up if someone cancels.");
      if (mine.status === "no-show") mine.status = "confirmed";
      const was = s.present[id];
      s.present[id] = {
        at: was?.at ?? now,
        autoRequeue: was?.autoRequeue ?? true,
      };
      return;
    }
    case "leave": {
      const id = subject(actor, cmd.playerId);
      if (activeGameOf(s, id)?.status === "playing")
        refuse("Finish your game first.");
      leave(s, id, now);
      return;
    }
    case "play": {
      const id = subject(actor, cmd.playerId);
      if (!isHere(s, id)) refuse("Check in first.");
      if (activeGameOf(s, id)) refuse("You're already on a court.");
      if (heldChallengeOf(s, id))
        refuse("You're in a challenge — it's waiting for a court.");
      if (queued(s, id)) return;
      s.queue.push({ playerId: id, since: now });
      return;
    }
    case "pause": {
      const id = subject(actor, cmd.playerId);
      unqueue(s, id);
      return;
    }
    case "auto-requeue": {
      const p = s.present[actor.id] ?? refuse("Check in first.");
      p.autoRequeue = !!cmd.on;
      return;
    }
    case "accept": {
      const g = gameById(s, cmd.gameId);
      if (g.status !== "called") return;
      if (!g.slots.includes(actor.id)) refuse("That game isn't yours.");
      g.accepted[actor.id] = now;
      return;
    }
    case "decline": {
      const g = gameById(s, cmd.gameId);
      if (g.status !== "called") refuse("That game has already started.");
      if (!g.slots.includes(actor.id)) refuse("That game isn't yours.");
      if (g.source === "challenge") {
        g.status = "cancelled";
        const ch = s.challenges.find((c) => c.id === g.challengeId);
        if (ch) {
          ch.status = "declined";
          ch.declinedBy = actor.id;
        }
        for (const id of filled(g.slots))
          if (id !== actor.id || !cmd.pause)
            requeue(s, id, g.waitedSince[id] ?? now);
        return;
      }
      g.slots = g.slots.map((p) => (p === actor.id ? null : p)) as Slots;
      delete g.accepted[actor.id];
      g.declined.push(actor.id);
      if (!cmd.pause) requeue(s, actor.id, g.waitedSince[actor.id] ?? now);
      if (filled(g.slots).length === 0) g.status = "cancelled";
      return;
    }
    case "start": {
      const g = gameById(s, cmd.gameId);
      mustBeIn(actor, g);
      if (g.status === "playing") return;
      if (g.status !== "called") refuse("That game is over.");
      if (filled(g.slots).length < 4) refuse("Waiting for a fourth player.");
      g.status = "playing";
      g.startedAt = now;
      g.startedBy = actor.id;
      g.accepted[actor.id] ??= now;
      return;
    }
    case "finish": {
      const g = gameById(s, cmd.gameId);
      mustBeIn(actor, g);
      if (g.status === "finished") {
        if (cmd.score) setScore(g, actor, validScore(cmd.score));
        return;
      }
      if (!isActiveGame(g)) refuse("That game was cancelled.");
      if (filled(g.slots).length < 4) refuse("That game never had four.");
      const endAgo = clampMinutes(cmd.finishedMinutesAgo, 90);
      let end = now - endAgo * MINUTE;
      if (g.status === "called") {
        // Nobody tapped Start. Take their word for when they did.
        const ago = clampMinutes(
          cmd.startedMinutesAgo ?? typicalGameMinutes(s),
          120,
        );
        g.startedAt = Math.max(g.calledAt, now - ago * MINUTE);
        g.startEstimated = true;
        g.startedBy = actor.id;
        audit(
          s,
          actor,
          now,
          `Start forgotten — set to ${localClock(g.startedAt)}`,
          {
            gameId: g.id,
          },
        );
      }
      end = Math.max(end, g.startedAt! + MINUTE);
      end = Math.min(end, now);
      g.finishedAt = end;
      g.finishedBy = actor.id;
      if (endAgo > 0) {
        g.endEstimated = true;
        audit(s, actor, now, `Finish was late — set to ${localClock(end)}`, {
          gameId: g.id,
        });
      }
      if (cmd.score) setScore(g, actor, validScore(cmd.score));
      completeGame(s, g);
      return;
    }
    case "score": {
      const g = gameById(s, cmd.gameId);
      mustBeIn(actor, g);
      if (g.status !== "finished") refuse("Finish the game first.");
      setScore(g, actor, validScore(cmd.score));
      if (actor.organizer && !g.slots.includes(actor.id))
        audit(s, actor, now, `Score set to ${g.score!.join("–")}`, {
          gameId: g.id,
        });
      return;
    }
    case "confirm": {
      const g = gameById(s, cmd.gameId);
      if (!g.slots.includes(actor.id)) refuse("Only the four can confirm.");
      if (!g.score) refuse("There's no score to confirm yet.");
      if (g.scoreBy === actor.id)
        refuse("Someone else needs to confirm your score.");
      g.confirmedBy = actor.id;
      delete g.disputedBy;
      return;
    }
    case "dispute": {
      const g = gameById(s, cmd.gameId);
      if (!g.slots.includes(actor.id)) refuse("Only the four can question it.");
      if (!g.score) refuse("There's no score yet.");
      g.disputedBy = actor.id;
      delete g.confirmedBy;
      return;
    }
    case "kudos": {
      const g = gameById(s, cmd.gameId);
      if (g.status !== "finished") refuse("After the game.");
      if (!g.slots.includes(actor.id) || !g.slots.includes(cmd.to))
        refuse("Only between the four players.");
      if (cmd.to === actor.id) refuse("Nice try.");
      if (g.kudos.some((k) => k.from === actor.id)) return;
      g.kudos.push({ from: actor.id, to: cmd.to });
      return;
    }
    case "challenge": {
      // A challenge is a request, made any time before the night is over —
      // it reserves nobody's attendance and nobody's place in line. It only
      // goes ahead on the day, once all four have said yes, signed up, and
      // joined the queue (`readiness`).
      const ids = cmd.slots;
      if (!Array.isArray(ids) || ids.length !== 4 || new Set(ids).size !== 4)
        refuse("A challenge needs four different players.");
      if (!actor.organizer && !ids.includes(actor.id))
        refuse("You need to be in your own challenge.");
      for (const id of ids)
        if (!known(club, id))
          refuse("Someone in that challenge isn't registered.");
      const state = registrationState(s.date, now, club.cancelled);
      if (state === "cancelled" || state === "over" || state === "off-season")
        refuse(registrationWords(s.date, now, club.cancelled));
      let note: string | undefined;
      if (cmd.note !== undefined && String(cmd.note).trim() !== "") {
        const checked = screenText(cmd.note, 80);
        if (!checked.ok) refuse(checked.error);
        note = checked.value;
      }
      const by = actor.id;
      if (activeGameOf(s, by)) refuse("Finish your game first.");
      if (acceptedChallengeOf(s, by))
        refuse("You already have a challenge going.");
      if (s.challenges.filter(isHeldChallenge).length >= 40)
        refuse("There are plenty of challenges out already.");
      const skillOf = (id: string) => club.players[id]!.skill;
      const anywhere = club.courts.some(
        (c) => !s.closedCourts.includes(c.id) && slotsMayUse(c, ids, skillOf),
      );
      if (!anywhere) refuse("No open court allows that matchup.");
      const ch: Challenge = {
        id: nextId(s, "c"),
        by,
        slots: [ids[0], ids[1], ids[2], ids[3]],
        createdAt: now,
        accepted: {},
        status: "pending",
        restore: {},
        ...(note ? { note } : {}),
        ...(cmd.rematch ? { rematch: true } : {}),
      };
      if (ids.includes(by)) acceptChallenge(s, ch, by, now);
      s.challenges.push(ch);
      return;
    }
    case "challenge-accept": {
      const ch =
        s.challenges.find((c) => c.id === cmd.challengeId) ??
        refuse("That challenge isn't here.");
      if (ch.status !== "pending") return;
      if (!ch.slots.includes(actor.id)) refuse("You weren't invited.");
      if (ch.accepted[actor.id] !== undefined) return;
      if (acceptedChallengeOf(s, actor.id))
        refuse("You're already in another challenge.");
      acceptChallenge(s, ch, actor.id, now);
      return;
    }
    case "challenge-decline": {
      const ch =
        s.challenges.find((c) => c.id === cmd.challengeId) ??
        refuse("That challenge isn't here.");
      if (!isHeldChallenge(ch)) return;
      if (!ch.slots.includes(actor.id) && !actor.organizer)
        refuse("You weren't invited.");
      dropChallenge(
        s,
        ch,
        actor.id === ch.by ? "cancelled" : "declined",
        actor.id,
      );
      return;
    }
    case "registration": {
      s.registrationOpen = !!cmd.open;
      audit(
        s,
        actor,
        now,
        cmd.open ? "Registration opened" : "Registration closed",
      );
      return;
    }
    case "go-live": {
      if (s.status === "upcoming") s.status = "live";
      audit(s, actor, now, "Session opened for check-in");
      return;
    }
    case "no-show": {
      const r =
        s.roster.find((x) => x.playerId === cmd.playerId) ??
        refuse("Not on the roster.");
      if (activeGameOf(s, cmd.playerId)?.status === "playing")
        refuse("They're on a court right now.");
      leave(s, cmd.playerId, now);
      r.status = "no-show";
      promoteNext(club, s, now);
      audit(s, actor, now, "Marked no-show", { playerId: cmd.playerId });
      return;
    }
    case "promote": {
      const r =
        s.roster.find((x) => x.playerId === cmd.playerId) ??
        refuse("Not on the roster.");
      if (r.status !== "waitlist") return;
      if (confirmedCount(s) >= club.rules.capacity)
        refuse(
          `Already ${club.rules.capacity} confirmed. Someone has to drop first.`,
        );
      r.status = "confirmed";
      r.promotedAt = now;
      audit(s, actor, now, "Promoted from the waitlist", {
        playerId: cmd.playerId,
      });
      return;
    }
    case "correct": {
      const g = gameById(s, cmd.gameId);
      const reason = String(cmd.reason ?? "")
        .slice(0, 140)
        .trim();
      if (!reason) refuse("Say why, for the record.");
      const start = cmd.startedAt
        ? instantOn(s.date, cmd.startedAt)
        : undefined;
      const end = cmd.finishedAt
        ? instantOn(s.date, cmd.finishedAt)
        : undefined;
      if (start === null || end === null)
        refuse("Times look like 7:42 or 19:42.");
      const newStart = start ?? g.startedAt;
      const newEnd = end ?? g.finishedAt;
      if (newStart && newEnd && newEnd <= newStart)
        refuse("The finish has to be after the start.");
      if (newStart && newStart > now + MINUTE)
        refuse("That start is in the future.");
      if (newEnd && newEnd > now + MINUTE)
        refuse("That finish is in the future.");
      const changes: string[] = [];
      if (start !== undefined) {
        changes.push(
          `start ${g.startedAt ? localClock(g.startedAt) : "—"} → ${localClock(start)}`,
        );
        g.startedAt = start;
        g.startEstimated = false;
        if (g.status === "called" && filled(g.slots).length === 4)
          g.status = "playing";
      }
      if (end !== undefined) {
        if (!g.startedAt) refuse("Set the start too.");
        if (g.status === "called" || g.status === "cancelled")
          refuse("Start the game before finishing it.");
        changes.push(
          `finish ${g.finishedAt ? localClock(g.finishedAt) : "—"} → ${localClock(end)}`,
        );
        g.finishedAt = end;
        g.endEstimated = false;
        g.finishedBy ??= actor.id;
        if (g.status === "playing") completeGame(s, g);
      }
      if (cmd.score !== undefined) {
        if (cmd.score === null) {
          delete g.score;
          delete g.winner;
          changes.push("score cleared");
        } else {
          const score = validScore(cmd.score);
          changes.push(
            `score ${g.score?.join("–") ?? "—"} → ${score.join("–")}`,
          );
          setScore(g, actor, score);
          g.confirmedBy = actor.id;
        }
        delete g.disputedBy;
      }
      if (changes.length === 0) refuse("Nothing to change.");
      audit(s, actor, now, `Corrected ${changes.join(", ")} — ${reason}`, {
        gameId: g.id,
      });
      return;
    }
    case "cancel-game": {
      const g = gameById(s, cmd.gameId);
      if (g.status === "cancelled") return;
      const was = g.status;
      g.status = "cancelled";
      if (was === "called" || was === "playing") {
        if (g.challengeId) {
          const ch = s.challenges.find((c) => c.id === g.challengeId);
          if (ch) ch.status = "cancelled";
        }
        releaseCall(s, g);
      }
      audit(
        s,
        actor,
        now,
        `Game on court ${g.court} cancelled${cmd.reason ? ` — ${String(cmd.reason).slice(0, 140)}` : ""}`,
        { gameId: g.id },
      );
      return;
    }
    case "assign": {
      const court = courtById(club, cmd.court);
      if (s.closedCourts.includes(court.id)) refuse("That court is closed.");
      if (s.games.some((g) => g.court === court.id && isActiveGame(g)))
        refuse("That court already has a game.");
      const ids = cmd.slots;
      if (!Array.isArray(ids) || ids.length !== 4 || new Set(ids).size !== 4)
        refuse("Pick four different players.");
      for (const id of ids) {
        const p = known(club, id)
          ? club.players[id]!
          : refuse("Unknown player.");
        if (!isHere(s, id)) refuse(`${p.name} isn't checked in.`);
        if (activeGameOf(s, id)) refuse(`${p.name} is already on a court.`);
        if (heldChallengeOf(s, id))
          refuse(`${p.name} is in a challenge — cancel it first.`);
        if (court.kind === "expert" && isBeginnerRated(p.skill))
          refuse(
            `${p.name} is ${SKILL_NAMES[p.skill]} — never on the expert court.`,
          );
      }
      const waitedSince: Record<string, number> = {};
      for (const id of ids) waitedSince[id] = unqueue(s, id) ?? now;
      s.games.push({
        id: nextId(s, "g"),
        court: court.id,
        slots: [ids[0], ids[1], ids[2], ids[3]],
        source: "organizer",
        why: ["Organizer's pick"],
        status: "called",
        calledAt: now,
        accepted: {},
        declined: [],
        waitedSince,
        kudos: [],
      });
      audit(s, actor, now, `Assigned a game to court ${court.id}`);
      return;
    }
    case "court-closed": {
      const court = courtById(club, cmd.court);
      if (cmd.closed) {
        if (s.games.some((g) => g.court === court.id && isActiveGame(g)))
          refuse("Finish or cancel the game on that court first.");
        if (!s.closedCourts.includes(court.id)) s.closedCourts.push(court.id);
      } else s.closedCourts = s.closedCourts.filter((c) => c !== court.id);
      audit(
        s,
        actor,
        now,
        `${court.name} ${cmd.closed ? "closed" : "reopened"}`,
      );
      return;
    }
    case "award": {
      if (!known(club, cmd.playerId)) refuse("Unknown player.");
      const reason =
        String(cmd.reason ?? "")
          .slice(0, 80)
          .trim() || "Good sport";
      s.awards.push({ at: now, by: actor.id, to: cmd.playerId, reason });
      return;
    }
    case "end": {
      for (const g of s.games) {
        if (g.status === "playing") {
          g.finishedAt = now;
          g.finishedBy = actor.id;
          g.endEstimated = true;
          g.status = "finished";
        } else if (g.status === "called") g.status = "cancelled";
      }
      for (const c of s.challenges)
        if (isHeldChallenge(c) || c.status === "on-court")
          c.status = "cancelled";
      s.queue = [];
      for (const p of Object.values(s.present)) p.leftAt ??= now;
      s.status = "ended";
      s.endedAt = now;
      audit(s, actor, now, "Session ended");
      return;
    }
    default:
      refuse("Unknown action.");
  }
}

function clampMinutes(n: unknown, max: number): number {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v) || v < 0) return 0;
  return Math.min(max, Math.round(v));
}

function setScore(g: Game, actor: Actor, score: Score) {
  g.score = score;
  g.winner = score[0] > score[1] ? 0 : 1;
  g.scoreBy = actor.id;
  delete g.confirmedBy;
  delete g.disputedBy;
}

function acceptChallenge(s: Session, ch: Challenge, id: string, now: number) {
  ch.accepted[id] = now;
  readyIfFree(s, ch, now);
}

export type ReadinessStep = "answer" | "sign-up" | "check-in" | "queue";

/**
 * **What each of a challenge's four still has to do** before it can go: say
 * yes, be signed up for the night (confirmed — a waitlist place doesn't
 * count), be checked in, and be in the playing queue. Empty means the
 * challenge is ready. The same list the phone shows, so "waiting for Sam to
 * join the queue" is never a guess.
 */
export function readiness(
  s: Session,
  ch: Challenge,
): { playerId: string; step: ReadinessStep }[] {
  const out: { playerId: string; step: ReadinessStep }[] = [];
  for (const p of ch.slots) {
    if (ch.accepted[p] === undefined) out.push({ playerId: p, step: "answer" });
    else if (
      !s.roster.some((r) => r.playerId === p && r.status === "confirmed")
    )
      out.push({ playerId: p, step: "sign-up" });
    else if (!isHere(s, p)) out.push({ playerId: p, step: "check-in" });
    else if (!queued(s, p)) out.push({ playerId: p, step: "queue" });
  }
  return out;
}

/**
 * All four are in: said yes, signed up, here and in the queue. The challenge
 * is on. They leave the line together, keeping the places they had, and it
 * goes to a court only when the fairness engine allows it
 * (`challengeMayGo`) — joining the queue is the price of a challenge, not a
 * way round it.
 */
function readyIfFree(s: Session, ch: Challenge, now: number): boolean {
  if (ch.status !== "pending") return false;
  if (readiness(s, ch).length) return false;
  for (const p of ch.slots) {
    const since = unqueue(s, p);
    ch.restore[p] = since ?? now;
  }
  ch.status = "ready";
  ch.readyAt = now;
  return true;
}

function leave(s: Session, id: string, now: number) {
  const p = s.present[id];
  if (p) p.leftAt = now;
  unqueue(s, id);
  for (const ch of s.challenges)
    if (isHeldChallenge(ch) && ch.slots.includes(id))
      dropChallenge(s, ch, "declined", id);
  const g = activeGameOf(s, id);
  if (g && g.status === "called") {
    if (g.source === "challenge") {
      g.status = "cancelled";
      const ch = s.challenges.find((c) => c.id === g.challengeId);
      if (ch) ch.status = "declined";
      for (const other of filled(g.slots))
        if (other !== id) requeue(s, other, g.waitedSince[other] ?? now);
    } else {
      g.slots = g.slots.map((p) => (p === id ? null : p)) as Slots;
      delete g.accepted[id];
      g.declined.push(id);
      if (filled(g.slots).length === 0) g.status = "cancelled";
    }
  }
}

// ---------------------------------------------------------------------------

/** Courts in the order they are filled: the most particular first. */
const FILL_ORDER = { expert: 0, beginner: 1, intermediate: 2 } as const;

/**
 * Fill what can be filled: a called game that lost a player, then each free
 * court — with a ready challenge when fairness allows it, otherwise with the
 * fairness engine's four. Returns whether anything changed.
 */
export function tick(club: Club, s: Session, now: number): boolean {
  if (s.status !== "live") return false;
  let changed = false;
  for (let guard = 0; guard < 12; guard++) {
    if (!step(club, s, now)) break;
    changed = true;
  }
  return changed;
}

function step(club: Club, s: Session, now: number): boolean {
  const skillOf = (id: string) => club.players[id]?.skill ?? 3;
  for (const ch of s.challenges) if (readyIfFree(s, ch, now)) return true;
  // A called game a player dropped out of.
  for (const g of s.games) {
    if (g.status !== "called" || filled(g.slots).length === 4) continue;
    const court = club.courts.find((c) => c.id === g.court);
    if (!court) continue;
    const id = replacement(club, s, court, g);
    if (!id) continue;
    const at = g.slots.indexOf(null);
    g.waitedSince[id] = unqueue(s, id) ?? now;
    g.slots[at] = id;
    if (filled(g.slots).length === 4)
      g.slots = rebalance(club, s, court, g.slots);
    g.why = [
      ...g.why.filter((w) => !w.startsWith("Filled in")),
      `Filled in by ${club.players[id]!.name}`,
    ];
    return true;
  }
  const free = club.courts
    .filter(
      (c) =>
        !s.closedCourts.includes(c.id) &&
        !s.games.some((g) => g.court === c.id && isActiveGame(g)),
    )
    .sort((a, b) => FILL_ORDER[a.kind] - FILL_ORDER[b.kind]);
  for (const court of free) {
    const proposal = propose(club, s, court, now);
    const ready = s.challenges
      .filter(
        (c) =>
          c.status === "ready" &&
          !c.slots.some((p) => activeGameOf(s, p)) &&
          slotsMayUse(court, c.slots, skillOf),
      )
      .sort((a, b) => (a.readyAt ?? 0) - (b.readyAt ?? 0));
    const ch = ready.find((c) => challengeMayGo(club, s, c, court, proposal));
    if (ch) {
      ch.status = "on-court";
      const id = nextId(s, "g");
      ch.gameId = id;
      const waitedSince: Record<string, number> = {};
      for (const p of ch.slots)
        waitedSince[p] = ch.restore[p] ?? ch.readyAt ?? now;
      s.games.push({
        id,
        court: court.id,
        slots: [...ch.slots],
        source: "challenge",
        challengeId: ch.id,
        why: [`${club.players[ch.by]?.name ?? "A friend"}'s challenge`],
        status: "called",
        calledAt: now,
        accepted: {},
        declined: [],
        waitedSince,
        kudos: [],
      });
      return true;
    }
    if (proposal) {
      const waitedSince: Record<string, number> = {};
      for (const id of filled(proposal.slots))
        waitedSince[id] = unqueue(s, id) ?? now;
      s.games.push({
        id: nextId(s, "g"),
        court: court.id,
        slots: proposal.slots,
        source: "fair",
        why: proposal.why,
        status: "called",
        calledAt: now,
        accepted: {},
        declined: [],
        waitedSince,
        kudos: [],
      });
      return true;
    }
  }
  return false;
}

/**
 * **A challenge is a request, never a way round the queue.** It never jumps
 * someone still waiting for their first game, and it goes only when its
 * players have, on average, played no more than whoever the fairness engine
 * would put on next. (Until 2026-11-10 it also went after waiting
 * `challengePatienceMinutes`; the owner's release brief says requests
 * "cannot bypass the fairness system", so waiting no longer buys a court.)
 */
export function challengeMayGo(
  club: Club,
  s: Session,
  ch: Challenge,
  court: Court,
  proposal: { slots: Slots } | null,
): boolean {
  const t = tonight(s);
  const games = (id: string) => t.get(id)?.games ?? 0;
  const skillOf = (id: string) => club.players[id]?.skill ?? 3;
  const firstTimerWaiting = s.queue.some(
    (q) => games(q.playerId) === 0 && slotsMayUse(court, [q.playerId], skillOf),
  );
  if (firstTimerWaiting) return false;
  if (!proposal) return true;
  const theirs = ch.slots.reduce((n, id) => n + games(id), 0) / 4;
  const next = Math.min(...filled(proposal.slots).map(games));
  return theirs <= next;
}

// ---------------------------------------------------------------------------

/** The invariants. A description of the first one broken, or null. */
export function unsound(club: Club, s: Session): string | null {
  const courts = new Set<number>();
  const busy = new Map<string, string>();
  const claim = (id: string, what: string) => {
    if (busy.has(id)) return `${id} is in ${busy.get(id)} and ${what}`;
    busy.set(id, what);
    return null;
  };
  for (const g of s.games) {
    if (!isActiveGame(g)) continue;
    if (courts.has(g.court)) return `two games on court ${g.court}`;
    courts.add(g.court);
    if (g.status === "playing" && filled(g.slots).length !== 4)
      return `game ${g.id} playing without four`;
    const court = club.courts.find((c) => c.id === g.court);
    if (
      court?.kind === "expert" &&
      filled(g.slots).some((id) =>
        isBeginnerRated(club.players[id]?.skill ?? 3),
      )
    )
      return "a beginner on the expert court";
    for (const id of filled(g.slots)) {
      const broken = claim(id, `game ${g.id}`);
      if (broken) return broken;
    }
  }
  // A ready challenge's four are out of the line (some may be finishing a game).
  const reserved = new Set(
    s.challenges.filter((c) => c.status === "ready").flatMap((c) => c.slots),
  );
  for (const c of s.challenges) {
    if (c.status !== "ready") continue;
    for (const id of c.slots)
      if (
        s.challenges.some(
          (o) => o !== c && o.status === "ready" && o.slots.includes(id),
        )
      )
        return `${id} is in two challenges`;
  }
  for (const q of s.queue)
    if (reserved.has(q.playerId))
      return `${q.playerId} is queued and in a challenge`;
  for (const q of s.queue) {
    const broken = claim(q.playerId, "the queue");
    if (broken) return broken;
  }
  const confirmed = s.roster.filter((r) => r.status === "confirmed").length;
  if (confirmed > club.rules.capacity) return "more than capacity confirmed";
  return null;
}

// ---------------------------------------------------------------------------

export type ClubCommand =
  | {
      type: "profile";
      name?: string;
      statsPublic?: boolean;
      mentor?: boolean;
      photo?: boolean;
    }
  | { type: "skill"; playerId: string; skill: number; reason: string }
  | { type: "organizer"; playerId: string; on: boolean }
  | { type: "court"; court: number; patch: Partial<Court> }
  | { type: "rules"; patch: Partial<Club["rules"]> }
  | { type: "cancel-night"; date: string; cancelled: boolean; reason?: string }
  | { type: "schedule-confirmed" };

export const cleanName = (raw: unknown) =>
  String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);

export const nameKey = (name: string) => cleanName(name).toLowerCase();

export function nameTaken(club: Club, name: string, except?: string) {
  const k = nameKey(name);
  return Object.values(club.players).some(
    (p) => p.id !== except && nameKey(p.name) === k,
  );
}

export function applyClub(
  club: Club,
  actor: Actor,
  cmd: ClubCommand,
  now: number,
): Outcome<Club> {
  const c = structuredClone(club);
  try {
    runClub(c, actor, cmd, now);
    return { ok: true, value: c };
  } catch (e) {
    if (e instanceof Refused) return fail(e.message);
    throw e;
  }
}

function runClub(c: Club, actor: Actor, cmd: ClubCommand, now: number) {
  const me = c.players[actor.id];
  switch (cmd.type) {
    case "profile": {
      if (!me) refuse("Sign in first.");
      if (cmd.name !== undefined) {
        const name = cleanName(cmd.name);
        if (name.length < 2) refuse("A name needs at least two letters.");
        if (nameTaken(c, name, me!.id))
          refuse("Someone already has that name.");
        me!.name = name;
      }
      if (cmd.statsPublic !== undefined) me!.statsPublic = !!cmd.statsPublic;
      if (cmd.mentor !== undefined) me!.mentor = !!cmd.mentor;
      if (cmd.photo !== undefined) me!.photo = !!cmd.photo;
      return;
    }
    case "skill": {
      if (!actor.organizer)
        refuse("Only the organizer can change skill levels.");
      const p = known(c, cmd.playerId)
        ? c.players[cmd.playerId]!
        : refuse("Unknown player.");
      if (!isSkill(cmd.skill)) refuse("Skill is 1 to 5.");
      const to = cmd.skill as Skill;
      if (to === p.skill) return;
      p.skillHistory.push({
        at: now,
        from: p.skill,
        to,
        by: actor.id,
        reason:
          String(cmd.reason ?? "")
            .slice(0, 140)
            .trim() || "Organizer",
      });
      p.skill = to;
      return;
    }
    case "organizer": {
      if (!actor.organizer) refuse("Only an organizer can do that.");
      const p = known(c, cmd.playerId)
        ? c.players[cmd.playerId]!
        : refuse("Unknown player.");
      if (!cmd.on && p.id === actor.id)
        refuse("Ask another organizer to remove you.");
      p.organizer = !!cmd.on;
      return;
    }
    case "court": {
      if (!actor.organizer) refuse("Only the organizer can change courts.");
      const court =
        c.courts.find((x) => x.id === cmd.court) ?? refuse("No such court.");
      const patch = cmd.patch ?? {};
      if (patch.name !== undefined)
        court.name = cleanName(patch.name) || court.name;
      for (const k of ["minSkill", "maxSkill", "idealMin", "idealMax"] as const)
        if (patch[k] !== undefined) {
          if (!isSkill(patch[k])) refuse("Skill is 1 to 5.");
          court[k] = patch[k] as Skill;
        }
      if (patch.stretchPartnerMin !== undefined) {
        if (
          patch.stretchPartnerMin !== null &&
          !isSkill(patch.stretchPartnerMin)
        )
          refuse("Skill is 1 to 5.");
        court.stretchPartnerMin = patch.stretchPartnerMin;
      }
      if (court.minSkill > court.maxSkill) refuse("Minimum is above maximum.");
      // Beginners are never on the expert court; the rules can't be bent to it.
      if (
        court.kind === "expert" &&
        court.minSkill < 4 &&
        court.stretchPartnerMin !== null
      )
        court.stretchPartnerMin = null;
      if (court.kind === "expert" && court.minSkill < 3) court.minSkill = 3;
      return;
    }
    case "rules": {
      if (!actor.organizer) refuse("Only the organizer can change the rules.");
      const p = cmd.patch ?? {};
      if (p.capacity !== undefined) {
        const n = Math.round(Number(p.capacity));
        if (!(n >= 4 && n <= 60)) refuse("Capacity is between 4 and 60.");
        c.rules.capacity = n;
      }
      if (p.longGameMinutes !== undefined) {
        const n = Math.round(Number(p.longGameMinutes));
        if (!(n >= 10 && n <= 90)) refuse("Between 10 and 90 minutes.");
        c.rules.longGameMinutes = n;
      }
      if (p.challengePatienceMinutes !== undefined) {
        const n = Math.round(Number(p.challengePatienceMinutes));
        if (!(n >= 0 && n <= 120)) refuse("Between 0 and 120 minutes.");
        c.rules.challengePatienceMinutes = n;
      }
      return;
    }
    case "cancel-night": {
      if (!actor.organizer)
        refuse("Only the organizer can change the schedule.");
      if (!isDate(cmd.date) || !isScheduled(cmd.date))
        refuse("That isn't a club night this season.");
      const reason =
        String(cmd.reason ?? "")
          .slice(0, 80)
          .trim() || "Cancelled";
      const cancelled = { ...(c.cancelled ?? {}) };
      if (cmd.cancelled) {
        if (cancelled[cmd.date]?.reason === reason) return;
        cancelled[cmd.date] = { reason, by: actor.id, at: now };
      } else {
        if (!cancelled[cmd.date]) return;
        delete cancelled[cmd.date];
      }
      c.cancelled = cancelled;
      scheduleNote(
        c,
        actor,
        now,
        cmd.cancelled
          ? `${weekdayLabel(cmd.date)} cancelled — ${reason}`
          : `${weekdayLabel(cmd.date)} back on`,
      );
      return;
    }
    case "schedule-confirmed": {
      if (!actor.organizer)
        refuse("Only the organizer can change the schedule.");
      c.scheduleConfirmed = { by: actor.id, at: now };
      scheduleNote(c, actor, now, "Checked against the official schedule");
      return;
    }
    default:
      refuse("Unknown action.");
  }
}

function scheduleNote(c: Club, actor: Actor, now: number, what: string) {
  const log = [...(c.scheduleLog ?? []), { at: now, by: actor.id, what }];
  c.scheduleLog = log.slice(-200);
}

/** CourtQueue itself, for what happens on time rather than on a tap. */
export const SYSTEM: Actor = { id: "courtqueue", organizer: true };

/**
 * **A night puts itself away.** An hour after the booked end, a night still
 * open is ended by CourtQueue: games on court are finished there and marked
 * estimated, and the queue is cleared, so the next night starts empty. The
 * history stays.
 */
export function windDown(club: Club, s: Session, now: number): Session | null {
  if (s.status === "ended") return null;
  if (now < sessionWindow(s.date).end + WIND_DOWN_MS) return null;
  const out = applySession(club, s, SYSTEM, { type: "end" }, now);
  return out.ok ? out.value : null;
}
