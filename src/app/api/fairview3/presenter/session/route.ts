import { NextResponse } from "next/server";
import {
  guardPublicPost,
  json,
  NO_STORE,
  PRESENTER_COOKIE,
  presenterKey,
  readJson,
  withStore,
} from "@/lib/fairview3/api";

export const dynamic = "force-dynamic";

const cookie = (value: string, maxAge: number) => ({
  name: PRESENTER_COOKIE,
  value,
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge,
});

/** Is this browser the presenter? (The cookie alone is not the answer; the store is.) */
export async function GET() {
  const key = await presenterKey();
  if (!key) return json({ presenter: false });
  return withStore(async (store) =>
    json({ presenter: await store.presenterOk(key) }),
  );
}

/** Sign in with the presenter key; the key never reaches page JavaScript. */
export async function POST(request: Request) {
  const refused = guardPublicPost(request, "login");
  if (refused) return refused;
  const body = await readJson(request);
  const key = typeof body?.key === "string" ? body.key.trim() : "";
  if (!key || key.length > 200) return json({ error: "bad-request" }, 400);
  return withStore(async (store) => {
    if (!(await store.presenterOk(key)))
      return json({ ok: false, error: "forbidden" }, 403);
    const res = NextResponse.json({ ok: true }, { headers: NO_STORE });
    res.cookies.set(cookie(key, 60 * 60 * 24));
    return res;
  });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true }, { headers: NO_STORE });
  res.cookies.set(cookie("", 0));
  return res;
}
