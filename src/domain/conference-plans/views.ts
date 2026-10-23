import type { MemberRef } from "@/domain/conference/contracts";
import {
  KINDS,
  type ActivityKind,
  type Answer,
  type Audience,
  type Plan,
  type Rsvp,
  type VenueOption,
  type VenueVote,
} from "./types";

/**
 * **What a member sees of the plans they may see. Privacy lives here.**
 *
 * - A plan for `everyone` is seen by every member. A plan for `selected`
 *   coworkers is seen by its organiser and the people invited, and by
 *   nobody else: not counted, not hinted at. The database says the same
 *   (plans-migration.sql), so this is the rule twice, not a UI filter.
 * - Who's coming is **named only by choice**: a member who chose to be seen
 *   appears by their name; anyone else who answered is counted ("+2 more"),
 *   never named. That is the conference's roster rule (views.ts), unchanged.
 * - Member ids are the only ids that leave the server.
 */

/** Facts about a place, resolved on read from the curated list or Atlas. */
export interface PlaceFacts {
  readonly id: string;
  readonly name: string;
  readonly address?: string;
  readonly area?: string;
  /** [lat, lng] */
  readonly at?: readonly [number, number];
  readonly image?: string;
  readonly blurb?: string;
  readonly from: "curated" | "atlas";
}

export type PlaceLookup = (id: string) => PlaceFacts | null;

export interface PlanPerson {
  readonly memberId: string;
  readonly name: string;
  readonly you: boolean;
}

export type OccurrenceStatus = "upcoming" | "soon" | "now" | "past";

export interface OccurrenceView {
  readonly id: string;
  readonly startsAt: string;
  readonly status: OccurrenceStatus;
  readonly counts: Readonly<Record<Answer, number>>;
  /** Named people who said I'm in (you first). */
  readonly going: readonly PlanPerson[];
  readonly maybe: readonly PlanPerson[];
  /** People who said I'm in or Maybe without being seen: counted only. */
  readonly unnamed: number;
  readonly mine: Answer | null;
}

export interface VenueOptionView {
  readonly id: string;
  readonly place: PlaceFacts | { readonly id: string; readonly name: string };
  readonly votes: number;
  readonly mine: boolean;
  readonly leading: boolean;
  readonly byYou: boolean;
}

export interface PlanView {
  readonly id: string;
  readonly kind: ActivityKind;
  readonly kindLabel: string;
  readonly emoji: string;
  readonly title: string;
  readonly description: string;
  readonly meeting: {
    readonly label: string;
    readonly place: PlaceFacts | null;
  } | null;
  readonly venue:
    PlaceFacts | { readonly id: string; readonly name: string } | null;
  readonly organiser: { readonly name: string | null; readonly you: boolean };
  readonly audience: Audience;
  /** Named invitees (selected plans only), for people who can see the plan. */
  readonly invited: readonly PlanPerson[];
  readonly invitedCount: number;
  readonly occurrences: readonly OccurrenceView[];
  /** The next occurrence that hasn't finished, or `null`. */
  readonly next: OccurrenceView | null;
  readonly options: readonly VenueOptionView[];
  readonly canManage: boolean;
  readonly votes: boolean;
}

/** An occurrence is "now" for an hour after it starts, and "soon" 45 minutes before. */
export const NOW_FOR_MS = 60 * 60_000;
export const SOON_MS = 45 * 60_000;

export function statusOf(startsAt: string, now: Date): OccurrenceStatus {
  const t = Date.parse(startsAt) - now.getTime();
  if (t > SOON_MS) return "upcoming";
  if (t > 0) return "soon";
  if (t > -NOW_FOR_MS) return "now";
  return "past";
}

/** Whether this member may see this plan at all. */
export function canSee(plan: Plan, memberId: string): boolean {
  return (
    plan.audience === "everyone" ||
    plan.organiserId === memberId ||
    plan.invited.includes(memberId)
  );
}

export interface ViewInput {
  readonly plan: Plan;
  readonly rsvps: readonly Rsvp[];
  readonly options: readonly VenueOption[];
  readonly votes: readonly VenueVote[];
  readonly you: {
    readonly memberId: string;
    readonly role: "organiser" | "member";
  };
  /** Members the viewer may name: everyone visible, plus the viewer. */
  readonly named: ReadonlyMap<string, string>;
  readonly lookup: PlaceLookup;
  readonly now: Date;
}

const person = (
  memberId: string,
  named: ReadonlyMap<string, string>,
  you: string,
): PlanPerson | null => {
  const name = named.get(memberId);
  return name ? { memberId, name, you: memberId === you } : null;
};

const youFirst = (a: PlanPerson, b: PlanPerson) =>
  Number(b.you) - Number(a.you) || a.name.localeCompare(b.name);

export function planView(v: ViewInput): PlanView {
  const { plan, named, now } = v;
  const me = v.you.memberId;
  const info = KINDS[plan.kind];

  const occurrences = plan.occurrences.map((o): OccurrenceView => {
    const here = v.rsvps.filter((r) => r.occurrenceId === o.id);
    const counts = { in: 0, maybe: 0, out: 0 } as Record<Answer, number>;
    for (const r of here) counts[r.answer] += 1;
    const pick = (a: Answer) =>
      here
        .filter((r) => r.answer === a)
        .map((r) => person(r.memberId, named, me))
        .filter((p): p is PlanPerson => p !== null)
        .sort(youFirst);
    const going = pick("in");
    const maybe = pick("maybe");
    return {
      id: o.id,
      startsAt: o.startsAt,
      status: statusOf(o.startsAt, now),
      counts,
      going,
      maybe,
      unnamed: counts.in + counts.maybe - going.length - maybe.length,
      mine: here.find((r) => r.memberId === me)?.answer ?? null,
    };
  });

  const tally = new Map<string, number>();
  for (const vote of v.votes)
    tally.set(vote.optionId, (tally.get(vote.optionId) ?? 0) + 1);
  const top = Math.max(0, ...tally.values());
  const myVote = v.votes.find((x) => x.memberId === me)?.optionId ?? null;

  const resolve = (id: string, name: string) => v.lookup(id) ?? { id, name };

  return {
    id: plan.id,
    kind: plan.kind,
    kindLabel: info.label,
    emoji: info.emoji,
    title: plan.title,
    description: plan.description,
    meeting: plan.meeting
      ? {
          label: plan.meeting.label,
          place: plan.meeting.placeId ? v.lookup(plan.meeting.placeId) : null,
        }
      : null,
    venue: plan.venueId
      ? resolve(
          plan.venueId,
          v.options.find((o) => o.placeId === plan.venueId)?.name ?? "A place",
        )
      : null,
    organiser: {
      name: named.get(plan.organiserId) ?? null,
      you: plan.organiserId === me,
    },
    audience: plan.audience,
    invited:
      plan.audience === "selected"
        ? plan.invited
            .map((id) => person(id, named, me))
            .filter((p): p is PlanPerson => p !== null)
            .sort(youFirst)
        : [],
    invitedCount: plan.audience === "selected" ? plan.invited.length : 0,
    occurrences,
    next: occurrences.find((o) => o.status !== "past") ?? null,
    options: v.options
      .map((o) => ({
        id: o.id,
        place: resolve(o.placeId, o.name),
        votes: tally.get(o.id) ?? 0,
        mine: myVote === o.id,
        leading: top > 0 && (tally.get(o.id) ?? 0) === top,
        byYou: o.by === me,
      }))
      .sort(
        (a, b) => b.votes - a.votes || a.place.name.localeCompare(b.place.name),
      ),
    canManage: plan.organiserId === me || v.you.role === "organiser",
    votes: info.vote || v.options.length > 0,
  };
}

/** Upcoming first (by their next occurrence), then what already happened, newest first. */
export function orderPlans(plans: readonly PlanView[]): PlanView[] {
  const nextAt = (p: PlanView) =>
    p.next ? Date.parse(p.next.startsAt) : Number.POSITIVE_INFINITY;
  const lastAt = (p: PlanView) =>
    Math.max(...p.occurrences.map((o) => Date.parse(o.startsAt)));
  const live = plans
    .filter((p) => p.next)
    .sort((a, b) => nextAt(a) - nextAt(b));
  const done = plans
    .filter((p) => !p.next)
    .sort((a, b) => lastAt(b) - lastAt(a));
  return [...live, ...done];
}

/** The names map a view needs, from the conference's own roster rule. */
export function namedMap(
  visible: readonly MemberRef[],
  you: { memberId: string; displayName: string | null },
): Map<string, string> {
  const m = new Map<string, string>();
  for (const p of visible) if (p.displayName) m.set(p.memberId, p.displayName);
  if (you.displayName) m.set(you.memberId, you.displayName);
  else m.set(you.memberId, "You");
  return m;
}
