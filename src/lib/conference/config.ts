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
 *   CONFERENCE_SECRET            ≥ 32 chars; signs the guest cookie
 *   CONFERENCE_STORE             "memory": the only store that exists yet.
 *                                Production refuses to open until it is
 *                                stated (see store.ts)
 *   CONFERENCE_GUEST_ORGANISERS  "1" lets people without a Passport account
 *                                create conferences. Default: on in
 *                                development (no Supabase here), off in
 *                                production. Provisional (ROADMAP D2)
 */
const dev = process.env.NODE_ENV !== "production";

export interface ConferenceConfig {
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
  let secret = env.CONFERENCE_SECRET ?? "";
  if (!secret && isDev)
    secret = g.__conferenceDevSecret ??= randomBytes(32).toString("hex");

  const missing: string[] = [];
  if (secret.length < 32) missing.push("CONFERENCE_SECRET");
  if (!isDev && env.CONFERENCE_STORE !== "memory")
    missing.push("CONFERENCE_STORE");
  if (missing.length) return { open: false, missing };

  const guests = env.CONFERENCE_GUEST_ORGANISERS;
  return {
    open: true,
    config: {
      secret,
      allowGuestOrganisers: guests === undefined ? isDev : guests === "1",
    },
  };
}
