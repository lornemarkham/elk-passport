import "server-only";
import { randomUUID } from "node:crypto";
import {
  boardFor,
  flightKey,
  interestFor,
  readDisplayName,
  type AdventureInterest,
  type Board,
  type Participant,
  type Visibility,
} from "@/domain/sycle/board";
import {
  landsInVancouver,
  readFlightDate,
  readFlightNumber,
  type FlightRecord,
} from "@/domain/sycle/flight";
import { isStale } from "@/domain/sycle/refresh";
import type { SycleConfig } from "./config";
import { store } from "./store";

/**
 * **The board's verbs.** Route handlers authenticate and parse; this file
 * decides. Every read purges first (see `store.ts`).
 */

const inflight = new Map<string, Promise<FlightRecord | null>>();

/** Recent lookups, so retyping the same flight does not spend twice. */
const lookups = new Map<string, { at: number; flights: FlightRecord[] }>();
const LOOKUP_TTL = 10 * 60_000;

export type LookupResult =
  | { readonly ok: true; readonly flights: readonly FlightRecord[] }
  | {
      readonly ok: false;
      readonly reason: "invalid" | "not-connected" | "provider-failed";
    };

export async function lookUp(
  config: SycleConfig,
  typedNumber: unknown,
  typedDate: unknown,
): Promise<LookupResult> {
  const number = readFlightNumber(String(typedNumber ?? ""));
  const date = readFlightDate(String(typedDate ?? ""));
  if (!number || !date) return { ok: false, reason: "invalid" };
  if (!config.provider) return { ok: false, reason: "not-connected" };
  const key = flightKey(number, date);
  const hit = lookups.get(key);
  if (hit && Date.now() - hit.at < LOOKUP_TTL)
    return { ok: true, flights: hit.flights };
  try {
    const flights = await config.provider.lookup(number, date);
    lookups.set(key, { at: Date.now(), flights });
    return { ok: true, flights };
  } catch (error) {
    console.error("[sycle] lookup failed", number, date, error);
    return { ok: false, reason: "provider-failed" };
  }
}

/** Refresh one flight if stale. Failure keeps the old record, stamped. */
async function fresh(config: SycleConfig, key: string, now: Date) {
  const s = store();
  const current = await s.flight(key);
  if (!current || !config.provider || current.source !== config.provider.name)
    return current;
  if (!isStale(current, now)) return current;
  let pending = inflight.get(key);
  if (!pending) {
    pending = config.provider
      .lookup(current.flightNumber, current.date)
      .then(async (found) => {
        const same =
          found.find((f) => f.key === current.key) ??
          found.find(landsInVancouver);
        if (same) await s.putFlight(key, same);
        return same ?? current;
      })
      .catch((error) => {
        console.error("[sycle] refresh failed", key, error);
        return current;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }
  return pending;
}

export interface BoardView {
  readonly board: Board;
  readonly me: Participant | null;
  readonly interest: ReadonlyMap<string, AdventureInterest>;
  readonly expiresAt: string;
}

export async function readBoard(
  config: SycleConfig,
  viewerId: string | null,
  now = new Date(),
): Promise<BoardView> {
  const s = store();
  await s.purge(now, config.expiresAt);
  const people = await s.participants();
  const keys = [
    ...new Set(
      people
        .filter((p) => p.flight)
        .map((p) => flightKey(p.flight!.flightNumber, p.flight!.date)),
    ),
  ];
  const flights = new Map<string, FlightRecord>();
  // Bounded: a cold board with 200 stale legs must not fire 200 calls at once.
  for (let i = 0; i < keys.length; i += 6) {
    const batch = keys.slice(i, i + 6);
    const got = await Promise.all(batch.map((k) => fresh(config, k, now)));
    batch.forEach((k, j) => got[j] && flights.set(k, got[j]!));
  }
  return {
    board: boardFor(people, flights, viewerId, now),
    me: people.find((p) => p.id === viewerId) ?? null,
    interest: interestFor(people, viewerId),
    expiresAt: config.expiresAt.toISOString(),
  };
}

const VISIBILITY: readonly Visibility[] = ["named", "anonymous", "off"];

export type SaveResult =
  | { readonly ok: true; readonly me: Participant }
  | { readonly ok: false; readonly reason: string };

/**
 * Save your flight and how you appear. The flight must be one this server
 * itself looked up in the last ten minutes — a browser cannot post a
 * `FlightRecord` and have it believed.
 */
export async function saveMine(
  config: SycleConfig,
  viewerId: string,
  body: Record<string, unknown>,
): Promise<SaveResult> {
  const s = store();
  const existing = await s.participant(viewerId);
  const visibility = VISIBILITY.includes(body.visibility as Visibility)
    ? (body.visibility as Visibility)
    : (existing?.visibility ?? "off");
  const displayName =
    "displayName" in body
      ? readDisplayName(body.displayName)
      : (existing?.displayName ?? null);
  if (visibility === "named" && !displayName)
    return { ok: false, reason: "A name is needed to appear by name." };

  let flight = existing?.flight ?? null;
  if (typeof body.flightKey === "string") {
    const number = readFlightNumber(String(body.flightNumber ?? ""));
    const date = readFlightDate(String(body.date ?? ""));
    const found =
      number && date ? lookups.get(flightKey(number, date)) : undefined;
    const chosen = found?.flights.find((f) => f.key === body.flightKey);
    if (!chosen || !number || !date)
      return {
        ok: false,
        reason: "Look the flight up again — that one has gone stale.",
      };
    if (!landsInVancouver(chosen))
      return { ok: false, reason: "The board is for flights landing at YVR." };
    await s.putFlight(flightKey(number, date), chosen);
    flight = { flightNumber: number, date };
  }
  if (body.flightKey === null) flight = null;

  const now = new Date().toISOString();
  const me: Participant = {
    id: viewerId,
    boardId: existing?.boardId ?? randomUUID().slice(0, 12),
    displayName,
    visibility,
    flight,
    adventures: existing?.adventures ?? [],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await s.putParticipant(me);
  return { ok: true, me };
}

/** Everything about you, gone. Not hidden; gone. */
export async function forgetMe(viewerId: string): Promise<void> {
  await store().removeParticipant(viewerId);
}

export async function setInterest(
  viewerId: string,
  adventureId: unknown,
  isIn: boolean,
): Promise<boolean> {
  if (typeof adventureId !== "string" || !/^\S{1,160}$/.test(adventureId))
    return false;
  const s = store();
  const now = new Date().toISOString();
  const existing = await s.participant(viewerId);
  const base: Participant = existing ?? {
    id: viewerId,
    boardId: randomUUID().slice(0, 12),
    displayName: null,
    visibility: "off",
    flight: null,
    adventures: [],
    createdAt: now,
    updatedAt: now,
  };
  const set = new Set(base.adventures);
  if (isIn) set.add(adventureId);
  else set.delete(adventureId);
  if (set.size > 40) return false;
  await s.putParticipant({ ...base, adventures: [...set], updatedAt: now });
  return true;
}
