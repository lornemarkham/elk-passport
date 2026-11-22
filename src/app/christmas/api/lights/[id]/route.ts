import { after } from "next/server";
import {
  dashboardUrl,
  removalMail,
  sendToAdmin,
} from "../../../_server/notify";
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
  addDetails,
  approve,
  approveChange,
  check,
  declineChange,
  hide,
  parseContact,
  requestRemoval,
  decline,
  find,
  parseDetails,
  rate,
  react,
  Refused,
  remove,
  report,
  restore,
} from "@/domain/christmas/lights/actions";
import { measure } from "@/lib/measure";
import {
  TOWN_LABEL,
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
 * - `rate` (signed in): "How magical was it?" — 1–5 stars and optional tags, one per season
 * - `details` (its submitter or a reviewer): music, hours, walk-through… after pinning.
 *   On a published display the submitter's words wait for review (`approve-change`)
 * - `approve-change` · `decline-change` (reviewers): a waiting change to a published display
 * - `check` (signed in): Lights are on! · Not decorated · Incorrect location · Display updated
 * - `report` (anyone): Something wrong? — a privacy report hides a listing at once
 * - `request-removal` (anyone, no account): "Is this your home? Request removal" —
 *   hides the listing at once and emails the administrator
 * - `hide` (administrator): take a published listing off the map, keeping it
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
  const reviewing =
    action === "approve" ||
    action === "decline" ||
    action === "approve-change" ||
    action === "decline-change" ||
    action === "restore" ||
    action === "hide";
  // Reviewers work through a queue; their actions share the generous bucket.
  const limit =
    action === "react" || action === "rate" || (reviewing && v.reviewer)
      ? "react"
      : action === "report" || action === "request-removal"
        ? "report"
        : "write";

  const open = action === "report" || action === "request-removal";
  if (!open && !v.key) return signInFirst();
  const by = v.key ?? visitorKey(request);
  const reviewerName = v.email ?? by;

  return handle(request, limit, by, async (b) => {
    const now = new Date();
    const result = await changeLights((doc) => {
      const pin = find(doc, id);
      if (!canSee(pin, v) && !open)
        throw new Refused("That pin isn't on the map.", 404);
      switch (action) {
        case "react":
          return {
            doc: react(doc, id, by, b.reaction as ReactionId, now),
            result: null,
          };
        case "rate":
          return {
            doc: rate(doc, id, by, b.stars, b.tags, now),
            result: null,
          };
        case "details":
          return {
            doc: addDetails(doc, id, by, v.reviewer, parseDetails(b), now),
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
        case "request-removal": {
          if (pin.status === "declined")
            throw new Refused("That listing isn't on the map.", 404);
          return {
            doc: requestRemoval(
              doc,
              id,
              by,
              str(b.text, 500),
              parseContact(b.contact),
              now,
            ),
            result: "removal" as const,
          };
        }
        case "hide":
          if (!v.reviewer) throw new Refused("Reviewers only.", 403);
          return {
            doc: hide(doc, id, reviewerName, now, str(b.why)),
            result: null,
          };
        case "remove":
          return {
            doc: remove(doc, id, by, v.reviewer, now, str(b.why)),
            result: "removed" as const,
          };
        case "approve":
          if (!v.reviewer) throw new Refused("Reviewers only.", 403);
          return {
            doc: approve(doc, id, reviewerName, now),
            result: null,
          };
        case "decline":
          if (!v.reviewer) throw new Refused("Reviewers only.", 403);
          return {
            doc: decline(doc, id, reviewerName, now, str(b.why)),
            result: null,
          };
        case "approve-change":
          if (!v.reviewer) throw new Refused("Reviewers only.", 403);
          return {
            doc: approveChange(doc, id, reviewerName, now),
            result: null,
          };
        case "decline-change":
          if (!v.reviewer) throw new Refused("Reviewers only.", 403);
          return {
            doc: declineChange(doc, id, reviewerName, now, str(b.why)),
            result: null,
          };
        case "restore":
          if (!v.reviewer) throw new Refused("Reviewers only.", 403);
          return {
            doc: restore(doc, id, reviewerName, now, str(b.why)),
            result: null,
          };
        default:
          throw new Refused("Nothing to do.");
      }
    });
    if (result === "removed") await putPhoto(id, null).catch(() => undefined);
    if (result === "removal") {
      const gone = (await readLights()).doc.pins.find((p) => p.id === id);
      const link = dashboardUrl(request);
      if (gone)
        after(async () => {
          await sendToAdmin(
            removalMail(gone.name, TOWN_LABEL[gone.town], link),
          );
        });
    }
    if (
      action === "approve" ||
      action === "decline" ||
      action === "approve-change" ||
      action === "decline-change" ||
      action === "report" ||
      action === "request-removal" ||
      action === "hide" ||
      action === "remove" ||
      action === "react" ||
      action === "rate" ||
      action === "details" ||
      action === "check"
    )
      await measure(`lights_${action}`, {
        ...(action === "report" && typeof b.reason === "string"
          ? { reason: b.reason.slice(0, 40) }
          : {}),
        ...(action === "rate" && typeof b.stars === "number"
          ? { stars: b.stars }
          : {}),
      });
    const pin = (await readLights()).doc.pins.find((p) => p.id === id);
    return json({ pin: pin && canSee(pin, v) ? viewOf(pin, v, now) : null });
  });
}
