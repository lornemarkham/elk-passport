import "server-only";
import { randomBytes } from "node:crypto";
import type { ConferenceLifecycle } from "@/domain/conference/contracts";
import type { IdentityKey } from "@/domain/conference/types";
import type { MemberHome } from "@/domain/conference/views";
import { parsePlanInput, type Issues } from "@/domain/conference-plans/plan";
import {
  ANSWERS,
  LIMITS,
  type Answer,
  type Plan,
} from "@/domain/conference-plans/types";
import {
  canSee,
  namedMap,
  orderPlans,
  planView,
  type PlaceLookup,
  type PlanView,
} from "@/domain/conference-plans/views";
import { homeFor, type Deps } from "@/lib/conference/service";
import type { PlansStore } from "./store";

/**
 * **The plans module's verbs.** Every one starts with the foundation's
 * membership check (`homeFor`), so a stranger, a member of another
 * conference, or a member who can't see a `selected` plan gets the same
 * `not-found` — a private plan's existence never leaks (ARCHITECTURE.md §5).
 *
 * Rules, in one place (the database repeats them for the durable store):
 * - anyone in the conference may make a plan; its organiser, or a conference
 *   organiser, may change or cancel it;
 * - you answer only for yourself, per occurrence, and only on plans you can
 *   see; an answer can be taken back;
 * - anyone who can see a plan may suggest a place and vote, one vote per plan;
 *   the plan's organiser chooses the venue;
 * - inviting "selected" coworkers means people who chose to be seen: you
 *   cannot pick somebody you cannot see.
 */
export interface PlansDeps {
  readonly conference: Deps;
  readonly store: PlansStore;
  readonly lookup: PlaceLookup;
  readonly enabled: boolean;
}

type Fail = "not-found" | "forbidden" | "invalid";
export type PlansResult<T> =
  ({ ok: true } & T) | { ok: false; error: Fail; issues?: Issues };

const fail = (error: Fail, issues?: Issues) =>
  ({ ok: false, error, ...(issues ? { issues } : {}) }) as const;

const id = () => randomBytes(9).toString("base64url");

async function member(
  d: PlansDeps,
  identity: IdentityKey,
  conferenceId: string,
): Promise<MemberHome | null> {
  if (!d.enabled) return null;
  const home = await homeFor(d.conference, identity, conferenceId);
  if (!home) return null;
  const on = home.conference.modules.includes("plans");
  if (!on && home.you.role !== "organiser") return null;
  return home;
}

export interface PlansBoard {
  readonly plans: readonly PlanView[];
  /** People you can invite: everyone who chose to be seen, but you. */
  readonly people: readonly { memberId: string; name: string }[];
  readonly you: { memberId: string; name: string | null; seen: boolean };
  readonly timeZone: string;
  readonly at: string;
}

export async function readPlans(
  d: PlansDeps,
  identity: IdentityKey,
  conferenceId: string,
): Promise<PlansBoard | null> {
  const home = await member(d, identity, conferenceId);
  if (!home) return null;
  const me = home.you.memberId;
  const [plans, rsvps, options, votes] = await Promise.all([
    d.store.plans(conferenceId),
    d.store.rsvps(conferenceId),
    d.store.options(conferenceId),
    d.store.votes(conferenceId),
  ]);
  const named = namedMap(home.people.visible, home.you);
  const views = plans
    .filter((p) => canSee(p, me))
    .map((plan) =>
      planView({
        plan,
        rsvps: rsvps.filter((r) => r.planId === plan.id),
        options: options.filter((o) => o.planId === plan.id),
        votes: votes.filter((v) => v.planId === plan.id),
        you: { memberId: me, role: home.you.role },
        named,
        lookup: d.lookup,
        now: d.conference.now,
      }),
    );
  return {
    plans: orderPlans(views),
    people: home.people.visible
      .filter((p) => p.displayName)
      .map((p) => ({ memberId: p.memberId, name: p.displayName! })),
    you: {
      memberId: me,
      name: home.you.displayName,
      seen: home.you.visibility === "members",
    },
    timeZone: home.conference.timeZone,
    at: d.conference.now.toISOString(),
  };
}

async function visiblePlan(
  d: PlansDeps,
  home: MemberHome,
  planId: unknown,
): Promise<Plan | null> {
  if (typeof planId !== "string") return null;
  const plan = (await d.store.plans(home.conference.id)).find(
    (p) => p.id === planId,
  );
  return plan && canSee(plan, home.you.memberId) ? plan : null;
}

const manages = (plan: Plan, home: MemberHome) =>
  plan.organiserId === home.you.memberId || home.you.role === "organiser";

export async function createPlan(
  d: PlansDeps,
  identity: IdentityKey,
  conferenceId: string,
  input: unknown,
): Promise<PlansResult<{ planId: string }>> {
  const home = await member(d, identity, conferenceId);
  if (!home) return fail("not-found");
  const parsed = parsePlanInput(input, home.conference);
  if (!parsed.ok) return fail("invalid", parsed.issues);
  const v = parsed.value;
  const seen = new Set(home.people.visible.map((p) => p.memberId));
  if (v.invited.some((m) => !seen.has(m)))
    return fail("invalid", [
      { path: "invited", message: "Invite people who chose to be seen." },
    ]);
  if (v.audience === "selected" && v.invited.length === 0)
    return fail("invalid", [
      {
        path: "invited",
        message: "Pick at least one coworker, or invite everyone.",
      },
    ]);
  const at = d.conference.now.toISOString();
  const plan: Plan = {
    id: id(),
    conferenceId,
    organiserId: home.you.memberId,
    kind: v.kind,
    title: v.title,
    description: v.description,
    meeting: v.meeting,
    venueId: v.venueId,
    audience: v.audience,
    invited: v.invited.filter((m) => m !== home.you.memberId),
    occurrences: v.starts.map((startsAt) => ({ id: id(), startsAt })),
    createdAt: at,
    updatedAt: at,
  };
  await d.store.savePlan(plan);
  // The organiser is going to their own plan: say so, for every occurrence.
  await Promise.all(
    plan.occurrences.map((o) =>
      d.store.answer(conferenceId, {
        planId: plan.id,
        occurrenceId: o.id,
        memberId: home.you.memberId,
        answer: "in",
        at,
      }),
    ),
  );
  // A venue chosen up front is also the first suggestion, so the group sees it.
  if (v.venueId) {
    const place = d.lookup(v.venueId);
    await d.store.addOption(conferenceId, {
      id: id(),
      planId: plan.id,
      placeId: v.venueId,
      name: place?.name ?? "A place",
      by: home.you.memberId,
      at,
    });
  }
  return { ok: true, planId: plan.id };
}

export async function updatePlan(
  d: PlansDeps,
  identity: IdentityKey,
  conferenceId: string,
  planId: unknown,
  input: unknown,
): Promise<PlansResult<object>> {
  const home = await member(d, identity, conferenceId);
  if (!home) return fail("not-found");
  const plan = await visiblePlan(d, home, planId);
  if (!plan) return fail("not-found");
  if (!manages(plan, home)) return fail("forbidden");
  const parsed = parsePlanInput(input, home.conference);
  if (!parsed.ok) return fail("invalid", parsed.issues);
  const v = parsed.value;
  const seen = new Set(home.people.visible.map((p) => p.memberId));
  // People already invited stay invitable even if they've since gone quiet.
  const invitable = (m: string) => seen.has(m) || plan.invited.includes(m);
  if (v.invited.some((m) => !invitable(m)))
    return fail("invalid", [
      { path: "invited", message: "Invite people who chose to be seen." },
    ]);
  // Keep occurrence ids (and so everyone's answers) for times that didn't move.
  const kept = new Map(plan.occurrences.map((o) => [o.startsAt, o.id]));
  await d.store.savePlan({
    ...plan,
    kind: v.kind,
    title: v.title,
    description: v.description,
    meeting: v.meeting,
    venueId: v.venueId,
    audience: v.audience,
    invited: v.invited.filter((m) => m !== plan.organiserId),
    occurrences: v.starts.map((startsAt) => ({
      id: kept.get(startsAt) ?? id(),
      startsAt,
    })),
    updatedAt: d.conference.now.toISOString(),
  });
  return { ok: true };
}

export async function cancelPlan(
  d: PlansDeps,
  identity: IdentityKey,
  conferenceId: string,
  planId: unknown,
): Promise<PlansResult<object>> {
  const home = await member(d, identity, conferenceId);
  if (!home) return fail("not-found");
  const plan = await visiblePlan(d, home, planId);
  if (!plan) return fail("not-found");
  if (!manages(plan, home)) return fail("forbidden");
  await d.store.deletePlan(conferenceId, plan.id);
  return { ok: true };
}

export async function answer(
  d: PlansDeps,
  identity: IdentityKey,
  conferenceId: string,
  input: { planId?: unknown; occurrenceId?: unknown; answer?: unknown },
): Promise<PlansResult<object>> {
  const home = await member(d, identity, conferenceId);
  if (!home) return fail("not-found");
  const plan = await visiblePlan(d, home, input.planId);
  const occurrence = plan?.occurrences.find((o) => o.id === input.occurrenceId);
  if (!plan || !occurrence) return fail("not-found");
  if (input.answer === null) {
    await d.store.unanswer(conferenceId, occurrence.id, home.you.memberId);
    return { ok: true };
  }
  if (!ANSWERS.includes(input.answer as Answer))
    return fail("invalid", [{ path: "answer", message: "in, maybe or out." }]);
  await d.store.answer(conferenceId, {
    planId: plan.id,
    occurrenceId: occurrence.id,
    memberId: home.you.memberId,
    answer: input.answer as Answer,
    at: d.conference.now.toISOString(),
  });
  return { ok: true };
}

export async function suggestVenue(
  d: PlansDeps,
  identity: IdentityKey,
  conferenceId: string,
  input: { planId?: unknown; placeId?: unknown },
): Promise<PlansResult<{ optionId: string }>> {
  const home = await member(d, identity, conferenceId);
  if (!home) return fail("not-found");
  const plan = await visiblePlan(d, home, input.planId);
  if (!plan) return fail("not-found");
  // The server names the place; a suggestion cannot claim facts.
  const place =
    typeof input.placeId === "string" ? d.lookup(input.placeId) : null;
  if (!place)
    return fail("invalid", [
      { path: "placeId", message: "Suggest a place Passport knows." },
    ]);
  const options = (await d.store.options(conferenceId)).filter(
    (o) => o.planId === plan.id,
  );
  const already = options.find((o) => o.placeId === place.id);
  if (already) return { ok: true, optionId: already.id };
  if (options.length >= LIMITS.options)
    return fail("invalid", [
      {
        path: "placeId",
        message: `${LIMITS.options} places is plenty to vote on.`,
      },
    ]);
  const optionId = id();
  await d.store.addOption(conferenceId, {
    id: optionId,
    planId: plan.id,
    placeId: place.id,
    name: place.name,
    by: home.you.memberId,
    at: d.conference.now.toISOString(),
  });
  return { ok: true, optionId };
}

export async function withdrawVenue(
  d: PlansDeps,
  identity: IdentityKey,
  conferenceId: string,
  input: { planId?: unknown; optionId?: unknown },
): Promise<PlansResult<object>> {
  const home = await member(d, identity, conferenceId);
  if (!home) return fail("not-found");
  const plan = await visiblePlan(d, home, input.planId);
  if (!plan) return fail("not-found");
  const option = (await d.store.options(conferenceId)).find(
    (o) => o.id === input.optionId && o.planId === plan.id,
  );
  if (!option) return fail("not-found");
  if (option.by !== home.you.memberId && !manages(plan, home))
    return fail("forbidden");
  await d.store.removeOption(conferenceId, option.id);
  return { ok: true };
}

export async function vote(
  d: PlansDeps,
  identity: IdentityKey,
  conferenceId: string,
  input: { planId?: unknown; optionId?: unknown },
): Promise<PlansResult<object>> {
  const home = await member(d, identity, conferenceId);
  if (!home) return fail("not-found");
  const plan = await visiblePlan(d, home, input.planId);
  if (!plan) return fail("not-found");
  if (input.optionId === null) {
    await d.store.unvote(conferenceId, plan.id, home.you.memberId);
    return { ok: true };
  }
  const option = (await d.store.options(conferenceId)).find(
    (o) => o.id === input.optionId && o.planId === plan.id,
  );
  if (!option) return fail("not-found");
  await d.store.vote(conferenceId, {
    planId: plan.id,
    optionId: option.id,
    memberId: home.you.memberId,
  });
  return { ok: true };
}

/** The plan's organiser settles it: this is where we're going. */
export async function chooseVenue(
  d: PlansDeps,
  identity: IdentityKey,
  conferenceId: string,
  input: { planId?: unknown; optionId?: unknown },
): Promise<PlansResult<object>> {
  const home = await member(d, identity, conferenceId);
  if (!home) return fail("not-found");
  const plan = await visiblePlan(d, home, input.planId);
  if (!plan) return fail("not-found");
  if (!manages(plan, home)) return fail("forbidden");
  const option =
    input.optionId === null
      ? null
      : (await d.store.options(conferenceId)).find(
          (o) => o.id === input.optionId && o.planId === plan.id,
        );
  if (option === undefined) return fail("not-found");
  await d.store.savePlan({
    ...plan,
    venueId: option?.placeId ?? null,
    updatedAt: d.conference.now.toISOString(),
  });
  return { ok: true };
}

export function plansLifecycle(store: () => PlansStore): ConferenceLifecycle {
  return {
    module: "plans",
    forgetMember: (c, m) => store().forgetMember(c, m),
    forgetConference: (c) => store().forgetConference(c),
  };
}
