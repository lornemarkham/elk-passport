import {
  changeLights,
  handle,
  json,
  newId,
  putPhoto,
  signInFirst,
  viewer,
} from "../../../_server/lights";
import {
  nearDuplicates,
  parseSubmission,
  Refused,
  submit,
} from "@/domain/christmas/lights/actions";
import { viewOf } from "@/domain/christmas/lights/model";

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

/**
 * **PIN THE MAGIC!** A signed-in person sends a display. It is private to
 * them and the reviewers until a reviewer publishes it.
 */
export async function POST(request: Request) {
  const v = await viewer();
  if (!v.key) return signInFirst();
  const key = v.key;
  return handle(request, "write", key, async (body) => {
    const s = parseSubmission(body);
    const photo = photoFrom(body.photo);
    const id = newId();
    const now = new Date();
    if (photo) await putPhoto(id, photo);
    const result = await changeLights((doc) => {
      const twins = nearDuplicates(doc, s.at).filter(
        (p) => p.status === "approved",
      );
      const { doc: next, pin } = submit(
        doc,
        s,
        key,
        id,
        now,
        photo ? id : undefined,
      );
      return {
        doc: next,
        result: { pin, twins: twins.map((t) => ({ id: t.id, name: t.name })) },
      };
    });
    return json(
      {
        pin: viewOf(result.pin, v, now),
        alsoHere: result.twins,
      },
      201,
    );
  });
}
