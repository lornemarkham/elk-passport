import "server-only";
import type { ConferenceLifecycle } from "@/domain/conference/contracts";
import type { ConferenceSummary } from "@/domain/conference/contracts";
import type { IdentityKey } from "@/domain/conference/types";
import { townById } from "@/domain/discovery/towns";
import {
  boardFor,
  type ArrivalRecord,
  type ArrivalsBoard,
} from "@/domain/conference-arrivals/board";
import {
  readFlight,
  readFlightDate,
} from "@/domain/conference-arrivals/flight";
import type { Airport } from "@/domain/conference-arrivals/matching";
import { NOT_STARTED } from "@/domain/conference-arrivals/tracking";
import { homeFor, updateMe, type Deps } from "@/lib/conference/service";
import type { AdsbSource } from "./adsb-client";
import { airportByCode, arrivalAirportNear } from "./airports";
import type { ArrivalsStore } from "./store";
import { refreshDue } from "./tracker";

/**
 * **The arrivals module's verbs.** Every one starts with the conference
 * foundation's membership check (`homeFor`), so a stranger — or a member of a
 * different conference — gets `null`, which the routes turn into 404, exactly
 * as the foundation answers for a conference that doesn't exist.
 */
export interface ArrivalsDeps {
  readonly conference: Deps;
  readonly store: ArrivalsStore;
  readonly adsb: AdsbSource;
  /** `false`: Arrivals is closed here (see `enabled.ts`); every verb answers as for a stranger. */
  readonly enabled: boolean;
  /** How long a read waits for ADS-B before answering with what it has. */
  readonly budgetMs?: number;
}

/** The conference's airport: derived from its town, never a constant. */
export function arrivalAirportFor(c: ConferenceSummary): Airport | null {
  const town = c.place.townId ? townById(c.place.townId) : undefined;
  return town
    ? arrivalAirportNear({ lat: town.latitude, lon: town.longitude })
    : null;
}

export interface MyFlightForm {
  readonly flight: string;
  readonly date: string;
  readonly from: string;
  readonly shared: boolean;
}

export interface ArrivalsView {
  readonly conferenceId: string;
  readonly place: string;
  readonly you: {
    readonly memberId: string;
    readonly displayName: string | null;
    readonly seen: boolean;
  };
  /** `null` when Passport can't tell which airport this conference flies into. */
  readonly board: ArrivalsBoard | null;
  readonly mine: MyFlightForm | null;
  readonly at: string;
}

async function membership(d: ArrivalsDeps, identity: IdentityKey, id: string) {
  if (!d.enabled) return null;
  const home = await homeFor(d.conference, identity, id);
  if (!home) return null;
  const on = home.conference.modules.includes("arrivals");
  if (!on && home.you.role !== "organiser") return null;
  return home;
}

export async function readArrivals(
  d: ArrivalsDeps,
  identity: IdentityKey,
  conferenceId: string,
): Promise<ArrivalsView | null> {
  const home = await membership(d, identity, conferenceId);
  if (!home) return null;
  const arrival = arrivalAirportFor(home.conference);
  const now = d.conference.now;
  const you = {
    memberId: home.you.memberId,
    displayName: home.you.displayName,
    seen: home.you.visibility === "members",
  };
  let records = await d.store.list(conferenceId);
  if (arrival) {
    await refreshDue(d.store, d.adsb, records, arrival, now, d.budgetMs);
    records = await d.store.list(conferenceId);
  }
  const mine = records.find((r) => r.memberId === you.memberId) ?? null;
  const named = new Map(
    home.people.visible.map((p) => [p.memberId, p.displayName!] as const),
  );
  return {
    conferenceId,
    place: home.conference.place.label,
    you,
    board: arrival ? boardFor(records, arrival, you, named, now) : null,
    mine: mine
      ? {
          flight: mine.flight.ident.display,
          date: mine.flight.date,
          from:
            mine.flight.departure?.iata ?? mine.flight.departure?.icao ?? "",
          shared: mine.shared,
        }
      : null,
    at: now.toISOString(),
  };
}

type Issue = { path: string; message: string };
export type SaveResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly error: "not-found" | "invalid";
      readonly issues?: readonly Issue[];
    };

const DAY = 86_400_000;

/**
 * Save your flight. `shared: true` is the opt-in: it also makes you seen in
 * the conference under `displayName` (the foundation's `members`
 * visibility), because a shared flight with no name on it would be a plane
 * nobody can wave at, and one with a name is exactly that choice.
 */
export async function saveMine(
  d: ArrivalsDeps,
  identity: IdentityKey,
  conferenceId: string,
  body: Record<string, unknown>,
): Promise<SaveResult> {
  const home = await membership(d, identity, conferenceId);
  if (!home) return { ok: false, error: "not-found" };
  const arrival = arrivalAirportFor(home.conference);
  const issues: Issue[] = [];
  const now = d.conference.now;

  const ident = readFlight(String(body.flight ?? ""));
  if (!ident)
    issues.push({
      path: "flight",
      message: "That doesn't look like a flight number. Try AC123.",
    });
  const date = readFlightDate(String(body.date ?? ""));
  const today = Date.parse(now.toISOString().slice(0, 10));
  if (!date)
    issues.push({ path: "date", message: "Pick the day your flight leaves." });
  else if (Date.parse(date) < today - 3 * DAY)
    issues.push({ path: "date", message: "That flight has been and gone." });
  else if (Date.parse(date) > today + 400 * DAY)
    issues.push({ path: "date", message: "That's more than a year away." });

  const fromTyped = String(body.from ?? "").trim();
  const departure = fromTyped ? airportByCode(fromTyped) : null;
  if (fromTyped && !departure)
    issues.push({
      path: "from",
      message:
        "We don't know that airport code. Try the three letters on your ticket, like YYZ.",
    });
  if (departure && arrival && departure.icao === arrival.icao)
    issues.push({
      path: "from",
      message: `That's where you're flying to. Where are you leaving from?`,
    });

  const shared = body.shared === true;
  const typedName =
    typeof body.displayName === "string" ? body.displayName.trim() : "";
  const name = typedName || home.you.displayName || "";
  if (shared && !name)
    issues.push({
      path: "displayName",
      message: "Give a name for people to see on the map.",
    });
  if (name.length > 40)
    issues.push({ path: "displayName", message: "40 characters at most." });
  if (issues.length || !ident || !date)
    return { ok: false, error: "invalid", issues };

  if (
    shared &&
    (home.you.visibility !== "members" || home.you.displayName !== name)
  ) {
    const seen = await updateMe(d.conference, identity, conferenceId, {
      displayName: name,
      visibility: "members",
    });
    if (!seen.ok) return { ok: false, error: "invalid", issues: seen.issues };
  }

  const existing = await d.store.get(conferenceId, home.you.memberId);
  const same =
    existing &&
    existing.flight.ident.display === ident.display &&
    existing.flight.date === date &&
    existing.flight.departure?.icao === departure?.icao;
  const stamp = now.toISOString();
  const record: ArrivalRecord = {
    conferenceId,
    memberId: home.you.memberId,
    flight: { ident, date, departure },
    shared,
    createdAt: existing?.createdAt ?? stamp,
    updatedAt: stamp,
    // A different flight starts over; the same one keeps what ADS-B showed.
    tracking: same ? existing.tracking : NOT_STARTED,
  };
  await d.store.put(record);
  return { ok: true };
}

export async function removeMine(
  d: ArrivalsDeps,
  identity: IdentityKey,
  conferenceId: string,
): Promise<boolean> {
  const home = await membership(d, identity, conferenceId);
  if (!home) return false;
  await d.store.remove(conferenceId, home.you.memberId);
  return true;
}

/** Registered in `src/lib/conference/lifecycle.ts`. */
export const arrivalsLifecycle = (
  store: () => ArrivalsStore,
): ConferenceLifecycle => ({
  module: "arrivals",
  forgetMember: (conferenceId, memberId) =>
    store().remove(conferenceId, memberId),
  forgetConference: (conferenceId) => store().removeConference(conferenceId),
});
