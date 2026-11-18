import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  REASON_PROBLEM,
  checkDraft,
  checkRanking,
  checkReason,
  kindOf,
  cleanCity,
  clean,
  isCircleCode,
  isOpen,
  isProvince,
  isReportReason,
  LIMITS,
  newId,
  type CreateInput,
  type Pulse,
  type PulseKind,
  type PulseStatus,
} from "./model";
import type { QuestionDraft } from "./drafts";
import { computeResults, type Results } from "./results";
import type { Listed, PulseEvent, PulseStore, VoteOutcome } from "./store";

/**
 * **What People's Pulse does**, independent of HTTP: create, vote, read
 * results, list, report, moderate.
 *
 * Who a visitor is, as far as Pulse knows: a random device cookie. It is
 * never stored; the store sees only a keyed one-way hash of it. That is the
 * duplicate-vote rule — **one vote per browser**, not one per person: a
 * second browser or a cleared cookie can vote again. A keyed, daily-rotating
 * hash of the network address caps how many votes one network can add to one
 * Pulse, which stops a script without stopping a household, an office or a
 * café. Neither is proof of a unique person and the product says so.
 */

export const NET_CAP_PER_PULSE = 40;
export const CREATES_PER_DAY = 10;
/** A ballot younger than this was not read by a person. */
export const BALLOT_MIN_AGE_MS = 700;
const BALLOT_MAX_AGE_MS = 7 * 86_400_000;
/** The create form must be open this long before it is sent. */
export const FORM_MIN_AGE_MS = 2_500;

const hmac = (key: string, text: string) =>
  createHmac("sha256", key).update(text).digest();

export const newDevice = () => randomBytes(18).toString("base64url");

export const isDevice = (v: unknown): v is string =>
  typeof v === "string" && /^[\w-]{20,40}$/.test(v);

export const voterHash = (key: string, device: string) =>
  hmac(key, `voter|${device}`).toString("base64url").slice(0, 32);

const creatorHash = (key: string, device: string) =>
  hmac(key, `creator|${device}`).toString("base64url").slice(0, 32);

const reporterHash = (key: string, device: string) =>
  hmac(key, `reporter|${device}`).toString("base64url").slice(0, 32);

/** Changes every UTC day, so the stored value cannot follow a network across days. */
export const netHash = (key: string, ip: string, now: Date) =>
  hmac(key, `net|${now.toISOString().slice(0, 10)}|${ip}`)
    .toString("base64url")
    .slice(0, 24);

const CODE_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

/**
 * **A person's referral code on one Pulse.** Derived, not stored, from the
 * device and the Pulse, so the link someone shares before voting and after
 * is the same link, and a code says nothing about its owner's other Pulses.
 */
export function circleCode(key: string, pulseId: string, device: string) {
  const bytes = hmac(key, `circle|${pulseId}|${device}`);
  let out = "";
  for (let i = 0; i < 8; i++) out += CODE_ALPHABET[bytes[i]! % 32];
  return out;
}

/** Signed into the page: a vote must carry one, at least a moment old. */
export function ballotToken(key: string, pulseId: string, now: Date) {
  const t = now.getTime().toString(36);
  const sig = hmac(key, `ballot|${pulseId}|${t}`)
    .toString("base64url")
    .slice(0, 16);
  return `${t}.${sig}`;
}

export function ballotProblem(
  key: string,
  pulseId: string,
  token: unknown,
  now: Date,
): "missing" | "forged" | "too-fast" | "stale" | null {
  if (typeof token !== "string" || !token.includes(".")) return "missing";
  const [t, sig] = token.split(".", 2) as [string, string];
  const want = hmac(key, `ballot|${pulseId}|${t}`)
    .toString("base64url")
    .slice(0, 16);
  if (
    sig.length !== want.length ||
    !timingSafeEqual(Buffer.from(sig), Buffer.from(want))
  )
    return "forged";
  const age = now.getTime() - parseInt(t, 36);
  if (!Number.isFinite(age) || age > BALLOT_MAX_AGE_MS) return "stale";
  if (age < BALLOT_MIN_AGE_MS) return "too-fast";
  return null;
}

export interface Who {
  readonly device: string;
  readonly ip: string;
  readonly now: Date;
}

// ── Create ──────────────────────────────────────────────────────────────────

export type CreateResult =
  | { readonly ok: true; readonly pulse: Pulse }
  | {
      readonly ok: false;
      readonly error: "invalid" | "limited" | "bot";
      readonly field?: string;
      readonly message: string;
    };

export async function createPulse(
  store: PulseStore,
  key: string,
  input: CreateInput & { website?: unknown; openedAt?: unknown },
  who: Who,
): Promise<CreateResult> {
  // The hidden "website" field is invisible to people; only form-fillers fill it.
  const opened = Number(input.openedAt);
  if (
    (typeof input.website === "string" && input.website.trim() !== "") ||
    !Number.isFinite(opened) ||
    who.now.getTime() - opened < FORM_MIN_AGE_MS
  )
    return {
      ok: false,
      error: "bot",
      message: "That was quicker than a person types. Give it another go.",
    };
  // A Pulse Check is only ever made with its investigation (checkService).
  if (input.kind === "check")
    return {
      ok: false,
      error: "invalid",
      field: "kind",
      message: "Check a claim at /check/new.",
    };
  const checked = checkDraft(input, who.now);
  if (!checked.ok)
    return {
      ok: false,
      error: "invalid",
      field: checked.field,
      message: checked.message,
    };
  for (let attempt = 0; attempt < 4; attempt++) {
    const pulse: Pulse = {
      ...checked.draft,
      id: newId((n) => randomBytes(n)),
      status: "live",
      createdAt: who.now.toISOString(),
    };
    const outcome = await store.create(
      pulse,
      {
        creator: creatorHash(key, who.device),
        net: netHash(key, who.ip, who.now),
      },
      CREATES_PER_DAY,
    );
    if (outcome === "ok") return { ok: true, pulse };
    if (outcome === "limited")
      return {
        ok: false,
        error: "limited",
        message: `That's ${CREATES_PER_DAY} new Pulses from here today — come back tomorrow.`,
      };
  }
  throw new Error("could not find a free Pulse id");
}

// ── Read ────────────────────────────────────────────────────────────────────

export interface Snapshot {
  readonly pulse: Pulse;
  readonly open: boolean;
  readonly total: number;
  readonly me: {
    readonly option: string | null;
    /** Your referral code on this Pulse: your share link carries it. */
    readonly circle: string;
  };
  /** Null until you vote (or ask to see), so a vote isn't nudged by the count. */
  readonly results: Results | null;
}

const VOTES_TTL_MS = 1_500;
const cache = new Map<string, { at: number; rows: Promise<unknown> }>();

/**
 * Phones poll every few seconds; one instance reuses a Pulse's votes for a
 * moment so a busy Pulse costs one read per instance per moment, not one per
 * phone. A vote clears its Pulse's entry, so the voter sees their own vote.
 */
async function cachedVotes(store: PulseStore, pulseId: string, now: number) {
  const hit = cache.get(pulseId);
  if (hit && now - hit.at < VOTES_TTL_MS)
    return hit.rows as ReturnType<PulseStore["votes"]>;
  const rows = store.votes(pulseId);
  cache.set(pulseId, { at: now, rows });
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  rows.catch(() => cache.delete(pulseId));
  return rows;
}

export function forgetCachedVotes() {
  cache.clear();
}

export async function snapshot(
  store: PulseStore,
  key: string,
  pulseId: string,
  device: string,
  now: Date,
  reveal: boolean,
): Promise<Snapshot | null> {
  const pulse = await store.get(pulseId);
  if (!pulse || pulse.status === "removed") return null;
  const [mine, votes] = await Promise.all([
    store.mine(pulseId, voterHash(key, device)),
    cachedVotes(store, pulseId, now.getTime()),
  ]);
  const circle = circleCode(key, pulseId, device);
  const open = isOpen(pulse, now);
  const show = pulse.status === "live" && (Boolean(mine) || reveal || !open);
  return {
    pulse,
    open,
    total: votes.length,
    me: { option: mine?.option ?? null, circle },
    results: show
      ? computeResults(pulse, votes, circle, now, mine?.option ?? null)
      : null,
  };
}

// ── Vote ────────────────────────────────────────────────────────────────────

export interface VoteInput {
  readonly option?: unknown;
  readonly via?: unknown;
  readonly province?: unknown;
  readonly city?: unknown;
  readonly ballot?: unknown;
  /** Where the Pulse asks for them: a short written reason. */
  readonly reason?: unknown;
  /** Rank These: every answer id, first choice first. */
  readonly ranking?: unknown;
  /** Is This Normal?: the comparison category picked. */
  readonly group?: unknown;
}

export type VoteResult =
  | { readonly ok: true; readonly outcome: "ok" | "duplicate" }
  | {
      readonly ok: false;
      readonly outcome:
        | Exclude<VoteOutcome, "ok" | "duplicate">
        | "bot"
        | "bad-reason"
        | "bad-ranking";
      readonly message: string;
    };

const VOTE_MESSAGE: Record<
  | Exclude<VoteOutcome, "ok" | "duplicate">
  | "bot"
  | "bad-reason"
  | "bad-ranking",
  string
> = {
  "bad-reason": REASON_PROBLEM,
  "bad-ranking": "Put every one of them in order, then send.",
  closed: "Voting on this Pulse has closed.",
  missing: "This Pulse isn't here any more.",
  "bad-option": "That isn't one of the answers.",
  limited:
    "A lot of votes have come from this network already, so we've paused it here.",
  bot: "That vote didn't look like it came from a person. Reload and try again.",
};

export async function castVote(
  store: PulseStore,
  key: string,
  pulseId: string,
  input: VoteInput,
  who: Who,
): Promise<VoteResult> {
  const problem = ballotProblem(key, pulseId, input.ballot, who.now);
  if (problem) {
    console.warn("pulse-ballot-refused", { pulseId, problem });
    return { ok: false, outcome: "bot", message: VOTE_MESSAGE.bot };
  }
  const pulse = await store.get(pulseId);
  if (!pulse || pulse.status === "removed")
    return { ok: false, outcome: "missing", message: VOTE_MESSAGE.missing };
  const kind = kindOf(pulse);
  // A reason is kept only where the Pulse asks for reasons.
  const reason = pulse.reasons ? checkReason(input.reason) : null;
  if (reason === "problem")
    return {
      ok: false,
      outcome: "bad-reason",
      message: VOTE_MESSAGE["bad-reason"],
    };
  let option = typeof input.option === "string" ? input.option : "";
  let ranking: string | null = null;
  if (kind === "rank") {
    ranking = checkRanking(input.ranking, pulse.options);
    if (!ranking)
      return {
        ok: false,
        outcome: "bad-ranking",
        message: VOTE_MESSAGE["bad-ranking"],
      };
    // The first choice is the vote's answer, so every V1 view reads "first choice".
    option = pulse.options[Number(ranking[0]) - 1]!.id;
  }
  const group =
    kind === "normal" &&
    typeof input.group === "string" &&
    pulse.group?.options.some((g) => g.id === input.group)
      ? input.group
      : null;
  const circle = circleCode(key, pulseId, who.device);
  const via =
    isCircleCode(input.via) && input.via !== circle ? input.via : null;
  const province = isProvince(input.province) ? input.province : null;
  const city = province ? cleanCity(input.city) : null;
  const outcome = await store.vote(
    {
      pulseId,
      voter: voterHash(key, who.device),
      net: netHash(key, who.ip, who.now),
      option,
      circle,
      via,
      province,
      city,
      reason,
      ranking,
      group,
    },
    NET_CAP_PER_PULSE,
  );
  cache.delete(pulseId);
  if (outcome === "ok" || outcome === "duplicate") return { ok: true, outcome };
  return { ok: false, outcome, message: VOTE_MESSAGE[outcome] };
}

// ── Discover ────────────────────────────────────────────────────────────────

export interface Card {
  readonly id: string;
  readonly kind: PulseKind;
  readonly question: string;
  readonly scope: Pulse["scope"];
  readonly total: number;
  readonly lastDay: number;
  readonly createdAt: string;
  readonly open: boolean;
  readonly hasClaim: boolean;
}

export interface Shelves {
  readonly recent: readonly Card[];
  readonly popular: readonly Card[];
  readonly trending: readonly Card[];
}

/**
 * Three plain shelves, no recommender: newest; most votes; most votes in the
 * last day (a Pulse needs MIN_TRENDING of them to trend at all).
 */
export const MIN_TRENDING = 3;

export function shelves(
  listed: readonly Listed[],
  now: Date,
  size = 6,
): Shelves {
  const cards: Card[] = listed.map(({ pulse, total, lastDay }) => ({
    id: pulse.id,
    kind: kindOf(pulse),
    question: pulse.question,
    scope: pulse.scope,
    total,
    lastDay,
    createdAt: pulse.createdAt,
    open: isOpen(pulse, now),
    hasClaim: pulse.claim !== null,
  }));
  return {
    recent: cards.slice(0, size),
    popular: [...cards]
      .filter((c) => c.total > 0)
      .sort(
        (a, b) => b.total - a.total || b.createdAt.localeCompare(a.createdAt),
      )
      .slice(0, size),
    trending: [...cards]
      .filter((c) => c.open && c.lastDay >= MIN_TRENDING)
      .sort((a, b) => b.lastDay - a.lastDay || b.total - a.total)
      .slice(0, size),
  };
}

/** Newest of each kind, for the Labs page's "try one" row. */
export function newestByKind(
  listed: readonly Listed[],
  now: Date,
): Partial<Record<PulseKind, Card>> {
  const out: Partial<Record<PulseKind, Card>> = {};
  for (const c of shelves(listed, now, listed.length).recent)
    if (c.open && !out[c.kind]) out[c.kind] = c;
  return out;
}

// ── Usage ───────────────────────────────────────────────────────────────────

/**
 * Count one visitor action for aggregate usage. Counting never gets in the
 * way: a missing table or a slow database is swallowed and logged.
 */
export async function countEvent(
  store: PulseStore,
  pulseId: string,
  event: PulseEvent,
): Promise<boolean> {
  try {
    const pulse = await store.get(pulseId);
    if (!pulse || pulse.status !== "live") return false;
    // Pulse Check counts its own visits and shares (checkStore.count).
    if (kindOf(pulse) === "check") return false;
    await store.count(event, kindOf(pulse));
    return true;
  } catch (e) {
    console.warn("pulse-count-skipped", { event, because: String(e) });
    return false;
  }
}

// ── Report and moderate ─────────────────────────────────────────────────────

export async function reportPulse(
  store: PulseStore,
  key: string,
  pulseId: string,
  input: { reason?: unknown; note?: unknown },
  device: string,
): Promise<"ok" | "duplicate" | "missing" | "invalid"> {
  if (!isReportReason(input.reason)) return "invalid";
  const note = clean(input.note, LIMITS.reportNote) || null;
  return store.report(pulseId, reporterHash(key, device), input.reason, note);
}

export const isModerationStatus = (v: unknown): v is PulseStatus =>
  v === "live" || v === "review" || v === "removed";

// ── Question of the Day ─────────────────────────────────────────────────────

/** A day's date as people in Canada's west keep it, so "today" ends at their midnight. */
export const PULSE_TZ = "America/Vancouver";

export const pulseDay = (now: Date): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: PULSE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

export const isDay = (v: unknown): v is string =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(new Date(`${v}T12:00:00Z`).getTime()) &&
  new Date(`${v}T12:00:00Z`).toISOString().startsWith(v);

/**
 * The one question featured today, if an administrator chose one. There is
 * no automatic fallback: a featured question is a person's pick, and an empty
 * day is shown as empty rather than filled by a ranking.
 */
export async function questionOfTheDay(
  store: PulseStore,
  now: Date,
): Promise<Card | null> {
  const today = pulseDay(now);
  const [hit] = await store.featured(today, 1);
  if (!hit || hit.day !== today) return null;
  return shelves([hit.item], now, 1).recent[0] ?? null;
}

// ── Proposed questions ──────────────────────────────────────────────────────

/** A draft's Pulse id: fixed per draft, so a second Publish is refused, not duplicated. */
export function draftPulseId(key: string, draftId: string): string {
  const bytes = hmac(key, `draft|${draftId}`);
  let out = "";
  for (let i = 0; i < 8; i++) out += CODE_ALPHABET[bytes[i]! % 32];
  return out;
}

export type PublishResult =
  | { readonly ok: true; readonly id: string }
  | {
      readonly ok: false;
      readonly error: "missing" | "unconfirmed" | "taken" | "invalid";
      readonly message: string;
      readonly id?: string;
    };

/**
 * Publish a proposed question, by an administrator only (the route checks).
 * It goes through the same gate as every visitor's Pulse.
 */
export async function publishDraft(
  store: PulseStore,
  key: string,
  draft: QuestionDraft | null,
  confirmed: boolean,
  now: Date,
): Promise<PublishResult> {
  if (!draft) return { ok: false, error: "missing", message: "No such draft." };
  if (draft.stakes === "high-stakes" && !confirmed)
    return {
      ok: false,
      error: "unconfirmed",
      message:
        "This one is high-stakes: confirm you reviewed its wording and sources.",
    };
  const checked = checkDraft(
    {
      kind: draft.kind,
      question: draft.question,
      options: draft.options,
      description: draft.description,
      sourceUrl: draft.sourceUrl,
    },
    now,
  );
  if (!checked.ok)
    return { ok: false, error: "invalid", message: checked.message };
  const id = draftPulseId(key, draft.id);
  const outcome = await store.create(
    { ...checked.draft, id, status: "live", createdAt: now.toISOString() },
    { creator: "admin-drafts", net: "admin-drafts" },
    1_000,
  );
  if (outcome === "taken")
    return { ok: false, error: "taken", message: "Already published.", id };
  return { ok: true, id };
}
