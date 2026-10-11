import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

/**
 * **Who is a participant, without asking anyone to make an account.**
 *
 * 160 colleagues, one conference, two weeks. A Passport account per person
 * would be the right identity for Passport and the wrong first step for this:
 * everyone would have to sign up before they could see a single aeroplane.
 * So the gate is the conference code, and the identity is a random id in an
 * HMAC-signed, httpOnly cookie that the code unlocks.
 *
 * What that buys and costs, stated so nobody mistakes it for more:
 *
 * - The code keeps the board away from the public internet. It does not
 *   prove *which* colleague you are; anyone holding the code is in. That is
 *   why the board never carries a flight number for anyone but yourself.
 * - Your entry is editable and deletable from the browser that made it.
 *   Lose the cookie and the entry is orphaned until the event expiry erases
 *   it — or an organiser removes it. Per-person invite links would fix both;
 *   they are a named follow-up, not built.
 */
export const COOKIE = "sycle_participant";

const sign = (secret: string, body: string) =>
  createHmac("sha256", secret).update(body).digest("base64url");

export function issue(secret: string): { id: string; value: string } {
  const id = randomUUID();
  return { id, value: `${id}.${sign(secret, id)}` };
}

export function verify(
  secret: string,
  value: string | undefined,
): string | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = value.slice(0, dot);
  const given = Buffer.from(value.slice(dot + 1));
  const expected = Buffer.from(sign(secret, id));
  return given.length === expected.length && timingSafeEqual(given, expected)
    ? id
    : null;
}

/** Constant-time, case- and whitespace-forgiving: people type codes from slides. */
export function codeMatches(expected: string, typed: unknown): boolean {
  if (typeof typed !== "string") return false;
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "");
  const a = createHmac("sha256", "code").update(norm(expected)).digest();
  const b = createHmac("sha256", "code").update(norm(typed)).digest();
  return timingSafeEqual(a, b);
}

/**
 * A best-effort brake on guessing the code: ten *wrong* codes per address per
 * fifteen minutes, per server instance. Only failures count — a hotel or
 * office full of colleagues shares one address, and the eleventh person to
 * type the right code must not be locked out (found by trying it). Not a
 * security boundary on its own; it turns a script into a slow script.
 */
const failures = new Map<string, { n: number; since: number }>();
const WINDOW = 15 * 60_000;

export function blocked(address: string, now = Date.now()): boolean {
  const w = failures.get(address);
  return !!w && now - w.since <= WINDOW && w.n >= 10;
}

export function recordFailure(address: string, now = Date.now()): void {
  const w = failures.get(address);
  if (!w || now - w.since > WINDOW) failures.set(address, { n: 1, since: now });
  else w.n += 1;
}
