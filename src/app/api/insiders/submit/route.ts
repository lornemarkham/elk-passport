import { submit, type SubmissionInput } from "@/domain/insiders/review";
import { handle, json } from "@/lib/insiders/http";
import {
  actor,
  afterPublish,
  change,
  network,
  salt,
} from "@/lib/insiders/service";

/**
 * **Send in a local discovery.** Anyone can; a visitor's goes to the review
 * queue. The hidden `website` field is a trap for form-filling robots: a
 * person never sees it, so anything in it is not a person.
 */
export async function POST(request: Request) {
  const me = await actor(await network().catch(() => undefined));
  return handle(
    request,
    "submit",
    me.who === "visitor" ? null : me.who,
    async (body) => {
      if (typeof body.website === "string" && body.website.trim())
        return json({ ok: true, status: "submitted" });
      const input = body as SubmissionInput;
      const out = await change((n) => {
        const r = submit(n, input, me, new Date(), salt());
        return { network: r.network, result: r };
      });
      const atlas = out.published ? await afterPublish(out.listing) : undefined;
      return json({
        ok: true,
        id: out.listing.id,
        status: out.listing.status,
        ...(out.duplicateOf ? { duplicateOf: out.duplicateOf } : {}),
        ...(atlas ? { atlas } : {}),
      });
    },
  );
}
