import { createHash, randomBytes } from "node:crypto";
import {
  apply,
  clean,
  everyoneGone,
  leaving,
  needs,
  newFields,
  parseState,
  viewFor,
  NAME_MAX,
  type Action,
  type Person,
  type PlayView,
  type SessionState,
  type Slot,
} from "@/domain/date-night/connect/session";
import {
  isModeId,
  isStageId,
  MODES,
  type ModeId,
  type StageId,
} from "@/domain/date-night/connect/content";
import type { NightStore } from "./store";

/**
 * **Opening, joining, playing and leaving a night.**
 *
 * The seam between a request and the game: who is this (a token in a cookie,
 * kept only as a hash), what may they do, and what may they see. The pages and
 * API routes call this and nothing else.
 *
 * ## The link is the invitation, and a look is not a join
 *
 * A night's code is 80 random bits, so it cannot be found by trying. Whoever
 * holds the link may take the one open seat, by pressing Join. Merely
 * *opening* the link (a chat app fetching a preview, a curious second
 * look) takes nothing and says only the mode and the host's first name.
 */

const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
export const CODE_RE = /^[0-9abcdefghjkmnpqrstvwxyz]{16}$/;
export const isCode = (s: unknown): s is string =>
  typeof s === "string" && CODE_RE.test(s);

/** 16 characters of base 32: 80 bits. */
export function newCode(): string {
  const bytes = randomBytes(10);
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return out;
}

export const newToken = (): string => randomBytes(24).toString("base64url");
export const hashToken = (t: string): string =>
  createHash("sha256").update(t).digest("hex");

export interface InviteView {
  readonly status: "invite";
  readonly code: string;
  readonly mode: ModeId;
  /** The host's first name, if they gave one. */
  readonly host: string;
}
export type Gate =
  | { readonly status: "gone" }
  | { readonly status: "full" }
  | InviteView
  | PlayView;

const person = (name: unknown, token: string): Person => ({
  name: clean(name, NAME_MAX),
  th: hashToken(token),
});

export interface CreateInput {
  readonly mode: unknown;
  readonly stage: unknown;
  readonly phones: unknown;
  readonly name?: unknown;
  /** One phone: the second person's name. */
  readonly guestName?: unknown;
  readonly questions?: unknown;
  /** One phone: the second person's own questions. */
  readonly guestQuestions?: unknown;
}

export async function createNight(
  store: NightStore,
  input: CreateInput,
  now: () => number = Date.now,
): Promise<
  { ok: true; code: string; token: string } | { ok: false; error: string }
> {
  if (!isModeId(input.mode)) return { ok: false, error: "bad-mode" };
  if (!isStageId(input.stage)) return { ok: false, error: "bad-stage" };
  if (input.phones !== 1 && input.phones !== 2)
    return { ok: false, error: "bad-phones" };
  const token = newToken();
  const list = Array.isArray(input.questions) ? input.questions : [];
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = newCode();
    const fields = newFields({
      seed: randomBytes(8).toString("hex"),
      phones: input.phones,
      mode: input.mode,
      stage: input.stage,
      now: now(),
      host: person(input.name, token),
      guest: input.phones === 1 ? person(input.guestName, token) : undefined,
      questions: list,
      guestQuestions: Array.isArray(input.guestQuestions)
        ? input.guestQuestions
        : [],
    });
    if (await store.create(code, fields)) return { ok: true, code, token };
  }
  return { ok: false, error: "no-code" };
}

/** Which seat a token holds, if any. One phone holds both. */
export function seatOf(
  st: SessionState,
  token: string | null,
  as?: Slot,
): Slot | null {
  if (!token) return null;
  const th = hashToken(token);
  const mine = ([1, 2] as const).filter((s) => st.people[s]?.th === th);
  if (!mine.length) return null;
  if (st.phones === 1)
    return as && mine.includes(as) ? as : (needs(st)[0] ?? mine[0]);
  return mine[0];
}

async function stateOf(store: NightStore, code: string) {
  const fields = await store.load(code);
  return fields ? parseState(fields) : null;
}

export async function openNight(
  store: NightStore,
  code: string,
  token: string | null,
  as?: Slot,
): Promise<Gate> {
  const st = await stateOf(store, code);
  if (!st) return { status: "gone" };
  const me = seatOf(st, token, as);
  if (me) return viewFor(st, code, me);
  if (st.phones === 2 && st.people[2] === null && st.people[1]) {
    return {
      status: "invite",
      code,
      mode: st.mode,
      host: st.people[1].left ? "" : st.people[1].name,
    };
  }
  return { status: "full" };
}

/** Take the one open seat. Pressing Join is the only way in. */
export async function joinNight(
  store: NightStore,
  code: string,
  input: { name?: unknown; questions?: unknown },
): Promise<
  { ok: true; token: string } | { ok: false; error: "gone" | "full" }
> {
  const st = await stateOf(store, code);
  if (!st) return { ok: false, error: "gone" };
  if (st.phones !== 2 || st.people[2] !== null)
    return { ok: false, error: "full" };
  const token = newToken();
  if (
    !(await store.claim(code, "p2", JSON.stringify(person(input.name, token))))
  )
    return { ok: false, error: "full" };
  const list = Array.isArray(input.questions) ? input.questions : [];
  const fresh = await stateOf(store, code);
  if (fresh) {
    const out = apply(fresh, 2, { type: "questions", list });
    if (out.ok) await store.write(code, out.change);
  }
  return { ok: true, token };
}

export type ActResult =
  | { ok: true; view: PlayView }
  | { ok: false; status: 400 | 404 | 409; error: string };

export async function act(
  store: NightStore,
  code: string,
  token: string | null,
  as: Slot | undefined,
  action: Action,
): Promise<ActResult> {
  const st = await stateOf(store, code);
  const me = st && seatOf(st, token, as);
  if (!st || !me) return { ok: false, status: 404, error: "gone" };
  const out = apply(st, me, action);
  if (!out.ok)
    return {
      ok: false,
      status: out.error === "not-your-turn" ? 409 : 400,
      error: out.error,
    };
  await store.write(code, out.change);
  const fresh = await stateOf(store, code);
  if (!fresh) return { ok: false, status: 404, error: "gone" };
  // After this person's own move, a one-phone night looks at the next person.
  const seat = fresh.phones === 1 ? seatOf(fresh, token, undefined)! : me;
  return { ok: true, view: viewFor(fresh, code, seat ?? me) };
}

/** Leave. Takes this person's answers and questions with them. */
export async function leaveNight(
  store: NightStore,
  code: string,
  token: string | null,
  as?: Slot,
): Promise<boolean> {
  const st = await stateOf(store, code);
  const me = st && seatOf(st, token, as);
  if (!st || !me) return false;
  const slots: Slot[] = st.phones === 1 ? [1, 2] : [me];
  if (everyoneGone(st, slots)) await store.drop(code);
  else await store.write(code, leaving(st, slots));
  return true;
}

/** The three modes, for the pages. */
export const MODE_LABELS: Record<ModeId, string> = Object.fromEntries(
  MODES.map((m) => [m.id, m.label]),
) as Record<ModeId, string>;

export type { ModeId, StageId, Slot, PlayView, Action };
