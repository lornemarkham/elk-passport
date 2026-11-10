import {
  applyClub,
  applySession,
  type Actor,
  type SessionCommand,
} from "./engine";
import { emptyClub, emptySession, type Club, type Session } from "./model";

/** Builders for CourtQueue's tests and simulations. Not used by the app. */

export const T0 = Date.UTC(2026, 10, 13, 3, 0); // Thu Nov 12, 7:00 pm in BC (UTC-8 or -7)

export function club(count: number, names?: string[]): Club {
  const c = emptyClub();
  for (let i = 0; i < count; i++) {
    const id = `p${i + 1}`;
    c.players[id] = {
      id,
      name: names?.[i] ?? `Player ${i + 1}`,
      createdAt: 0,
      pinHash: "",
      tokenHashes: [],
      mentor: false,
      organizer: false,
      photo: false,
    };
  }
  c.players.org = {
    id: "org",
    name: "Organizer",
    createdAt: 0,
    pinHash: "",
    tokenHashes: [],
    mentor: false,
    organizer: true,
    photo: false,
  };
  return c;
}

export const ORG: Actor = { id: "org", organizer: true };
export const as = (id: string): Actor => ({ id, organizer: false });

export function night(date = "2026-11-12"): Session {
  return emptySession({ id: date, date, label: "Thursday" });
}

/** Apply or throw — for steps a test expects to succeed. */
export function must(
  c: Club,
  s: Session,
  actor: Actor,
  cmd: SessionCommand,
  now: number,
): Session {
  const out = applySession(c, s, actor, cmd, now);
  if (!out.ok) throw new Error(`${cmd.type} by ${actor.id}: ${out.error}`);
  return out.value;
}

export function refused(
  c: Club,
  s: Session,
  actor: Actor,
  cmd: SessionCommand,
  now: number,
): string {
  const out = applySession(c, s, actor, cmd, now);
  if (out.ok)
    throw new Error(`${cmd.type} by ${actor.id} should have been refused`);
  return out.error;
}

/** Everyone registers, checks in and taps PLAY. */
export function arrive(
  c: Club,
  s: Session,
  ids: string[],
  now: number,
): Session {
  let x = s;
  for (const id of ids) {
    x = must(c, x, as(id), { type: "register" }, now);
    x = must(c, x, as(id), { type: "check-in" }, now);
    x = must(c, x, as(id), { type: "play" }, now);
  }
  return x;
}

export function setMentor(c: Club, id: string): Club {
  const out = applyClub(c, as(id), { type: "profile", mentor: true }, 0);
  if (!out.ok) throw new Error(out.error);
  return out.value;
}
