import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PassportUser } from "@/lib/auth/currentUser";
import type { PlanRow } from "./boards-plans";

/**
 * **Where shared days are kept: `passport_board_plans`.**
 *
 * Same shape of boundary as interest: the caller's own session, so row-level
 * security decides who reads (members) and who writes (the sharer; the owner
 * may also take one down). The route checks board access as well.
 *
 * ## The table is proposed, not yet migrated
 *
 * Its SQL is in `docs/product/shared-adventures.md`. Until it lands every call
 * here fails as `PlansUnavailable`, which the board renders as "can't share
 * days here yet" — never as "nobody has shared a day", because only one of
 * those would be true.
 */
const TABLE = "passport_board_plans";

export class PlansUnavailable extends Error {
  constructor(cause: string) {
    super(`Shared plans are unavailable: ${cause}`);
    this.name = "PlansUnavailable";
  }
}

export interface BoardPlans {
  readonly rows: readonly PlanRow[];
  readonly memberIds: ReadonlySet<string>;
}

export async function readBoardPlans(boardId: string): Promise<BoardPlans> {
  const supabase = await createSupabaseServerClient();
  const [plans, members] = await Promise.all([
    supabase
      .from(TABLE)
      .select("id, user_id, title, day_query, shown_as, created_at")
      .eq("board_id", boardId),
    supabase
      .from("passport_board_members")
      .select("user_id")
      .eq("board_id", boardId),
  ]);

  if (plans.error) throw new PlansUnavailable(plans.error.message);
  if (members.error) throw new PlansUnavailable(members.error.message);

  const rows = (
    (plans.data as
      | {
          id: string;
          user_id: string;
          title: string | null;
          day_query: string;
          shown_as: string | null;
          created_at: string;
        }[]
      | null) ?? []
  ).map((r) => ({
    id: r.id,
    userId: r.user_id,
    title: r.title,
    dayQuery: r.day_query,
    shownAs: r.shown_as,
    createdAt: r.created_at,
  }));

  const memberIds = new Set(
    ((members.data as { user_id: string }[] | null) ?? []).map(
      (m) => m.user_id,
    ),
  );

  return { rows, memberIds };
}

export async function sharePlan(
  user: PassportUser,
  boardId: string,
  plan: { dayQuery: string; title: string | null; shownAs: string | null },
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from(TABLE).insert({
    board_id: boardId,
    user_id: user.id,
    title: plan.title,
    day_query: plan.dayQuery,
    shown_as: plan.shownAs,
  });
  if (error) throw new PlansUnavailable(error.message);
}

/**
 * Take a shared day down. `false` when there was nothing this person may
 * remove — not theirs, already gone, or RLS said no — which the route reports
 * as not found rather than pretending it worked.
 *
 * "I'm in" marks on it are not deleted here: they belong to other people, and
 * RLS rightly lets nobody delete somebody else's. They stop meaning anything
 * at once — nothing renders a plan that is gone, and `markable` no longer
 * accepts its id — and the proposed `ON DELETE` trigger removes them, names
 * and all, inside the database where that is allowed.
 */
export async function withdrawPlan(
  boardId: string,
  planId: string,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from(TABLE)
    .delete()
    .eq("board_id", boardId)
    .eq("id", planId)
    .select("id");
  if (error) throw new PlansUnavailable(error.message);
  return Boolean(data && data.length > 0);
}
