import { after } from "next/server";
import {
  anonKey,
  changeLights,
  handle,
  json,
  newId,
  putPhoto,
  viewer,
} from "../../../_server/lights";
import {
  dashboardUrl,
  newSubmissionMail,
  sendToAdmin,
} from "../../../_server/notify";
import {
  nearDuplicates,
  parseSubmission,
  Refused,
  submit,
} from "@/domain/christmas/lights/actions";
import { TOWN_LABEL, viewOf } from "@/domain/christmas/lights/model";
import { measure } from "@/lib/measure";

export const dynamic = "force-dynamic";

/** The JPEG the browser shrank (`shrinkPhoto`): base64, under 700k characters. */
function photoFrom(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (
    typeof value !== "string" ||
    value.length > 700_000 ||
    !value.startsWith("/9j/")
  )
    throw new Refused("That photo didn't come through — try a different one.");
  if (!/^[A-Za-z0-9+/=]+$/.test(value))
    throw new Refused("That photo didn't come through.");
  return value;
}

/** A person fills the form in more slowly than this; a script does not. */
const LEAST_MS_ON_FORM = 2500;

/**
 * **Add a display.** Anyone may — no account. It is stored as _pending_,
 * seen by nobody but the administrator, who is emailed. A signed-in
 * submitter's own pending pin is also visible to them; everyone else gets
 * the confirmation page only.
 *
 * Abuse prevention, in order: same-origin and per-address rate limits
 * (`handle`); a hidden field only a script fills; a minimum time on the
 * form; a photo and the photo promise are required; no web links in the
 * words; a daily cap per person-and-device, and a cap on how many may wait;
 * and a property already removed at its household's request is refused.
 */
export async function POST(request: Request) {
  const v = await viewer();
  return handle(request, "write", v.key, async (body) => {
    // Pretend success to a bot, store nothing.
    if (typeof body.website === "string" && body.website.trim() !== "")
      return json({ pin: null, alsoHere: [] }, 201);
    const spent = Number(body.openedFor);
    if (!Number.isFinite(spent) || spent < LEAST_MS_ON_FORM)
      throw new Refused("That was quick — take a moment, then send it again.");
    if (body.photoOk !== true)
      throw new Refused(
        "Please confirm the photo has no people, licence plates or private activity in it.",
      );
    const s = parseSubmission(body);
    const photo = photoFrom(body.photo);
    if (!photo)
      throw new Refused("Add a photo of the display, taken from the street.");
    const key = v.key ?? anonKey(request, body.device);
    const id = newId();
    const now = new Date();
    await putPhoto(id, photo);
    let result;
    try {
      result = await changeLights((doc) => {
        // A retry or double tap from a weak signal in the field: the same
        // person's still-waiting pin, same name, within 40 m, is this one.
        const again = nearDuplicates(doc, s.at).find(
          (p) =>
            p.status === "pending" &&
            p.submittedBy === key &&
            p.name.trim().toLowerCase() === s.name.trim().toLowerCase(),
        );
        if (again) return { doc, result: { pin: again, twins: [] } };
        const twins = nearDuplicates(doc, s.at).filter(
          (p) => p.status === "approved",
        );
        const { doc: next, pin } = submit(doc, s, key, id, now, id);
        return {
          doc: next,
          result: {
            pin,
            twins: twins.map((t) => ({ id: t.id, name: t.name })),
          },
        };
      });
    } catch (error) {
      await putPhoto(id, null).catch(() => undefined);
      throw error;
    }
    if (result.pin.id !== id) {
      // The retry of a submission already waiting: nothing new was stored.
      await putPhoto(id, null).catch(() => undefined);
      return json(
        { pin: null, received: { name: result.pin.name }, alsoHere: [] },
        201,
      );
    }
    await measure("lights_pin_submitted", {
      town: result.pin.town,
      kind: result.pin.kind,
      photo: true,
    });
    const link = dashboardUrl(request);
    after(async () => {
      await sendToAdmin(
        newSubmissionMail(
          result.pin.name,
          TOWN_LABEL[result.pin.town],
          true,
          link,
        ),
      );
    });
    // The public gets a receipt, not the pin: nothing about it is published.
    return json(
      {
        pin: v.key ? viewOf(result.pin, v, now) : null,
        received: { name: result.pin.name },
        alsoHere: [],
      },
      201,
    );
  });
}
