import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import {
  MAX_DISPLAY_NAME,
  MAX_HOME_AREA,
  profileFor,
  saveProfile,
} from "@/lib/profile/profileService";

/**
 * A person's own profile. There is no route for anybody else's — the id is
 * always the session's, so there is no id to tamper with.
 */
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  return NextResponse.json(await profileFor(auth.user));
}

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected an object." }, { status: 400 });
  }

  const text = (value: unknown, max: number): string | undefined | null =>
    value === undefined
      ? undefined
      : typeof value === "string" && value.length <= max
        ? value
        : null; // present but unusable

  const displayName = text(body.displayName, MAX_DISPLAY_NAME);
  const homeArea = text(body.homeArea, MAX_HOME_AREA);
  const timezone = text(body.timezone, 64);

  if (displayName === null || homeArea === null || timezone === null) {
    return NextResponse.json(
      { error: "That is longer than Passport can store." },
      { status: 400 },
    );
  }

  return NextResponse.json(
    await saveProfile(auth.user, { displayName, homeArea, timezone }),
  );
}
