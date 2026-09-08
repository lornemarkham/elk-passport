import "server-only";
import { NextResponse } from "next/server";
import { currentUser, type PassportUser } from "./currentUser";

/**
 * **The identity gate for durable user actions.**
 *
 * Returns the person, or the 401 to return instead. Route handlers that own
 * user state start with this and cannot forget to, because the owner id they
 * need for Atlas only exists on the success branch.
 *
 * The message is deliberately plain and non-hostile. A signed-out person
 * hitting `POST /api/boards` is not doing anything wrong — they are a visitor
 * who liked something, and the honest answer is "sign in and this will keep",
 * not "forbidden".
 */
export async function requireUser(): Promise<
  { user: PassportUser } | { response: NextResponse }
> {
  const user = await currentUser();
  if (user) return { user };

  return {
    response: NextResponse.json(
      {
        error: "signed-out",
        message: "Sign in to keep this. Browsing needs no account.",
      },
      { status: 401 },
    ),
  };
}
