import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { IdentityKey } from "@/domain/conference/types";

/**
 * **Who someone is to a conference, with or without a Passport account.**
 *
 * A signed-in Passport user is `user:<id>`, taken from `currentUser()`, the
 * one identity function Passport has. Anybody else who joins gets a random
 * id in an HMAC-signed, httpOnly cookie: `guest:<id>`. So 160 colleagues can
 * follow a link and be in, without making an account first.
 *
 * What that costs, stated so nobody mistakes it for more: lose the cookie
 * (new phone, cleared browser) and the guest's memberships are orphaned until
 * the conference expires or an organiser removes them. Signing in later does
 * not carry them over, because claiming a guest identity is not built.
 *
 * When both exist, the account wins. The guest cookie is ignored, not merged.
 */
export const GUEST_COOKIE = "passport_guest";

/** Browsers cap cookie lifetime at 400 days; a gathering needs far less. */
export const GUEST_COOKIE_DAYS = 180;

const sign = (secret: string, body: string) =>
  createHmac("sha256", secret).update(body).digest("base64url");

export function issueGuest(secret: string): {
  identity: IdentityKey;
  value: string;
} {
  const id = randomUUID();
  return { identity: `guest:${id}`, value: `${id}.${sign(secret, id)}` };
}

export function verifyGuest(
  secret: string,
  value: string | undefined,
): IdentityKey | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = value.slice(0, dot);
  const given = Buffer.from(value.slice(dot + 1));
  const expected = Buffer.from(sign(secret, id));
  return given.length === expected.length && timingSafeEqual(given, expected)
    ? `guest:${id}`
    : null;
}

export function identityFrom(
  userId: string | null,
  guestCookie: string | undefined,
  secret: string,
): IdentityKey | null {
  if (userId) return `user:${userId}`;
  return verifyGuest(secret, guestCookie);
}

export const isGuest = (identity: IdentityKey): boolean =>
  identity.startsWith("guest:");
