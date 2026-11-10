import { weekdayOf } from "./schedule";
import type { Club } from "./model";

/**
 * **The Clubhouse — one chat for the whole club.** Pure, like `engine.ts`:
 * `(document, who, what, server time) → new document | a reason it can't
 * happen`. The service applies the result by compare-and-swap.
 *
 * Two kinds of stored document:
 *
 *   chat:<monday>   one week of messages (so a season of talk never grows one
 *                   document without limit, and nothing is ever deleted)
 *   chatmod         the organizer's controls: locked, muted, pinned, a log
 *
 * There is exactly one room. There is no recipient on a message, no thread
 * and no way to address one person privately — a message is the whole club's.
 * Moderation never destroys: removing a message hides it (organizers still
 * see it, and can put it back), so the season's history stays whole.
 */

export type ChatKind = "text" | "challenge" | "rematch";

export interface ChatMessage {
  readonly id: string;
  readonly at: number;
  readonly by: string;
  readonly kind: ChatKind;
  readonly text: string;
  /** A challenge announcement points at the challenge it is about. */
  readonly ref?: { readonly session: string; readonly challenge: string };
  removed?: { readonly by: string; readonly at: number };
  /** Distinct players who reported it. */
  reports?: string[];
  /** Emoji → players who used it. */
  reactions?: Record<string, string[]>;
}

export interface ChatShard {
  readonly week: string;
  seq: number;
  messages: ChatMessage[];
}

export interface Mute {
  readonly by: string;
  readonly at: number;
  /** `null`: for the rest of the season. */
  readonly until: number | null;
}

export interface ChatMod {
  /** The first week anyone said anything, so "earlier messages" knows. */
  first?: string;
  locked: boolean;
  muted: Record<string, Mute>;
  pinned: { text: string; by: string; at: number } | null;
  log: { at: number; by: string; what: string }[];
}

export const emptyShard = (week: string): ChatShard => ({
  week,
  seq: 0,
  messages: [],
});

export const emptyMod = (): ChatMod => ({
  locked: false,
  muted: {},
  pinned: null,
  log: [],
});

export const MAX_TEXT = 300;
/** A week of a 25-person club never gets near this; it is a backstop. */
export const MAX_PER_WEEK = 3000;
/** This many different reporters hide a message until an organizer looks. */
export const REPORTS_TO_HIDE = 3;
export const REACTIONS = ["👍", "😂", "🔥", "👏", "🏸", "😮"] as const;

export type ChatOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

const fail = (error: string): ChatOutcome<never> => ({ ok: false, error });

// --- Weeks -------------------------------------------------------------------

/** The Monday on or before a YYYY-MM-DD date. */
export function weekStart(date: string): string {
  const back = (weekdayOf(date) + 6) % 7;
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! - back)).toISOString().slice(0, 10);
}

export const addDays = (date: string, days: number): string => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
};

export const MESSAGE_ID = /^(\d{4}-\d{2}-\d{2}):(\d{1,5})$/;

/** The week a message id belongs to, if the id is well formed. */
export function weekOfMessage(id: unknown): string | null {
  const m = typeof id === "string" ? MESSAGE_ID.exec(id) : null;
  return m ? m[1]! : null;
}

// --- Family-friendly text ----------------------------------------------------

const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  $: "s",
  "!": "i",
};

/** Whole words. Banter ("loser", "sucks") is fine; this is the rude stuff. */
const WORDS = new Set([
  "ass",
  "asshole",
  "arse",
  "bastard",
  "crap",
  "damn",
  "dick",
  "dumbass",
  "hell",
  "piss",
  "pissed",
  "wtf",
  "stfu",
  "douche",
  "idiot",
  "stupid",
  "moron",
  "shutup",
  "wanker",
  "twat",
  "tits",
  "boobs",
  "sex",
  "porn",
  "cock",
  "pussy",
  "bollocks",
]);

/** Inside any word, whatever surrounds them. */
const STEMS = [
  "fuck",
  "shit",
  "bitch",
  "cunt",
  "whore",
  "slut",
  "nigg",
  "retard",
  "faggot",
  "dickhead",
];

/** "fuuuck" → "fuck": every run of the same letter becomes one letter. */
const collapse = (w: string) => w.replace(/(.)\1+/g, "$1");
const hasRun3 = (w: string) => /(.)\1\1/.test(w);
const COLLAPSED_WORDS = new Set([...WORDS].map(collapse));
const COLLAPSED_STEMS = STEMS.filter((s) => collapse(s) === s);

function rude(t: string): boolean {
  if (WORDS.has(t) || STEMS.some((s) => t.includes(s))) return true;
  // Stretched letters ("shiit", "assss") — but never a real word that merely
  // has a double letter ("as" is not "ass", "tonight" is not "nigg…").
  const c = collapse(t);
  if (c === t) return false;
  if (COLLAPSED_STEMS.some((s) => c.includes(s))) return true;
  return hasRun3(t) && COLLAPSED_WORDS.has(c);
}

/** "f***", "sh*t": a masked word that lines up with a rude one. */
function maskedRude(word: string): boolean {
  const w = word.replace(/[^a-z*#%]/g, "");
  if (w.length < 3 || !/[*#%]/.test(w) || !/[a-z]/.test(w)) return false;
  const fits = (term: string, at: number) =>
    [...term].every(
      (ch, i) => w[at + i] === ch || /[*#%]/.test(w[at + i] ?? ""),
    );
  return (
    STEMS.some((s) => {
      for (let at = 0; at + s.length <= w.length; at++)
        if (fits(s, at)) return true;
      return false;
    }) || [...WORDS].some((t) => t.length === w.length && fits(t, 0))
  );
}

/** The first thing in `text` a family room wouldn't want, or null. */
export function unfriendly(text: string): string | null {
  const mapped = [...text.toLowerCase().normalize("NFKD")]
    .map((c) => LEET[c] ?? c)
    .join("");
  for (const t of mapped.split(/[^a-z]+/).filter(Boolean))
    if (rude(t)) return t;
  for (const t of mapped.split(/\s+/)) if (maskedRude(t)) return t;
  // "f u c k" and "f.u.c.k": runs of single letters read as one word.
  let run = "";
  for (const t of mapped.split(/[^a-z]/)) {
    if (t.length === 1) run += t;
    else {
      if (run.length >= 3 && rude(run)) return run;
      run = "";
    }
  }
  if (run.length >= 3 && rude(run)) return run;
  return null;
}

/** Control characters and invisible spacers: stripped, not rejected. */
const invisible = (c: number) =>
  c < 0x20 ||
  c === 0x7f ||
  (c >= 0x200b && c <= 0x200f) ||
  (c >= 0x2028 && c <= 0x202e);

const LINK =
  /https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|ca|io|me|app|ly|co|info|xyz)\b/i;

/**
 * Tidy a line of chat and say why it can't be posted, if it can't. Used for
 * messages, pins and challenge notes alike.
 */
export function screenText(raw: unknown, max = MAX_TEXT): ChatOutcome<string> {
  if (typeof raw !== "string") return fail("Say something first.");
  const text = [...raw]
    .map((c) => (invisible(c.codePointAt(0)!) ? " " : c))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return fail("Say something first.");
  if (text.length > max) return fail(`Keep it under ${max} characters.`);
  if (LINK.test(text))
    return fail("Links aren't allowed in the Clubhouse — keep it simple.");
  if (unfriendly(text))
    return fail("Let's keep it family-friendly — try rewording that.");
  return { ok: true, value: text };
}

/** Players `@mentioned` by first or full name. */
export function mentions(club: Club, text: string): string[] {
  const lower = text.toLowerCase();
  return Object.values(club.players)
    .filter((p) => {
      const full = p.name.toLowerCase();
      const first = full.split(" ")[0]!;
      return (
        lower.includes(`@${full}`) ||
        new RegExp(`@${escapeRe(first)}(?![\\p{L}\\p{N}])`, "u").test(lower)
      );
    })
    .map((p) => p.id);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// --- Who may speak -----------------------------------------------------------

/** The mute on this player right now, expired ones forgotten. */
export function activeMute(mod: ChatMod, id: string, now: number) {
  const m = Object.hasOwn(mod.muted, id) ? mod.muted[id] : undefined;
  if (!m) return null;
  return m.until === null || m.until > now ? m : null;
}

export interface Speaker {
  readonly id: string;
  readonly organizer: boolean;
}

// --- Changing a week ---------------------------------------------------------

export type ShardCommand =
  | { type: "post"; text: unknown }
  | {
      type: "announce";
      kind: "challenge" | "rematch";
      text: string;
      ref: { session: string; challenge: string };
    }
  | { type: "react"; id: string; emoji: unknown }
  | { type: "report"; id: string }
  | { type: "remove"; id: string; restore?: boolean };

export type ModCommand =
  | { type: "mute"; playerId: string; hours: number | null }
  | { type: "unmute"; playerId: string }
  | { type: "pin"; text: string | null }
  | { type: "lock"; locked: boolean };

export type ChatCommand = ShardCommand | ModCommand;

export const isModCommand = (c: ChatCommand): c is ModCommand =>
  c.type === "mute" ||
  c.type === "unmute" ||
  c.type === "pin" ||
  c.type === "lock";

const MIN_GAP_MS = 1_000;
const PER_MINUTE = 12;
const MINUTE = 60_000;

export function applyShard(
  shard: ChatShard,
  mod: ChatMod,
  club: Club,
  who: Speaker,
  cmd: ShardCommand,
  now: number,
): ChatOutcome<ChatShard> {
  if (!Object.hasOwn(club.players, who.id)) return fail("Sign in first.");
  const s = structuredClone(shard);
  const find = (id: string) => s.messages.find((m) => m.id === id);

  switch (cmd.type) {
    case "post":
    case "announce": {
      const system = cmd.type === "announce";
      if (!system) {
        const mute = activeMute(mod, who.id, now);
        if (mute)
          return fail(
            "The organizer has paused your chat for now. You can still read along.",
          );
        if (mod.locked && !who.organizer)
          return fail("The Clubhouse is resting — the organizer paused chat.");
      }
      const checked = screenText(cmd.text);
      if (!checked.ok) return checked;
      if (s.messages.length >= MAX_PER_WEEK)
        return fail(
          "The Clubhouse is full for this week — tell the organizer.",
        );
      if (!system) {
        const mine = s.messages.filter((m) => m.by === who.id);
        const last = mine[mine.length - 1];
        if (last && now - last.at < MIN_GAP_MS)
          return fail("Easy — give it a second between messages.");
        if (mine.filter((m) => now - m.at < MINUTE).length >= PER_MINUTE)
          return fail("That's a lot of messages — take a breath.");
        if (last && last.text === checked.value && now - last.at < 30_000)
          return fail("You just said that.");
      }
      const id = `${s.week}:${++s.seq}`;
      const msg: ChatMessage = system
        ? {
            id,
            at: now,
            by: who.id,
            kind: cmd.kind,
            text: checked.value,
            ref: cmd.ref,
          }
        : { id, at: now, by: who.id, kind: "text", text: checked.value };
      s.messages.push(msg);
      return { ok: true, value: s };
    }
    case "react": {
      const m = find(cmd.id);
      if (!m || m.removed) return fail("That message isn't here.");
      if (activeMute(mod, who.id, now)) return fail("Chat is paused for you.");
      if (
        typeof cmd.emoji !== "string" ||
        !(REACTIONS as readonly string[]).includes(cmd.emoji)
      )
        return fail("Pick one of the reactions.");
      const emoji = cmd.emoji;
      const reactions = (m.reactions ??= {});
      const users = Object.hasOwn(reactions, emoji) ? reactions[emoji]! : [];
      reactions[emoji] = users.includes(who.id)
        ? users.filter((u) => u !== who.id)
        : [...users, who.id];
      if (!reactions[emoji]!.length) delete reactions[emoji];
      return { ok: true, value: s };
    }
    case "report": {
      const m = find(cmd.id);
      if (!m) return fail("That message isn't here.");
      if (m.by === who.id) return fail("That one's yours.");
      if (!(m.reports ??= []).includes(who.id)) m.reports.push(who.id);
      return { ok: true, value: s };
    }
    case "remove": {
      if (!who.organizer) return fail("Only the organizer can do that.");
      const m = find(cmd.id);
      if (!m) return fail("That message isn't here.");
      if (cmd.restore) {
        delete m.removed;
        m.reports = [];
      } else m.removed = { by: who.id, at: now };
      return { ok: true, value: s };
    }
  }
}

export function applyMod(
  mod: ChatMod,
  club: Club,
  who: Speaker,
  cmd: ModCommand,
  now: number,
): ChatOutcome<ChatMod> {
  if (!who.organizer) return fail("Only the organizer can do that.");
  const m = structuredClone(mod);
  const name = (id: string) => club.players[id]?.name ?? "someone";
  const log = (what: string) => {
    m.log.push({ at: now, by: who.id, what });
    if (m.log.length > 100) m.log.splice(0, m.log.length - 100);
  };
  switch (cmd.type) {
    case "mute": {
      if (!Object.hasOwn(club.players, cmd.playerId))
        return fail("Unknown player.");
      if (cmd.playerId === who.id) return fail("Not yourself.");
      const hours =
        cmd.hours === null ? null : Math.min(24 * 200, Math.max(1, cmd.hours));
      if (hours !== null && !Number.isFinite(hours))
        return fail("How long for?");
      m.muted[cmd.playerId] = {
        by: who.id,
        at: now,
        until: hours === null ? null : now + hours * 60 * MINUTE,
      };
      log(
        `Paused ${name(cmd.playerId)}'s chat ${hours === null ? "for the season" : `for ${hours} h`}`,
      );
      return { ok: true, value: m };
    }
    case "unmute":
      if (!Object.hasOwn(m.muted, cmd.playerId)) return { ok: true, value: m };
      delete m.muted[cmd.playerId];
      log(`Let ${name(cmd.playerId)} chat again`);
      return { ok: true, value: m };
    case "pin": {
      if (cmd.text === null) {
        m.pinned = null;
        log("Unpinned the announcement");
        return { ok: true, value: m };
      }
      const checked = screenText(cmd.text);
      if (!checked.ok) return checked;
      m.pinned = { text: checked.value, by: who.id, at: now };
      log("Pinned an announcement");
      return { ok: true, value: m };
    }
    case "lock":
      m.locked = !!cmd.locked;
      log(cmd.locked ? "Paused the chat" : "Resumed the chat");
      return { ok: true, value: m };
  }
}

// --- What a phone is shown ---------------------------------------------------

export interface ChatMessageView {
  readonly id: string;
  readonly at: number;
  readonly by: string;
  readonly kind: ChatKind;
  /** Empty when hidden from this viewer. */
  readonly text: string;
  readonly ref: ChatMessage["ref"] | null;
  /** "removed" (by an organizer) or "reported" (hidden pending a look). */
  readonly hidden: "removed" | "reported" | null;
  readonly reactions: { emoji: string; n: number; mine: boolean }[];
  readonly reportedByMe: boolean;
  /** Organizers only. */
  readonly reports: number;
}

export function hiddenReason(m: ChatMessage): "removed" | "reported" | null {
  if (m.removed) return "removed";
  return (m.reports?.length ?? 0) >= REPORTS_TO_HIDE ? "reported" : null;
}

export function messageView(m: ChatMessage, me: Speaker): ChatMessageView {
  const hidden = hiddenReason(m);
  // Organizers keep seeing what they hid so they can put it back; an author
  // is not told their own message was hidden by reports, just that it is.
  const show = !hidden || me.organizer;
  return {
    id: m.id,
    at: m.at,
    by: m.by,
    kind: m.kind,
    text: show ? m.text : "",
    ref: m.ref ?? null,
    hidden,
    reactions: hidden
      ? []
      : Object.entries(m.reactions ?? {}).map(([emoji, users]) => ({
          emoji,
          n: users.length,
          mine: users.includes(me.id),
        })),
    reportedByMe: !!m.reports?.includes(me.id),
    reports: me.organizer ? (m.reports?.length ?? 0) : 0,
  };
}
