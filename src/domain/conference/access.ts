import type { ConferenceRole, Invite } from "./types";

/**
 * **Who may do what, and whether a way in still works.** Pure policy; the
 * service applies it.
 */

export const canAdminister = (role: ConferenceRole | undefined): boolean =>
  role === "organiser";

export type InviteState = "valid" | "expired" | "revoked" | "used-up";

export function inviteState(invite: Invite, now: Date): InviteState {
  if (invite.revokedAt) return "revoked";
  if (invite.expiresAt && now.getTime() >= Date.parse(invite.expiresAt))
    return "expired";
  if (invite.maxUses !== null && invite.uses >= invite.maxUses)
    return "used-up";
  return "valid";
}

/**
 * Codes are read off slides and typed on phones, so the alphabet leaves out
 * the characters people confuse — 0/O, 1/I/L — and the format is three short
 * groups: `K7M-2QX-9PA`.
 */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function formatCode(randomIndexes: readonly number[]): string {
  const chars = randomIndexes
    .slice(0, 9)
    .map((n) => CODE_ALPHABET[n % CODE_ALPHABET.length]);
  return [0, 3, 6].map((i) => chars.slice(i, i + 3).join("")).join("-");
}

/** Forgiving: case, spaces and dashes don't matter. */
export const normaliseCode = (typed: string): string =>
  typed.toUpperCase().replace(/[^A-Z0-9]/g, "");
