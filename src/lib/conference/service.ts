import { randomBytes, randomInt } from "node:crypto";
import {
  canAdminister,
  CODE_ALPHABET,
  formatCode,
  type InviteState,
} from "@/domain/conference/access";
import type {
  ConferenceContext,
  ConferenceLifecycle,
  ConferenceSummary,
} from "@/domain/conference/contracts";
import { parseDetails, retainUntilFor } from "@/domain/conference/details";
import type {
  Conference,
  ConferenceRole,
  IdentityKey,
  Invite,
  Membership,
  Visibility,
} from "@/domain/conference/types";
import {
  memberHome,
  organiserView,
  summaryOf,
  viewerOf,
  type MemberHome,
  type OrganiserView,
} from "@/domain/conference/views";
import type { ConferenceStore } from "./store";

/**
 * **Every conference operation, as a function of (deps, who, input).**
 *
 * No cookies, no requests, no clock. Route handlers and pages supply those,
 * and tests supply their own, so every rule here is exercised without a
 * server.
 *
 * Two habits run through it:
 *
 * - **Not a member reads as not found.** Whether a conference exists is
 *   itself private, so a stranger asking about one gets the same answer as
 *   somebody asking about nothing.
 * - **Every read purges first.** A conference past its retention date, and
 *   everything every module holds about it, is gone before anybody can read
 *   it (ARCHITECTURE.md §7).
 */
export interface Deps {
  readonly store: ConferenceStore;
  readonly lifecycle: readonly ConferenceLifecycle[];
  readonly now: Date;
}

export type Failure =
  | "not-found"
  | "forbidden"
  | "invalid"
  | "wrong-code"
  | "dead-link"
  | "last-organiser";

type Issues = readonly { path: string; message: string }[];

export type Result<T> =
  | ({ readonly ok: true } & T)
  | { readonly ok: false; readonly error: Failure; readonly issues?: Issues };

const fail = (error: Failure, issues?: Issues) =>
  ({ ok: false, error, ...(issues ? { issues } : {}) }) as const;

const token = (bytes: number) => randomBytes(bytes).toString("base64url");

async function purge(deps: Deps): Promise<void> {
  for (const id of await deps.store.expired(deps.now)) {
    await Promise.all(deps.lifecycle.map((l) => l.forgetConference(id)));
    await deps.store.removeConference(id);
  }
}

async function membershipIn(
  deps: Deps,
  conferenceId: string,
  identity: IdentityKey,
): Promise<{ conference: Conference; you: Membership } | null> {
  await purge(deps);
  const conference = await deps.store.conference(conferenceId);
  if (!conference) return null;
  const you = (await deps.store.membershipsOf(identity)).find(
    (m) => m.conferenceId === conferenceId,
  );
  return you ? { conference, you } : null;
}

async function asOrganiser(
  deps: Deps,
  conferenceId: string,
  identity: IdentityKey,
): Promise<
  | { ok: true; conference: Conference; you: Membership }
  | { ok: false; error: "not-found" | "forbidden" }
> {
  const found = await membershipIn(deps, conferenceId, identity);
  if (!found) return { ok: false, error: "not-found" };
  if (!canAdminister(found.you.role)) return { ok: false, error: "forbidden" };
  return { ok: true, ...found };
}

function newMembership(
  conferenceId: string,
  identity: IdentityKey,
  role: ConferenceRole,
  via: Membership["via"],
  now: Date,
  displayName: string | null = null,
): Membership {
  return {
    conferenceId,
    identity,
    memberId: token(9),
    role,
    displayName,
    // Private by default: in, and seen by nobody but organisers.
    visibility: "hidden",
    joinedAt: now.toISOString(),
    via,
  };
}

// ── Creating and configuring ────────────────────────────────────────────

export async function createConference(
  deps: Deps,
  identity: IdentityKey,
  input: unknown,
): Promise<Result<{ conference: ConferenceSummary }>> {
  const parsed = parseDetails(input);
  if (!parsed.ok) return fail("invalid", parsed.issues);
  const at = deps.now.toISOString();
  const conference: Conference = {
    id: token(12),
    details: parsed.details,
    createdAt: at,
    updatedAt: at,
    accessCode: null,
    retainUntil: retainUntilFor(parsed.details),
  };
  await deps.store.putConference(conference);
  await deps.store.putMembership(
    newMembership(conference.id, identity, "organiser", "created", deps.now),
  );
  return { ok: true, conference: summaryOf(conference) };
}

export async function updateConference(
  deps: Deps,
  identity: IdentityKey,
  conferenceId: string,
  input: unknown,
): Promise<Result<{ conference: ConferenceSummary }>> {
  const access = await asOrganiser(deps, conferenceId, identity);
  if (!access.ok) return fail(access.error);
  // The agenda has its own editor. A details form that doesn't mention it
  // leaves it as it is; `agenda: []` is how it is cleared.
  const merged =
    input && typeof input === "object" && !("agenda" in input)
      ? { ...input, agenda: access.conference.details.agenda }
      : input;
  const parsed = parseDetails(merged);
  if (!parsed.ok) return fail("invalid", parsed.issues);
  const conference: Conference = {
    ...access.conference,
    details: parsed.details,
    updatedAt: deps.now.toISOString(),
    retainUntil: retainUntilFor(parsed.details),
  };
  await deps.store.putConference(conference);
  return { ok: true, conference: summaryOf(conference) };
}

export async function deleteConference(
  deps: Deps,
  identity: IdentityKey,
  conferenceId: string,
): Promise<Result<object>> {
  const access = await asOrganiser(deps, conferenceId, identity);
  if (!access.ok) return fail(access.error);
  await Promise.all(
    deps.lifecycle.map((l) => l.forgetConference(conferenceId)),
  );
  await deps.store.removeConference(conferenceId);
  return { ok: true };
}

// ── Ways in ─────────────────────────────────────────────────────────────

/** `"new"` issues a fresh code (the old one stops working); `"off"` turns codes off. */
export async function setAccessCode(
  deps: Deps,
  identity: IdentityKey,
  conferenceId: string,
  action: "new" | "off",
): Promise<Result<{ accessCode: string | null }>> {
  const access = await asOrganiser(deps, conferenceId, identity);
  if (!access.ok) return fail(access.error);
  let code: string | null = null;
  if (action === "new") {
    do {
      code = formatCode(
        Array.from({ length: 9 }, () => randomInt(CODE_ALPHABET.length)),
      );
    } while (await deps.store.codeTaken(code));
  }
  await deps.store.putConference({
    ...access.conference,
    accessCode: code,
    updatedAt: deps.now.toISOString(),
  });
  return { ok: true, accessCode: code };
}

export async function createInvite(
  deps: Deps,
  identity: IdentityKey,
  conferenceId: string,
  options: { expiresInDays?: unknown; maxUses?: unknown } = {},
): Promise<Result<{ invite: Invite }>> {
  const access = await asOrganiser(deps, conferenceId, identity);
  if (!access.ok) return fail(access.error);
  const days = options.expiresInDays ?? null;
  const uses = options.maxUses ?? null;
  const whole = (n: unknown, max: number) =>
    Number.isInteger(n) && (n as number) >= 1 && (n as number) <= max;
  if (
    (days !== null && !whole(days, 365)) ||
    (uses !== null && !whole(uses, 10_000))
  )
    return fail("invalid", [
      { path: "invite", message: "Days 1–365 and uses 1–10,000, or none." },
    ]);
  const invite: Invite = {
    token: token(32),
    conferenceId,
    createdAt: deps.now.toISOString(),
    expiresAt:
      days === null
        ? null
        : new Date(
            deps.now.getTime() + (days as number) * 86_400_000,
          ).toISOString(),
    revokedAt: null,
    maxUses: uses as number | null,
    uses: 0,
  };
  await deps.store.putInvite(invite);
  return { ok: true, invite };
}

/** People already admitted through the link stay; removing them is separate. */
export async function revokeInvite(
  deps: Deps,
  identity: IdentityKey,
  conferenceId: string,
  inviteToken: string,
): Promise<Result<object>> {
  const access = await asOrganiser(deps, conferenceId, identity);
  if (!access.ok) return fail(access.error);
  const invite = await deps.store.invite(inviteToken);
  if (!invite || invite.conferenceId !== conferenceId) return fail("not-found");
  await deps.store.putInvite({ ...invite, revokedAt: deps.now.toISOString() });
  return { ok: true };
}

export interface InviteLanding {
  readonly state: InviteState;
  /** Only for a working link, and never who else is in. */
  readonly conference?: Pick<
    ConferenceSummary,
    | "name"
    | "kind"
    | "tagline"
    | "place"
    | "startsOn"
    | "endsOn"
    | "branding"
    | "timeZone"
  >;
}

/**
 * What a link offers somebody who has not joined. A working link is a
 * credential the organiser handed out, so it may say what it is an invitation
 * *to*. A dead one says only that it is dead.
 */
export async function describeInvite(
  deps: Deps,
  inviteToken: string,
): Promise<InviteLanding | null> {
  await purge(deps);
  const found = await deps.store.describeInvite(inviteToken, deps.now);
  if (!found) return null;
  if (found.state !== "valid" || !found.details) return { state: found.state };
  const { name, kind, tagline, place, startsOn, endsOn, branding, timeZone } =
    found.details;
  return {
    state: found.state,
    conference: {
      name,
      kind,
      tagline,
      place,
      startsOn,
      endsOn,
      branding,
      timeZone,
    },
  };
}

/**
 * Join with a code. Idempotent: the same person typing it twice lands in the
 * same membership. A conference with codes off matches nothing.
 */
export async function joinWithCode(
  deps: Deps,
  identity: IdentityKey,
  code: unknown,
): Promise<Result<{ conferenceId: string }>> {
  if (typeof code !== "string") return fail("wrong-code");
  await purge(deps);
  const id = await deps.store.redeemCode(identity, code, token(9), deps.now);
  return id ? { ok: true, conferenceId: id } : fail("wrong-code");
}

/**
 * Join with a link. Somebody already in is let through even on a dead link,
 * because following an old invitation should take you home, not lecture you.
 */
export async function joinWithInvite(
  deps: Deps,
  identity: IdentityKey,
  inviteToken: unknown,
): Promise<Result<{ conferenceId: string }>> {
  if (typeof inviteToken !== "string") return fail("dead-link");
  await purge(deps);
  const id = await deps.store.redeemInvite(
    identity,
    inviteToken,
    token(9),
    deps.now,
  );
  return id ? { ok: true, conferenceId: id } : fail("dead-link");
}

// ── Being in it ─────────────────────────────────────────────────────────

export async function updateMe(
  deps: Deps,
  identity: IdentityKey,
  conferenceId: string,
  input: { displayName?: unknown; visibility?: unknown },
): Promise<Result<{ you: ReturnType<typeof viewerOf> }>> {
  const found = await membershipIn(deps, conferenceId, identity);
  if (!found) return fail("not-found");
  const name =
    typeof input.displayName === "string" ? input.displayName.trim() : "";
  const visibility = input.visibility;
  if (name.length > 40)
    return fail("invalid", [
      { path: "displayName", message: "40 characters at most." },
    ]);
  if (visibility !== "hidden" && visibility !== "members")
    return fail("invalid", [
      { path: "visibility", message: "hidden or members." },
    ]);
  if (visibility === "members" && !name)
    return fail("invalid", [
      { path: "displayName", message: "Give a name to be seen by." },
    ]);
  const updated: Membership = {
    ...found.you,
    displayName: name || null,
    visibility: visibility as Visibility,
  };
  await deps.store.putMembership(updated);
  return { ok: true, you: viewerOf(updated) };
}

async function forget(deps: Deps, conferenceId: string, memberId: string) {
  await Promise.all(
    deps.lifecycle.map((l) => l.forgetMember(conferenceId, memberId)),
  );
  await deps.store.removeMembership(conferenceId, memberId);
}

/** Leave, and be forgotten by every module. The last organiser can't. */
export async function leave(
  deps: Deps,
  identity: IdentityKey,
  conferenceId: string,
): Promise<Result<object>> {
  const found = await membershipIn(deps, conferenceId, identity);
  if (!found) return fail("not-found");
  if (found.you.role === "organiser") {
    const others = (await deps.store.memberships(conferenceId)).filter(
      (m) => m.role === "organiser" && m.memberId !== found.you.memberId,
    );
    if (others.length === 0) return fail("last-organiser");
  }
  await forget(deps, conferenceId, found.you.memberId);
  return { ok: true };
}

export async function removeMember(
  deps: Deps,
  identity: IdentityKey,
  conferenceId: string,
  memberId: string,
): Promise<Result<object>> {
  const access = await asOrganiser(deps, conferenceId, identity);
  if (!access.ok) return fail(access.error);
  if (memberId === access.you.memberId) return fail("forbidden");
  const target = (await deps.store.memberships(conferenceId)).find(
    (m) => m.memberId === memberId,
  );
  if (!target) return fail("not-found");
  await forget(deps, conferenceId, memberId);
  return { ok: true };
}

// ── Reading ─────────────────────────────────────────────────────────────

export async function homeFor(
  deps: Deps,
  identity: IdentityKey,
  conferenceId: string,
): Promise<MemberHome | null> {
  const found = await membershipIn(deps, conferenceId, identity);
  if (!found) return null;
  const [memberships, total] = await Promise.all([
    deps.store.memberships(conferenceId),
    deps.store.headcount(conferenceId),
  ]);
  return memberHome(found.conference, memberships, found.you, total);
}

export async function adminFor(
  deps: Deps,
  identity: IdentityKey,
  conferenceId: string,
): Promise<Result<{ view: OrganiserView }>> {
  const access = await asOrganiser(deps, conferenceId, identity);
  if (!access.ok) return fail(access.error);
  const [memberships, invites, total] = await Promise.all([
    deps.store.memberships(conferenceId),
    deps.store.invites(conferenceId),
    deps.store.headcount(conferenceId),
  ]);
  return {
    ok: true,
    view: organiserView(
      access.conference,
      memberships,
      invites,
      access.you,
      deps.now,
      total,
    ),
  };
}

/** What a module is handed (ARCHITECTURE.md §6.1). `null` for non-members. */
export async function contextFor(
  deps: Deps,
  identity: IdentityKey,
  conferenceId: string,
): Promise<ConferenceContext | null> {
  const found = await membershipIn(deps, conferenceId, identity);
  if (!found) return null;
  return {
    conference: summaryOf(found.conference),
    viewer: viewerOf(found.you),
    now: deps.now,
  };
}

export async function conferencesOf(
  deps: Deps,
  identity: IdentityKey,
): Promise<{ conference: ConferenceSummary; role: ConferenceRole }[]> {
  await purge(deps);
  const mine = await deps.store.membershipsOf(identity);
  const rows = await Promise.all(
    mine.map(async (m) => {
      const c = await deps.store.conference(m.conferenceId);
      return c ? { conference: summaryOf(c), role: m.role } : null;
    }),
  );
  return rows
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => a.conference.startsOn.localeCompare(b.conference.startsOn));
}
