import "server-only";
import { randomBytes } from "node:crypto";
import type { ConferenceLifecycle } from "@/domain/conference/contracts";
import type { IdentityKey } from "@/domain/conference/types";
import type { MemberHome } from "@/domain/conference/views";
import {
  REACTIONS,
  roomView,
  SaySchema,
  type MessageView,
  type Reaction,
} from "@/domain/conference-chat/chat";
import { canSee, namedMap } from "@/domain/conference-plans/views";
import { homeFor, type Deps } from "@/lib/conference/service";
import type { PlansStore } from "@/lib/conference-plans/store";
import type { ChatStore } from "./store";

/**
 * **The chat's verbs.** Membership first (`homeFor`), then: a plan's thread
 * exists only for people who can see the plan; posting needs a name and
 * being seen; you take back only your own words (organisers can take down
 * anything, which is all moderation is here, as ARCHITECTURE §6.5 proposed).
 */
export interface ChatDeps {
  readonly conference: Deps;
  readonly store: ChatStore;
  readonly plans: PlansStore;
  readonly enabled: boolean;
}

type Fail = "not-found" | "forbidden" | "invalid";
export type ChatResult<T> =
  | ({ ok: true } & T)
  | {
      ok: false;
      error: Fail;
      issues?: readonly { path: string; message: string }[];
    };

async function member(d: ChatDeps, identity: IdentityKey, id: string) {
  if (!d.enabled) return null;
  const home = await homeFor(d.conference, identity, id);
  if (!home) return null;
  if (
    !home.conference.modules.includes("community") &&
    home.you.role !== "organiser"
  )
    return null;
  return home;
}

/** `null` = the conference room. A plan id = its thread, if you may see the plan. */
async function roomFor(
  d: ChatDeps,
  home: MemberHome,
  room: unknown,
): Promise<{ id: string | null; title: string | null } | null> {
  if (room === null || room === undefined || room === "")
    return { id: null, title: null };
  if (typeof room !== "string") return null;
  const plan = (await d.plans.plans(home.conference.id)).find(
    (p) => p.id === room,
  );
  return plan && canSee(plan, home.you.memberId)
    ? { id: plan.id, title: plan.title }
    : null;
}

export interface RoomView {
  readonly room: string | null;
  readonly title: string | null;
  readonly messages: readonly MessageView[];
  /** People you can see in the conference (the roster rule), you excluded. */
  readonly people: readonly string[];
  readonly you: { readonly name: string | null; readonly canPost: boolean };
  readonly at: string;
}

export async function readRoom(
  d: ChatDeps,
  identity: IdentityKey,
  conferenceId: string,
  room: unknown,
): Promise<RoomView | null> {
  const home = await member(d, identity, conferenceId);
  if (!home) return null;
  const r = await roomFor(d, home, room);
  if (!r) return null;
  const messages = await d.store.room(conferenceId, r.id);
  const reactions = await d.store.reactions(
    conferenceId,
    messages.map((m) => m.id),
  );
  return {
    room: r.id,
    title: r.title,
    messages: roomView(
      messages,
      reactions,
      { memberId: home.you.memberId, role: home.you.role },
      namedMap(home.people.visible, home.you),
    ),
    people: home.people.visible
      .map((p) => p.displayName)
      .filter((n): n is string => !!n),
    you: {
      name: home.you.displayName,
      canPost: home.you.visibility === "members" && !!home.you.displayName,
    },
    at: d.conference.now.toISOString(),
  };
}

export async function say(
  d: ChatDeps,
  identity: IdentityKey,
  conferenceId: string,
  input: unknown,
): Promise<ChatResult<{ id: string }>> {
  const home = await member(d, identity, conferenceId);
  if (!home) return { ok: false, error: "not-found" };
  const parsed = SaySchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: "invalid",
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    };
  const r = await roomFor(d, home, parsed.data.planId ?? null);
  if (!r) return { ok: false, error: "not-found" };
  if (home.you.visibility !== "members" || !home.you.displayName)
    return {
      ok: false,
      error: "forbidden",
      issues: [
        { path: "you", message: "Choose a name and to be seen to post." },
      ],
    };
  const id = randomBytes(9).toString("base64url");
  await d.store.say({
    id,
    conferenceId,
    memberId: home.you.memberId,
    planId: r.id,
    body: parsed.data.body,
    at: d.conference.now.toISOString(),
  });
  return { ok: true, id };
}

async function findMessage(
  d: ChatDeps,
  home: MemberHome,
  room: unknown,
  messageId: unknown,
) {
  const r = await roomFor(d, home, room);
  if (!r || typeof messageId !== "string") return null;
  return (
    (await d.store.room(home.conference.id, r.id)).find(
      (m) => m.id === messageId,
    ) ?? null
  );
}

export async function unsay(
  d: ChatDeps,
  identity: IdentityKey,
  conferenceId: string,
  input: { room?: unknown; messageId?: unknown },
): Promise<ChatResult<object>> {
  const home = await member(d, identity, conferenceId);
  if (!home) return { ok: false, error: "not-found" };
  const m = await findMessage(d, home, input.room ?? null, input.messageId);
  if (!m) return { ok: false, error: "not-found" };
  if (m.memberId !== home.you.memberId && home.you.role !== "organiser")
    return { ok: false, error: "forbidden" };
  await d.store.unsay(conferenceId, m.id);
  return { ok: true };
}

export async function react(
  d: ChatDeps,
  identity: IdentityKey,
  conferenceId: string,
  input: { room?: unknown; messageId?: unknown; emoji?: unknown },
): Promise<ChatResult<object>> {
  const home = await member(d, identity, conferenceId);
  if (!home) return { ok: false, error: "not-found" };
  if (!REACTIONS.includes(input.emoji as Reaction))
    return { ok: false, error: "invalid" };
  const m = await findMessage(d, home, input.room ?? null, input.messageId);
  if (!m) return { ok: false, error: "not-found" };
  const r = {
    messageId: m.id,
    memberId: home.you.memberId,
    emoji: input.emoji as Reaction,
  };
  const already = (await d.store.reactions(conferenceId, [m.id])).some(
    (x) => x.memberId === r.memberId && x.emoji === r.emoji,
  );
  await d.store.react(conferenceId, r, !already);
  return { ok: true };
}

export function chatLifecycle(store: () => ChatStore): ConferenceLifecycle {
  return {
    module: "community",
    forgetMember: (c, m) => store().forgetMember(c, m),
    forgetConference: (c) => store().forgetConference(c),
  };
}
