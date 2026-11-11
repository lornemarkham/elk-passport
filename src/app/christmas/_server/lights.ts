import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { insidersStore, storeKey, NotReady } from "@/lib/insiders/store";
import { actor } from "@/lib/insiders/service";
import {
  clientKey,
  rateLimiter,
  tooManyRequests,
} from "@/lib/server/rateLimit";
import { crossSiteRefused, isSameOrigin } from "@/lib/server/sameOrigin";
import {
  EMPTY,
  visible,
  type LightsDoc,
  type PinView,
  type Viewer,
} from "@/domain/christmas/lights/model";
import { Refused } from "@/domain/christmas/lights/actions";
import { SEED } from "@/domain/christmas/lights/seed";

/**
 * **Where Pin the Magic keeps itself.** The pins are one versioned document
 * in the Local Insider Network's compare-and-swap store
 * (`passport_insider_docs`, ADR 017's pattern, migration 20261111000000) —
 * community knowledge about the area, reviewed before it is public, which is
 * what that store is for. Each photo is its own document beside it, so the
 * map never carries the bytes. No new table, no new secret.
 *
 * Nobody's email is written into the pins: a signed-in person is a keyed
 * hash (`viewer`), enough to stop a second reaction and to show someone
 * their own submissions. Reviewers are the network's administrators and
 * ambassadors.
 */

const DOC = "christmas-lights";
export const photoKey = (id: string) => `christmas-lights-photo:${id}`;

export const NO_STORE = { "Cache-Control": "no-store" } as const;
export const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: NO_STORE });

/** The researched public pins join once by id, so they can be reviewed like any other. */
function withSeed(doc: LightsDoc): LightsDoc {
  const have = new Set(doc.pins.map((p) => p.id));
  const add = SEED.filter((s) => !have.has(s.id));
  return add.length ? { pins: [...doc.pins, ...add] } : doc;
}

export async function readLights(): Promise<{
  doc: LightsDoc;
  version: number;
}> {
  const stored = (await insidersStore().get([DOC])).get(DOC);
  if (!stored) return { doc: withSeed(EMPTY), version: 0 };
  return { doc: withSeed(stored.value as LightsDoc), version: stored.version };
}

/** Apply a pure change to the latest document; retried when someone wrote first. */
export async function changeLights<T>(
  fn: (doc: LightsDoc) => { doc: LightsDoc; result: T },
): Promise<T> {
  const store = insidersStore();
  for (let attempt = 0; attempt < 8; attempt++) {
    const { doc, version } = await readLights();
    const { doc: next, result } = fn(doc);
    if (next === doc) return result;
    if (await store.put(DOC, next, version)) return result;
  }
  throw new Error("christmas lights: too many simultaneous changes");
}

export async function putPhoto(id: string, data: string | null) {
  const store = insidersStore();
  const key = photoKey(id);
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = (await store.get([key])).get(key);
    if (
      await store.put(
        key,
        data ? { data } : { gone: true },
        current?.version ?? 0,
      )
    )
      return;
  }
  throw new Error("christmas lights: photo not written");
}

export async function getPhoto(id: string): Promise<string | null> {
  const doc = (await insidersStore().get([photoKey(id)])).get(photoKey(id));
  const value = doc?.value as { data?: string } | undefined;
  return value?.data ?? null;
}

const devSalt = "passport-christmas-lights-dev";

function keyFor(email: string): string {
  const base =
    storeKey() ?? (process.env.NODE_ENV === "production" ? null : devSalt);
  if (!base) throw new NotReady("no server key for Christmas lights");
  return (
    "v_" +
    createHmac("sha256", base)
      .update(`christmas-lights:${email}`)
      .digest("base64url")
      .slice(0, 22)
  );
}

export interface LightsViewer extends Viewer {
  readonly signedIn: boolean;
  /** For reviewer trail entries only; never stored for anyone else. */
  readonly email: string | null;
}

/** Who is looking. A signed-out visitor sees only what is published. */
export async function viewer(): Promise<LightsViewer> {
  const a = await actor().catch(() => null);
  if (!a || a.who === "visitor")
    return { key: null, reviewer: false, signedIn: !!a?.signedIn, email: null };
  return {
    key: keyFor(a.who),
    reviewer: a.role === "admin" || a.role === "ambassador",
    signedIn: true,
    email: a.who,
  };
}

/** A stable key for a signed-out reporter: their address, hashed. */
export function visitorKey(request: Request): string {
  const base = storeKey() ?? devSalt;
  return (
    "anon_" +
    createHmac("sha256", base)
      .update(clientKey(request.headers))
      .digest("base64url")
      .slice(0, 16)
  );
}

export const newId = () =>
  `pin-${randomBytes(6)
    .toString("base64url")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "x")}`;

/** Published pins and this viewer's own, as they may see them; `null` if the store isn't ready. */
export async function lightsFor(
  v: Viewer,
  now = new Date(),
): Promise<{
  pins: PinView[];
  ready: boolean;
}> {
  try {
    const { doc } = await readLights();
    return { pins: visible(doc, v, now), ready: true };
  } catch (error) {
    console.error(
      "[christmas-lights] store unavailable:",
      error instanceof Error ? error.message : error,
    );
    return { pins: visible(withSeed(EMPTY), v, now), ready: false };
  }
}

const g = globalThis as unknown as {
  __lightsLimits?: Record<
    "write" | "react" | "report",
    ReturnType<typeof rateLimiter>
  >;
};
const limits = () =>
  (g.__lightsLimits ??= {
    write: rateLimiter({
      limits: [
        { max: 4, windowMs: 60_000 },
        { max: 20, windowMs: 3_600_000 },
      ],
    }),
    react: rateLimiter({ limits: [{ max: 60, windowMs: 60_000 }] }),
    report: rateLimiter({ limits: [{ max: 10, windowMs: 3_600_000 }] }),
  });

/** Same-origin, rate limit, JSON body, and refusals said in words. */
export async function handle(
  request: Request,
  limit: "write" | "react" | "report",
  who: string | null,
  fn: (body: Record<string, unknown>) => Promise<Response>,
): Promise<Response> {
  if (!isSameOrigin(request)) return crossSiteRefused();
  const decision = limits()[limit].take(clientKey(request.headers, who));
  if (!decision.ok) return tooManyRequests(decision.retryAfterSeconds);
  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = await request.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "Send JSON." }, 400);
  }
  try {
    return await fn(body);
  } catch (e) {
    if (e instanceof Refused) return json({ error: e.message }, e.status);
    if (e instanceof NotReady)
      return json(
        {
          error: "Pin the Magic isn't switched on here yet — try again soon.",
          because: e.message,
        },
        503,
      );
    console.error("christmas-lights-error", e);
    return json({ error: "Something went wrong — try again." }, 500);
  }
}

export const signInFirst = () =>
  json(
    { error: "Sign in first — it keeps the magic honest.", signIn: true },
    401,
  );
