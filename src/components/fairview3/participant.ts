"use client";

const KEY = "fv3:participant";
const VOTES = "fv3:votes";

/**
 * **Who this phone is, as far as the show needs to know.**
 *
 * A random id, made once, kept in localStorage. Not an account, not a name,
 * not a cookie the server sets: it is the duplicate-vote key and nothing
 * else, and it survives a reload or a dropped connection. `crypto.randomUUID`
 * needs a secure context, which production (https) and localhost both are.
 */
export function participantId(): string {
  if (typeof window === "undefined")
    return "00000000-0000-4000-8000-000000000000";
  let id = window.localStorage.getItem(KEY);
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    id =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : fallbackUuid();
    window.localStorage.setItem(KEY, id);
  }
  return id;
}

function fallbackUuid(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** My own votes, so a reload shows what I chose. */
export function myVotes(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(VOTES) ?? "{}") as Record<
      string,
      number
    >;
  } catch {
    return {};
  }
}

export function rememberVote(question: string, option: number): void {
  const all = { ...myVotes(), [question]: option };
  window.localStorage.setItem(VOTES, JSON.stringify(all));
}

export function forgetVotes(): void {
  window.localStorage.removeItem(VOTES);
}

const NAME = "fv3:name";
const UPVOTES = "fv3:upvotes";

/** The display name this phone last used for the Hot Seat. */
export const myName = (): string =>
  typeof window === "undefined"
    ? ""
    : (window.localStorage.getItem(NAME) ?? "");

export const rememberName = (name: string): void =>
  window.localStorage.setItem(NAME, name);

/** The Hot Seat questions this phone has upvoted, so a reload shows them. */
export function myUpvotes(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw: unknown = JSON.parse(
      window.localStorage.getItem(UPVOTES) ?? "[]",
    );
    return Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export const rememberUpvotes = (ids: string[]): void =>
  window.localStorage.setItem(UPVOTES, JSON.stringify(ids));
