import "server-only";
import { cookies } from "next/headers";
import { townById } from "@/domain/discovery/towns";
import { PLACE_COOKIE } from "@/domain/location/prefs";

/** The cookie that remembers the town somebody chose on a Christmas page. */
export const TOWN_COOKIE = "xm-town";

/** Where Christmas opens when nobody has said (the first place it launched). */
export const DEFAULT_TOWN = "vernon";

/**
 * **Where are we?** The town in the URL (a person just chose it), else the
 * place they chose for every experience (ADR 020's shared place, mirrored to
 * `PLACE_COOKIE`), else the one they chose on Christmas last time (this
 * browser's cookie), else Vernon. Always a
 * town Discovery knows — `townById` is the one list of places Passport can
 * measure from, the same one Discovery, the Day Builder and the lights map
 * read — so "near you" always means something Atlas can answer.
 *
 * `chosen` is whether the person said it this visit (so it is worth
 * remembering), as opposed to a default.
 */
export async function whereAreWe(
  requested: string | undefined,
): Promise<{ readonly at: string; readonly chosen: boolean }> {
  if (requested && townById(requested)) return { at: requested, chosen: true };
  const jar = await cookies();
  const shared = jar.get(PLACE_COOKIE)?.value;
  if (shared && townById(shared)) return { at: shared, chosen: false };
  const remembered = jar.get(TOWN_COOKIE)?.value;
  if (remembered && townById(remembered))
    return { at: remembered, chosen: false };
  return { at: DEFAULT_TOWN, chosen: false };
}
