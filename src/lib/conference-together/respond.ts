import "server-only";
import { NextResponse } from "next/server";
import { NO_STORE } from "@/lib/conference/request";

const STATUS: Record<string, number> = {
  "not-found": 404,
  forbidden: 403,
  invalid: 400,
  full: 409,
};

/** The shared modules' answers, in the foundation's shape (`{ok}` / `{error}`). */
export const reply = (
  r:
    | ({ ok: true } & object)
    | {
        ok: false;
        error: string;
        issues?: readonly { path: string; message: string }[];
      },
) =>
  r.ok
    ? NextResponse.json(r, { headers: NO_STORE })
    : NextResponse.json(
        { error: r.error, ...(r.issues ? { issues: r.issues } : {}) },
        { status: STATUS[r.error] ?? 400, headers: NO_STORE },
      );

export const notFound = () =>
  NextResponse.json({ error: "not-found" }, { status: 404, headers: NO_STORE });

export const body = async (
  request: Request,
): Promise<Record<string, unknown>> =>
  (await request.json().catch(() => ({}))) as Record<string, unknown>;
