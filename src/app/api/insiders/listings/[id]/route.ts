import {
  decide,
  edit,
  flag,
  Refused,
  type Decision,
  type Edit,
} from "@/domain/insiders/review";
import { handle, json } from "@/lib/insiders/http";
import { actor, afterPublish, change, network } from "@/lib/insiders/service";

/**
 * One listing's actions.
 *
 * - `report` / `claim`: anyone. "This is wrong" and "this is mine" go on the
 *   listing's trail and in front of a reviewer; neither changes a fact.
 * - `correct`: an ambassador suggesting a fix to a listing that isn't theirs.
 * - `edit`: the ambassador who sent it, or an administrator.
 * - `decide`: a reviewer (an administrator, or a trusted ambassador).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const me = await actor(await network().catch(() => undefined));
  return handle(
    request,
    "flag",
    me.who === "visitor" ? null : me.who,
    async (body) => {
      const action = body.action;
      const now = new Date();
      if (action === "report" || action === "claim" || action === "correct") {
        if (action === "correct" && me.role === "visitor")
          throw new Refused("Sign in as an ambassador first.", 401);
        const contact =
          typeof body.contact === "string"
            ? body.contact.trim().slice(0, 160)
            : "";
        const text = `${typeof body.text === "string" ? body.text : ""}${contact ? `\nContact: ${contact}` : ""}`;
        await change((n) => {
          const r = flag(
            n,
            id,
            action === "correct" ? "correction" : action,
            text,
            me.who,
            now,
          );
          return { network: r.network, result: null };
        });
        return json({ ok: true });
      }
      if (me.role === "visitor")
        throw new Refused("Sign in as an ambassador first.", 401);
      if (action === "edit") {
        const listing = await change((n) => {
          const r = edit(n, id, (body.change ?? {}) as Edit, me, now);
          return { network: r.network, result: r.listing };
        });
        return json({ ok: true, listing });
      }
      if (action === "decide") {
        const decision = body.decision as Decision;
        if (
          !["publish", "needs-info", "decline", "withdraw", "reopen"].includes(
            decision,
          )
        )
          throw new Refused("Unknown decision.");
        const listing = await change((n) => {
          const r = decide(
            n,
            id,
            decision,
            me,
            now,
            typeof body.reason === "string" ? body.reason : undefined,
          );
          return { network: r.network, result: r.listing };
        });
        const atlas =
          decision === "publish" ? await afterPublish(listing) : undefined;
        return json({
          ok: true,
          status: listing.status,
          ...(atlas ? { atlas } : {}),
        });
      }
      throw new Refused("Unknown action.");
    },
  );
}
