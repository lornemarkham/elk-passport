import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import {
  preferencesFor,
  savePreferences,
} from "@/lib/preferences/preferenceService";

export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  return NextResponse.json(await preferencesFor(auth.user));
}

/**
 * Apply explicit settings.
 *
 * A name the vocabulary does not declare comes back in `rejected` rather than
 * being stored: a setting Passport cannot name is one it cannot honour, and
 * accepting it silently would create the appearance of a boundary that nothing
 * enforces. Everything valid in the same request still lands.
 */
export async function PATCH(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Expected an object." }, { status: 400 });
  }

  const result = await savePreferences(
    auth.user,
    body as Record<string, unknown>,
  );

  return NextResponse.json(result, {
    status: result.rejected.length > 0 ? 422 : 200,
  });
}
