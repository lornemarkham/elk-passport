import "server-only";
import { randomBytes } from "node:crypto";
import { aerodatabox } from "./providers/aerodatabox";
import { demo } from "./providers/demo";
import type { FlightProvider } from "./providers/types";

/**
 * **Everything the Sycle board needs from its environment, read once.**
 *
 * The rule is that production never falls back silently. In development a
 * missing access code becomes `sycle-dev` and a missing secret becomes a
 * per-process random one, so the board can be built with no setup. In
 * production a missing piece makes the experience *closed* and says which
 * piece — a conference board quietly running on an in-memory store, or on
 * demo flights, is worse than one that is visibly not open yet.
 *
 *   SYCLE_ACCESS_CODE        the code colleagues are given
 *   SYCLE_SECRET             ≥ 32 chars; signs the participant cookie
 *   SYCLE_DATA_EXPIRES_AT    ISO instant: every participant record is erased
 *   SYCLE_FLIGHT_PROVIDER    "aerodatabox" | "demo"
 *   AERODATABOX_API_KEY      RapidAPI key, when the provider is aerodatabox
 *   SYCLE_STORE              "memory" — the only store that exists yet; must
 *                            be stated in production (see store.ts)
 */
const dev = process.env.NODE_ENV !== "production";

export interface SycleConfig {
  readonly accessCode: string;
  readonly secret: string;
  readonly expiresAt: Date;
  readonly provider: FlightProvider | null;
}

export type SycleSetup =
  | { readonly open: true; readonly config: SycleConfig }
  | { readonly open: false; readonly missing: readonly string[] };

/**
 * When nobody has said when the data goes, it goes at the end of November.
 * The conference dates were not in the brief; this is a placeholder default,
 * named in the report as a decision for a human, and production refuses to
 * open without the real one.
 */
const DEV_EXPIRY = "2026-11-30T00:00:00Z";

// One per process, not per module: Next bundles pages and route handlers as
// separate module instances, and a cookie signed by one must verify in the
// other (found by trying it — the page kept showing the gate).
const g = globalThis as unknown as { __sycleDevSecret?: string };

function providerFrom(missing: string[]): FlightProvider | null {
  const chosen =
    process.env.SYCLE_FLIGHT_PROVIDER ?? (dev ? "demo" : "aerodatabox");
  if (chosen === "demo") return demo;
  const key = process.env.AERODATABOX_API_KEY;
  if (!key) {
    // Not a reason to close: the board, deletion and adventures all work.
    // Lookup says plainly that it isn't connected.
    missing.push("AERODATABOX_API_KEY");
    return null;
  }
  return aerodatabox(key);
}

export function sycleSetup(): SycleSetup {
  const missing: string[] = [];
  const accessCode = process.env.SYCLE_ACCESS_CODE ?? (dev ? "sycle-dev" : "");
  let secret = process.env.SYCLE_SECRET ?? "";
  if (!secret && dev)
    secret = g.__sycleDevSecret ??= randomBytes(32).toString("hex");
  const expiry = process.env.SYCLE_DATA_EXPIRES_AT ?? (dev ? DEV_EXPIRY : "");
  const expiresAt = new Date(expiry);

  const blocking: string[] = [];
  if (!accessCode) blocking.push("SYCLE_ACCESS_CODE");
  if (secret.length < 32) blocking.push("SYCLE_SECRET");
  if (Number.isNaN(expiresAt.getTime())) blocking.push("SYCLE_DATA_EXPIRES_AT");
  if (!dev && process.env.SYCLE_STORE !== "memory")
    blocking.push("SYCLE_STORE");
  if (blocking.length) return { open: false, missing: blocking };

  return {
    open: true,
    config: { accessCode, secret, expiresAt, provider: providerFrom(missing) },
  };
}
