import { after } from "next/server";
import {
  changeSuggestions,
  contributor,
  handle,
  json,
  newId,
  progressFor,
  putPhoto,
} from "@/lib/contributions/server";
import {
  Refused,
  parseSubmission,
  submit,
} from "@/domain/contributions/actions";
import { contributorView } from "@/domain/contributions/model";
import { thanks } from "@/domain/contributions/milestones";
import { measure } from "@/lib/measure";
import {
  dashboardUrl,
  newSuggestionMail,
  sendToAdmin,
} from "@/app/christmas/_server/notify";

export const dynamic = "force-dynamic";

/** The JPEG the browser shrank (`shrinkPhoto`): base64, under 700k characters. */
function photoFrom(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (
    typeof value !== "string" ||
    value.length > 700_000 ||
    !value.startsWith("/9j/") ||
    !/^[A-Za-z0-9+/=]+$/.test(value)
  )
    throw new Refused("That photo didn't come through — try a different one.");
  return value;
}

/** A person fills the form in more slowly than this; a script does not. */
const LEAST_MS_ON_FORM = 2000;

/**
 * **Suggest something** — from any experience, no account. Stored as
 * _pending_, seen by nobody but the administrator, who is emailed when mail
 * is configured. The answer carries the person's progress so the thanks can
 * be honest about what is pending and what is approved.
 *
 * Abuse prevention, in order: same-origin and per-address rate limits
 * (`handle`); a hidden field only a script fills (`company`); a minimum time
 * on the form; the pure rules in `domain/contributions` (a burst pauses, a
 * contributor cooling off after spam declines is refused, a flooded queue
 * says so) — and **no daily cap** (owner brief 2026-11-23, P0).
 */
export async function POST(request: Request) {
  return handle(request, "write", null, async (body) => {
    // Pretend success to a robot, store nothing.
    if (typeof body.company === "string" && body.company.trim() !== "")
      return json({ ok: true, suggestion: null }, 201);
    const spent = Number(body.openedFor);
    if (!Number.isFinite(spent) || spent < LEAST_MS_ON_FORM)
      throw new Refused("That was quick — take a moment, then send it again.");
    const s = parseSubmission(body);
    const photo = photoFrom(body.photo);
    const who = await contributor(request, body.device);
    const id = newId();
    const now = new Date();
    if (photo) await putPhoto(id, photo);
    let result;
    try {
      result = await changeSuggestions((doc) => {
        const r = submit(doc, s, who.primary, id, now, photo ? id : undefined);
        return { doc: r.doc, result: r };
      });
    } catch (error) {
      if (photo) await putPhoto(id, null).catch(() => undefined);
      throw error;
    }
    if (result.repeat && photo) await putPhoto(id, null).catch(() => undefined);
    const p = await progressFor(who);
    if (!result.repeat) {
      await measure("suggestion_submitted", {
        experience: s.experience,
        category: s.category,
        photo: !!photo,
      });
      const link = dashboardUrl(request, "/contribute/review");
      after(async () => {
        await sendToAdmin(
          newSuggestionMail(s.name, s.category, s.experience, link),
        );
      });
    }
    return json(
      {
        ok: true,
        suggestion: contributorView(result.suggestion),
        repeat: result.repeat,
        lookalike: !!result.suggestion.duplicateOf,
        progress: p,
        thanks: thanks(p),
        recognisedBy: who.recognisedBy,
      },
      201,
    );
  });
}
