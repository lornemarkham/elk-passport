import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/currentUser";
import { answer, badRequest, bodyOf, visitorDb } from "@/lib/adventures/server";
import { describeInvite, redeemInvite } from "@/lib/adventures/store";
import { parseVisibility, TOKEN_PATTERN } from "@/lib/adventures/rules";
import { adventureKind } from "@/lib/adventures/kinds";

/**
 * Join from a link: `{ token, visibility? }`.
 *
 * Signed in is required — the link alone is never enough. Whether the joiner
 * is listed to the other members defaults to the kind's rule and is theirs
 * to change. 410 for a link that is spent, revoked, expired, or was made
 * before the owner removed this person.
 */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json(
      { error: "signed-out", message: "Sign in to join." },
      { status: 401 },
    );
  }

  const body = (await bodyOf(request)) as {
    token?: unknown;
    visibility?: unknown;
  } | null;
  const token = typeof body?.token === "string" ? body.token : "";
  if (!TOKEN_PATTERN.test(token)) return badRequest("That isn't a link.");

  return answer(async () => {
    const db = await visitorDb();
    const described = await describeInvite(db, token);
    if (!described) {
      return NextResponse.json({ error: "No such link." }, { status: 404 });
    }
    const visibility =
      parseVisibility(body?.visibility) ??
      adventureKind(described.kind)?.joinVisibility ??
      "members";

    const id = await redeemInvite(db, token, {
      displayName: user.displayName,
      visibility,
    });
    if (!id) {
      return NextResponse.json(
        { error: "This link is no longer good." },
        { status: 410 },
      );
    }
    return NextResponse.json({ id });
  });
}
