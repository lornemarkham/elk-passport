import {
  changeLights,
  handle,
  json,
  putPhoto,
  readLights,
  signInFirst,
  viewer,
  visitorKey,
} from "../../../_server/lights";
import {
  approve,
  check,
  decline,
  find,
  react,
  Refused,
  remove,
  report,
  restore,
} from "@/domain/christmas/lights/actions";
import {
  canSee,
  viewOf,
  type CheckId,
  type ReactionId,
  type ReportId,
} from "@/domain/christmas/lights/model";

export const dynamic = "force-dynamic";

const str = (v: unknown, max = 300) =>
  typeof v === "string" ? v.trim().slice(0, max) : undefined;

/**
 * Everything a person can do to one pin, by `action`:
 *
 * - `react` (signed in): toggle one of the five reactions
 * - `check` (signed in): Lights are on! · Not decorated · Incorrect location · Display updated
 * - `report` (anyone): Something wrong? — a privacy report hides a home at once
 * - `remove` (its submitter or a reviewer)
 * - `approve` · `decline` · `restore` (reviewers)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const v = await viewer();
  const body = await request
    .clone()
    .json()
    .catch(() => ({}) as Record<string, unknown>);
  const action = (body as Record<string, unknown>).action;
  const limit =
    action === "react" ? "react" : action === "report" ? "report" : "write";

  if (action !== "report" && !v.key) return signInFirst();
  const by = v.key ?? visitorKey(request);
  const reviewerName = v.email ?? by;

  return handle(request, limit, by, async (b) => {
    const now = new Date();
    const result = await changeLights((doc) => {
      const pin = find(doc, id);
      if (!canSee(pin, v) && action !== "report")
        throw new Refused("That pin isn't on the map.", 404);
      switch (action) {
        case "react":
          return {
            doc: react(doc, id, by, b.reaction as ReactionId, now),
            result: null,
          };
        case "check":
          return {
            doc: check(
              doc,
              id,
              v.reviewer ? reviewerName : by,
              b.what as CheckId,
              now,
              str(b.text),
            ),
            result: null,
          };
        case "report":
          if (
            pin.status !== "approved" &&
            pin.status !== "hidden" &&
            !canSee(pin, v)
          )
            throw new Refused("That pin isn't on the map.", 404);
          return {
            doc: report(doc, id, by, b.reason as ReportId, str(b.text), now),
            result: null,
          };
        case "remove":
          return {
            doc: remove(doc, id, by, v.reviewer, now),
            result: "removed" as const,
          };
        case "approve": {
          if (!v.reviewer) throw new Refused("Reviewers only.", 403);
          const basis =
            b.basis === "owner-consent" || b.basis === "public-listing"
              ? b.basis
              : undefined;
          const url = str(b.url);
          return {
            doc: approve(
              doc,
              id,
              reviewerName,
              now,
              basis ? { basis, ...(url ? { url } : {}) } : undefined,
            ),
            result: null,
          };
        }
        case "decline":
          if (!v.reviewer) throw new Refused("Reviewers only.", 403);
          return {
            doc: decline(doc, id, reviewerName, now, str(b.why)),
            result: null,
          };
        case "restore":
          if (!v.reviewer) throw new Refused("Reviewers only.", 403);
          return { doc: restore(doc, id, reviewerName, now), result: null };
        default:
          throw new Refused("Nothing to do.");
      }
    });
    if (result === "removed") await putPhoto(id, null).catch(() => undefined);
    const pin = (await readLights()).doc.pins.find((p) => p.id === id);
    return json({ pin: pin && canSee(pin, v) ? viewOf(pin, v, now) : null });
  });
}
