import type {
  Plan,
  Rsvp,
  VenueOption,
  VenueVote,
} from "@/domain/conference-plans/types";
import { conferenceSetup } from "@/lib/conference/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabasePlans } from "./supabaseStore";

/**
 * **Where plans live**, keyed on `(conferenceId, memberId)` like every
 * conference module (ARCHITECTURE.md §6).
 *
 * Two implementations, like arrivals: memory (development, tests) and
 * `supabasePlans` (durable, under row level security, as the signed-in
 * person). The memory store keeps everything and the service filters; the
 * database filters before the service ever sees a row. Both are tested
 * against the same service rules.
 */
export interface PlansStore {
  /** Every plan the caller may see (the service filters again). */
  plans(conferenceId: string): Promise<Plan[]>;
  savePlan(plan: Plan): Promise<void>;
  deletePlan(conferenceId: string, planId: string): Promise<void>;
  rsvps(conferenceId: string): Promise<Rsvp[]>;
  answer(conferenceId: string, rsvp: Rsvp): Promise<void>;
  unanswer(
    conferenceId: string,
    occurrenceId: string,
    memberId: string,
  ): Promise<void>;
  options(conferenceId: string): Promise<VenueOption[]>;
  addOption(conferenceId: string, option: VenueOption): Promise<void>;
  removeOption(conferenceId: string, optionId: string): Promise<void>;
  votes(conferenceId: string): Promise<VenueVote[]>;
  vote(conferenceId: string, vote: VenueVote): Promise<void>;
  unvote(conferenceId: string, planId: string, memberId: string): Promise<void>;
  forgetMember(conferenceId: string, memberId: string): Promise<void>;
  forgetConference(conferenceId: string): Promise<void>;
}

interface Shelf {
  plans: Map<string, Plan>;
  rsvps: Map<string, Rsvp>; // `${occurrenceId}|${memberId}`
  options: Map<string, VenueOption>;
  votes: Map<string, VenueVote>; // `${planId}|${memberId}`
}

export function memoryPlans(): PlansStore {
  const all = new Map<string, Shelf>();
  const shelf = (id: string): Shelf => {
    let s = all.get(id);
    if (!s)
      all.set(
        id,
        (s = {
          plans: new Map(),
          rsvps: new Map(),
          options: new Map(),
          votes: new Map(),
        }),
      );
    return s;
  };
  const dropPlan = (s: Shelf, planId: string) => {
    const plan = s.plans.get(planId);
    s.plans.delete(planId);
    const occ = new Set(plan?.occurrences.map((o) => o.id));
    for (const [k, r] of s.rsvps)
      if (r.planId === planId || occ.has(r.occurrenceId)) s.rsvps.delete(k);
    for (const [k, o] of s.options)
      if (o.planId === planId) s.options.delete(k);
    for (const [k, v] of s.votes) if (v.planId === planId) s.votes.delete(k);
  };
  return {
    async plans(c) {
      return [...shelf(c).plans.values()];
    },
    async savePlan(plan) {
      const s = shelf(plan.conferenceId);
      const before = s.plans.get(plan.id);
      s.plans.set(plan.id, plan);
      if (before) {
        // An occurrence that was removed takes its answers with it.
        const keep = new Set(plan.occurrences.map((o) => o.id));
        for (const [k, r] of s.rsvps)
          if (r.planId === plan.id && !keep.has(r.occurrenceId))
            s.rsvps.delete(k);
      }
    },
    async deletePlan(c, planId) {
      dropPlan(shelf(c), planId);
    },
    async rsvps(c) {
      return [...shelf(c).rsvps.values()];
    },
    async answer(c, r) {
      shelf(c).rsvps.set(`${r.occurrenceId}|${r.memberId}`, r);
    },
    async unanswer(c, occurrenceId, memberId) {
      shelf(c).rsvps.delete(`${occurrenceId}|${memberId}`);
    },
    async options(c) {
      return [...shelf(c).options.values()];
    },
    async addOption(c, o) {
      shelf(c).options.set(o.id, o);
    },
    async removeOption(c, optionId) {
      const s = shelf(c);
      s.options.delete(optionId);
      for (const [k, v] of s.votes)
        if (v.optionId === optionId) s.votes.delete(k);
    },
    async votes(c) {
      return [...shelf(c).votes.values()];
    },
    async vote(c, v) {
      shelf(c).votes.set(`${v.planId}|${v.memberId}`, v);
    },
    async unvote(c, planId, memberId) {
      shelf(c).votes.delete(`${planId}|${memberId}`);
    },
    async forgetMember(c, memberId) {
      const s = shelf(c);
      for (const p of [...s.plans.values()])
        if (p.organiserId === memberId) dropPlan(s, p.id);
        else if (p.invited.includes(memberId))
          s.plans.set(p.id, {
            ...p,
            invited: p.invited.filter((m) => m !== memberId),
          });
      for (const [k, r] of s.rsvps)
        if (r.memberId === memberId) s.rsvps.delete(k);
      for (const [k, o] of s.options)
        if (o.by === memberId) {
          s.options.delete(k);
          for (const [vk, v] of s.votes)
            if (v.optionId === o.id) s.votes.delete(vk);
        }
      for (const [k, v] of s.votes)
        if (v.memberId === memberId) s.votes.delete(k);
    },
    async forgetConference(c) {
      all.delete(c);
    },
  };
}

const g = globalThis as unknown as { __plansStore?: PlansStore };

export const plansStore = (): PlansStore => {
  const setup = conferenceSetup();
  if (setup.open && setup.config.store === "supabase")
    return supabasePlans(createSupabaseServerClient);
  return (g.__plansStore ??= memoryPlans());
};
