import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ActivityKind,
  Answer,
  Audience,
  MeetingPoint,
  Plan,
} from "@/domain/conference-plans/types";
import type { PlansStore } from "./store";

/**
 * **The durable `PlansStore`: Postgres under row level security**, as the
 * signed-in person, never a privileged key. What anyone may see or write is
 * decided by 20261023000000_passport_conference_together.sql; a row this
 * store can't read is a row the person may not see.
 *
 * A plan is three tables (the plan, its occurrences, its invitees), written
 * in steps. A failure between steps leaves a plan with fewer occurrences or
 * invitees than asked for, never somebody else's data; the next save
 * converges it. Erasure cascades in the database.
 */
interface PlanRow {
  id: string;
  conference_id: string;
  organiser_id: string;
  kind: ActivityKind;
  title: string;
  description: string;
  meeting: MeetingPoint | null;
  venue_id: string | null;
  audience: Audience;
  created_at: string;
  updated_at: string;
}

export function supabasePlans(
  client: () => Promise<SupabaseClient>,
): PlansStore {
  const ok = <T>(r: { data: T; error: { message: string } | null }): T => {
    if (r.error) throw new Error(`plans store: ${r.error.message}`);
    return r.data;
  };

  return {
    async plans(conferenceId) {
      const db = await client();
      const [plans, occ, inv] = await Promise.all([
        db
          .from("passport_conference_plans")
          .select(
            "id, conference_id, organiser_id, kind, title, description, meeting, venue_id, audience, created_at, updated_at",
          )
          .eq("conference_id", conferenceId),
        db
          .from("passport_conference_plan_occurrences")
          .select("id, plan_id, starts_at")
          .eq("conference_id", conferenceId)
          .order("starts_at"),
        db
          .from("passport_conference_plan_invites")
          .select("plan_id, member_id")
          .eq("conference_id", conferenceId),
      ]);
      const rows = ok(plans) as PlanRow[];
      const occurrences = ok(occ) as {
        id: string;
        plan_id: string;
        starts_at: string;
      }[];
      const invites = ok(inv) as { plan_id: string; member_id: string }[];
      return rows.map((r): Plan => ({
        id: r.id,
        conferenceId: r.conference_id,
        organiserId: r.organiser_id,
        kind: r.kind,
        title: r.title,
        description: r.description,
        meeting: r.meeting,
        venueId: r.venue_id,
        audience: r.audience,
        invited: invites
          .filter((i) => i.plan_id === r.id)
          .map((i) => i.member_id),
        occurrences: occurrences
          .filter((o) => o.plan_id === r.id)
          .map((o) => ({
            id: o.id,
            startsAt: new Date(o.starts_at).toISOString(),
          })),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
    },

    async savePlan(plan) {
      const db = await client();
      const existing = ok(
        await db
          .from("passport_conference_plans")
          .select("id")
          .eq("id", plan.id)
          .maybeSingle(),
      );
      const editable = {
        kind: plan.kind,
        title: plan.title,
        description: plan.description,
        meeting: plan.meeting,
        venue_id: plan.venueId,
        audience: plan.audience,
        updated_at: plan.updatedAt,
      };
      if (existing) {
        ok(
          await db
            .from("passport_conference_plans")
            .update(editable)
            .eq("id", plan.id),
        );
      } else {
        ok(
          await db.from("passport_conference_plans").insert({
            id: plan.id,
            conference_id: plan.conferenceId,
            organiser_id: plan.organiserId,
            created_at: plan.createdAt,
            ...editable,
          }),
        );
      }
      // Occurrences: drop what went, add what's new. Kept ids keep answers.
      const had = (
        ok(
          await db
            .from("passport_conference_plan_occurrences")
            .select("id")
            .eq("plan_id", plan.id),
        ) as { id: string }[]
      ).map((o) => o.id);
      const want = new Set(plan.occurrences.map((o) => o.id));
      const gone = had.filter((id) => !want.has(id));
      if (gone.length)
        ok(
          await db
            .from("passport_conference_plan_occurrences")
            .delete()
            .in("id", gone),
        );
      const added = plan.occurrences.filter((o) => !had.includes(o.id));
      if (added.length)
        ok(
          await db.from("passport_conference_plan_occurrences").insert(
            added.map((o) => ({
              id: o.id,
              plan_id: plan.id,
              conference_id: plan.conferenceId,
              starts_at: o.startsAt,
            })),
          ),
        );
      // Invitees, the same way.
      const invited = (
        ok(
          await db
            .from("passport_conference_plan_invites")
            .select("member_id")
            .eq("plan_id", plan.id),
        ) as { member_id: string }[]
      ).map((i) => i.member_id);
      const wantInvited = new Set(plan.invited);
      const uninvite = invited.filter((m) => !wantInvited.has(m));
      if (uninvite.length)
        ok(
          await db
            .from("passport_conference_plan_invites")
            .delete()
            .eq("plan_id", plan.id)
            .in("member_id", uninvite),
        );
      const invite = plan.invited.filter((m) => !invited.includes(m));
      if (invite.length)
        ok(
          await db.from("passport_conference_plan_invites").insert(
            invite.map((member_id) => ({
              plan_id: plan.id,
              conference_id: plan.conferenceId,
              member_id,
            })),
          ),
        );
    },

    async deletePlan(_c, planId) {
      ok(
        await (
          await client()
        )
          .from("passport_conference_plans")
          .delete()
          .eq("id", planId),
      );
    },

    async rsvps(conferenceId) {
      const rows = ok(
        await (
          await client()
        )
          .from("passport_conference_rsvps")
          .select("plan_id, occurrence_id, member_id, answer, at")
          .eq("conference_id", conferenceId),
      ) as {
        plan_id: string;
        occurrence_id: string;
        member_id: string;
        answer: Answer;
        at: string;
      }[];
      return rows.map((r) => ({
        planId: r.plan_id,
        occurrenceId: r.occurrence_id,
        memberId: r.member_id,
        answer: r.answer,
        at: r.at,
      }));
    },

    async answer(conferenceId, r) {
      ok(
        await (await client()).from("passport_conference_rsvps").upsert(
          {
            occurrence_id: r.occurrenceId,
            plan_id: r.planId,
            conference_id: conferenceId,
            member_id: r.memberId,
            answer: r.answer,
            at: r.at,
          },
          { onConflict: "occurrence_id,user_id", defaultToNull: false },
        ),
      );
    },

    async unanswer(_c, occurrenceId, memberId) {
      ok(
        await (
          await client()
        )
          .from("passport_conference_rsvps")
          .delete()
          .eq("occurrence_id", occurrenceId)
          .eq("member_id", memberId),
      );
    },

    async options(conferenceId) {
      const rows = ok(
        await (
          await client()
        )
          .from("passport_conference_plan_options")
          .select("id, plan_id, place_id, name, member_id, at")
          .eq("conference_id", conferenceId),
      ) as {
        id: string;
        plan_id: string;
        place_id: string;
        name: string;
        member_id: string;
        at: string;
      }[];
      return rows.map((o) => ({
        id: o.id,
        planId: o.plan_id,
        placeId: o.place_id,
        name: o.name,
        by: o.member_id,
        at: o.at,
      }));
    },

    async addOption(conferenceId, o) {
      ok(
        await (await client()).from("passport_conference_plan_options").insert({
          id: o.id,
          plan_id: o.planId,
          conference_id: conferenceId,
          member_id: o.by,
          place_id: o.placeId,
          name: o.name.slice(0, 120),
          at: o.at,
        }),
      );
    },

    async removeOption(_c, optionId) {
      ok(
        await (
          await client()
        )
          .from("passport_conference_plan_options")
          .delete()
          .eq("id", optionId),
      );
    },

    async votes(conferenceId) {
      const rows = ok(
        await (
          await client()
        )
          .from("passport_conference_plan_votes")
          .select("plan_id, option_id, member_id")
          .eq("conference_id", conferenceId),
      ) as { plan_id: string; option_id: string; member_id: string }[];
      return rows.map((v) => ({
        planId: v.plan_id,
        optionId: v.option_id,
        memberId: v.member_id,
      }));
    },

    async vote(conferenceId, v) {
      ok(
        await (await client()).from("passport_conference_plan_votes").upsert(
          {
            plan_id: v.planId,
            option_id: v.optionId,
            conference_id: conferenceId,
            member_id: v.memberId,
          },
          { onConflict: "plan_id,user_id", defaultToNull: false },
        ),
      );
    },

    async unvote(_c, planId, memberId) {
      ok(
        await (
          await client()
        )
          .from("passport_conference_plan_votes")
          .delete()
          .eq("plan_id", planId)
          .eq("member_id", memberId),
      );
    },

    // Cascades from passport_conference_members in the database.
    async forgetMember() {},
    async forgetConference() {},
  };
}
