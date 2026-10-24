import "server-only";
import type { ConferenceLifecycle } from "@/domain/conference/contracts";
import type { IdentityKey } from "@/domain/conference/types";
import {
  MoveSchema,
  peopleHere,
  round4,
  ShareSchema,
  type PersonHere,
} from "@/domain/conference-people/people";
import { namedMap } from "@/domain/conference-plans/views";
import { homeFor, type Deps } from "@/lib/conference/service";
import type { PeopleStore } from "./store";

/**
 * **Find my people's verbs.** Membership first; sharing needs a name and
 * being seen; every read purges what has expired before it reads.
 */
export interface PeopleDeps {
  readonly conference: Deps;
  readonly store: PeopleStore;
  readonly enabled: boolean;
}

type Fail = "not-found" | "forbidden" | "invalid";
export type PeopleResult<T> =
  | ({ ok: true } & T)
  | {
      ok: false;
      error: Fail;
      issues?: readonly { path: string; message: string }[];
    };

async function member(d: PeopleDeps, identity: IdentityKey, id: string) {
  if (!d.enabled) return null;
  const home = await homeFor(d.conference, identity, id);
  if (!home) return null;
  if (
    !home.conference.modules.includes("people") &&
    home.you.role !== "organiser"
  )
    return null;
  return home;
}

export interface PeopleView {
  readonly people: readonly PersonHere[];
  readonly you: {
    readonly sharing: boolean;
    readonly expiresAt: string | null;
    readonly canShare: boolean;
    readonly name: string | null;
  };
  readonly at: string;
}

export async function readPeople(
  d: PeopleDeps,
  identity: IdentityKey,
  conferenceId: string,
): Promise<PeopleView | null> {
  const home = await member(d, identity, conferenceId);
  if (!home) return null;
  await d.store.purge(d.conference.now);
  const people = peopleHere(
    await d.store.list(conferenceId),
    home.you.memberId,
    namedMap(home.people.visible, home.you),
    d.conference.now,
  );
  const mine = people.find((p) => p.you);
  return {
    people,
    you: {
      sharing: !!mine,
      expiresAt: mine?.expiresAt ?? null,
      canShare: home.you.visibility === "members" && !!home.you.displayName,
      name: home.you.displayName,
    },
    at: d.conference.now.toISOString(),
  };
}

const issues = (e: { issues: { path: PropertyKey[]; message: string }[] }) =>
  e.issues.map((i) => ({ path: i.path.join("."), message: i.message }));

/** Start sharing, or start again with a new length. */
export async function share(
  d: PeopleDeps,
  identity: IdentityKey,
  conferenceId: string,
  input: unknown,
): Promise<PeopleResult<{ expiresAt: string }>> {
  const home = await member(d, identity, conferenceId);
  if (!home) return { ok: false, error: "not-found" };
  if (home.you.visibility !== "members" || !home.you.displayName)
    return {
      ok: false,
      error: "forbidden",
      issues: [{ path: "you", message: "Choose a name and to be seen first." }],
    };
  const p = ShareSchema.safeParse(input);
  if (!p.success)
    return { ok: false, error: "invalid", issues: issues(p.error) };
  const now = d.conference.now;
  const expiresAt = new Date(
    now.getTime() + p.data.minutes * 60_000,
  ).toISOString();
  await d.store.put({
    conferenceId,
    memberId: home.you.memberId,
    lat: round4(p.data.lat),
    lon: round4(p.data.lon),
    accuracyM:
      p.data.accuracy == null
        ? null
        : Math.min(5000, Math.round(p.data.accuracy)),
    note: p.data.note,
    startedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt,
  });
  return { ok: true, expiresAt };
}

/** A new position while already sharing. Never extends the share. */
export async function move(
  d: PeopleDeps,
  identity: IdentityKey,
  conferenceId: string,
  input: unknown,
): Promise<PeopleResult<object>> {
  const home = await member(d, identity, conferenceId);
  if (!home) return { ok: false, error: "not-found" };
  const p = MoveSchema.safeParse(input);
  if (!p.success)
    return { ok: false, error: "invalid", issues: issues(p.error) };
  await d.store.purge(d.conference.now);
  const mine = (await d.store.list(conferenceId)).find(
    (l) => l.memberId === home.you.memberId,
  );
  // Not sharing (stopped, or it ran out): a stray update shares nothing.
  if (!mine) return { ok: false, error: "not-found" };
  if (home.you.visibility !== "members") {
    await d.store.remove(conferenceId, home.you.memberId);
    return { ok: false, error: "forbidden" };
  }
  await d.store.put({
    ...mine,
    lat: round4(p.data.lat),
    lon: round4(p.data.lon),
    accuracyM:
      p.data.accuracy == null
        ? null
        : Math.min(5000, Math.round(p.data.accuracy)),
    updatedAt: d.conference.now.toISOString(),
  });
  return { ok: true };
}

export async function stop(
  d: PeopleDeps,
  identity: IdentityKey,
  conferenceId: string,
): Promise<PeopleResult<object>> {
  const home = await member(d, identity, conferenceId);
  if (!home) return { ok: false, error: "not-found" };
  await d.store.remove(conferenceId, home.you.memberId);
  return { ok: true };
}

export function peopleLifecycle(store: () => PeopleStore): ConferenceLifecycle {
  return {
    module: "people",
    forgetMember: (c, m) => store().remove(c, m),
    forgetConference: (c) => store().forgetConference(c),
  };
}
