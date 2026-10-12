import "server-only";
import { randomBytes } from "node:crypto";

/**
 * **What the conference foundation needs from its environment, read once.**
 *
 * Production never falls back silently. A missing secret or an unstated
 * store makes conferences *closed*, and says which piece is missing. A
 * private group space quietly running on per-instance memory would lose
 * people's memberships on a cold start, which is worse than one that is
 * visibly not open yet.
 *
 *   CONFERENCE_STORE             "memory" or "supabase". Production refuses
 *                                to open until it is stated (see store.ts).
 *                                Development defaults to memory.
 *                                "supabase" is durable and shared, runs as
 *                                the signed-in person, and has NO GUESTS:
 *                                everyone needs a Passport account
 *   CONFERENCE_SECRET            ≥ 32 chars; signs the guest cookie. Only
 *                                the memory store has guests
 *   CONFERENCE_GUEST_ORGANISERS  "1" lets people without a Passport account
 *                                create conferences (memory store only).
 *                                Default: on in development, off in
 *                                production. Provisional (ROADMAP D2)
 */
const dev = process.env.NODE_ENV !== "production";

export type StoreKind = "memory" | "supabase";

export interface ConferenceConfig {
  readonly store: StoreKind;
  /** Whether somebody without a Passport account can be a member at all. */
  readonly guests: boolean;
  readonly secret: string;
  readonly allowGuestOrganisers: boolean;
}

export type ConferenceSetup =
  | { readonly open: true; readonly config: ConferenceConfig }
  | { readonly open: false; readonly missing: readonly string[] };

// One per process, not per module instance: Next bundles pages and route
// handlers separately, and a cookie signed by one must verify in the other.
const g = globalThis as unknown as { __conferenceDevSecret?: string };

export function conferenceSetup(
  env: Readonly<Record<string, string | undefined>> = process.env,
  isDev = dev,
): ConferenceSetup {
  const stated = env.CONFERENCE_STORE;
  const missing: string[] = [];
  if (stated !== undefined && stated !== "memory" && stated !== "supabase")
    missing.push("CONFERENCE_STORE (memory or supabase)");
  else if (!isDev && stated === undefined) missing.push("CONFERENCE_STORE");
  const store: StoreKind = stated === "supabase" ? "supabase" : "memory";

  // Guests are signed with a secret. A store with no guests needs none.
  let secret = env.CONFERENCE_SECRET ?? "";
  if (store === "memory") {
    if (!secret && isDev)
      secret = g.__conferenceDevSecret ??= randomBytes(32).toString("hex");
    if (secret.length < 32) missing.push("CONFERENCE_SECRET");
  }
  if (missing.length) return { open: false, missing };

  const guests = store === "memory";
  const organisers = env.CONFERENCE_GUEST_ORGANISERS;
  return {
    open: true,
    config: {
      store,
      guests,
      secret,
      allowGuestOrganisers:
        guests && (organisers === undefined ? isDev : organisers === "1"),
    },
  };
}
