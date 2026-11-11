import "server-only";
import { cookies } from "next/headers";
import { townById } from "@/domain/discovery/towns";

/** The cookie that remembers the town somebody chose on a Christmas page. */
export const TOWN_COOKIE = "xm-town";

/** Where Christmas opens when nobody has said (the first place it launched). */
export const DEFAULT_TOWN = "vernon";

/**
 * **Where are we?** The town in the URL (a person just chose it), else the
 * one they chose last time (this browser's cookie), else Vernon. Always a
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
  const remembered = (await cookies()).get(TOWN_COOKIE)?.value;
  if (remembered && townById(remembered))
    return { at: remembered, chosen: false };
  return { at: DEFAULT_TOWN, chosen: false };
}
