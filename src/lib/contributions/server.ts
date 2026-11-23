import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import {
  insidersStore,
  storeKey,
  usesMemory,
  NotReady,
} from "@/lib/insiders/store";
import { actor, queueCandidateSource } from "@/lib/insiders/service";
import {
  clientKey,
  rateLimiter,
  tooManyRequests,
} from "@/lib/server/rateLimit";
import { crossSiteRefused, isSameOrigin } from "@/lib/server/sameOrigin";
import {
  EMPTY,
  experienceLabel,
  categoryLabel,
  type Suggestion,
  type SuggestionsDoc,
} from "@/domain/contributions/model";
import { Refused, countFor } from "@/domain/contributions/actions";
import { progress, type Progress } from "@/domain/contributions/milestones";
import {
  anonKey as lightsAnonKey,
  keyFor as lightsKeyFor,
} from "@/app/christmas/_server/lights";
import type { LightsDoc } from "@/domain/christmas/lights/model";

/**
 * **Where community suggestions keep themselves**: one versioned document in
 * the Local Insider Network's compare-and-swap store (`passport_insider_docs`,
 * ADR 017's pattern, migration 20261111000000, already in production) — the
 * same store the Christmas lights map uses, which is what it is for:
 * community knowledge about the area, reviewed before anything is public.
 * Each photo is its own document beside it. **No new table, no migration, no
 * new secret.**
 *
 * ## Who a contributor is
 *
 * Nobody's email or address is written into the queue. A signed-in person is
 * a keyed hash of their email; a person with no account is a keyed hash of
 * the random token their browser keeps (`components/contributions/device.ts`),
 * falling back to their network address when the browser kept none. The same
 * token is the one the lights map's form sends, so one phone's approved
 * lights pins and approved suggestions add up to one count
 * (`contributorKeys`). **Across devices, an anonymous contributor is not
 * recognised**: a new phone, or cleared browser storage, starts at zero. That
 * is documented rather than papered over (brief, Part 3: "document that
 * limitation rather than inventing inaccurate contribution counts").
 */

const DOC = "community-suggestions";
export const photoKey = (id: string) => `community-suggestion-photo:${id}`;
const devSalt = "passport-contributions-dev";

export const NO_STORE = { "Cache-Control": "no-store" } as const;
export const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  NextResponse.json(body, { status, headers: { ...NO_STORE, ...headers } });

export async function readSuggestions(): Promise<{
  doc: SuggestionsDoc;
  version: number;
}> {
  const stored = (await insidersStore().get([DOC])).get(DOC);
  if (!stored) return { doc: EMPTY, version: 0 };
  return { doc: stored.value as SuggestionsDoc, version: stored.version };
}

/** Apply a pure change to the latest document; retried when someone wrote first. */
export async function changeSuggestions<T>(
  fn: (doc: SuggestionsDoc) => { doc: SuggestionsDoc; result: T },
): Promise<T> {
  const store = insidersStore();
  for (let attempt = 0; attempt < 8; attempt++) {
    const { doc, version } = await readSuggestions();
    const { doc: next, result } = fn(doc);
    if (next === doc) return result;
    if (await store.put(DOC, next, version)) return result;
  }
  throw new Error("contributions: too many simultaneous changes");
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
  throw new Error("contributions: photo not written");
}

export async function getPhoto(id: string): Promise<string | null> {
  const doc = (await insidersStore().get([photoKey(id)])).get(photoKey(id));
  const value = doc?.value as { data?: string } | undefined;
  return value?.data ?? null;
}

const hmac = (text: string) => {
  const base = storeKey() ?? (usesMemory() ? devSalt : null);
  if (!base) throw new NotReady("no server key for community suggestions");
  return createHmac("sha256", base).update(text).digest("base64url");
};

const DEVICE_RE = /^[A-Za-z0-9_-]{8,64}$/;

export interface Contributor {
  /** The key new suggestions are written under. */
  readonly primary: string;
  /** Every key this person's contributions may sit under, across queues. */
  readonly all: readonly string[];
  readonly signedIn: boolean;
  /** Set for administrators only. */
  readonly reviewer: string | null;
  /** Whether the count can follow them (an account) or lives on this device. */
  readonly recognisedBy: "account" | "device" | "address";
}

/** Who is contributing, as keys. Reads the account when there is one, else the device token, else the address. */
export async function contributor(
  request: Request,
  device: unknown,
): Promise<Contributor> {
  const a = await actor().catch(() => null);
  const token =
    typeof device === "string" && DEVICE_RE.test(device) ? device : "";
  const deviceKeys = token
    ? [
        "anon_" + hmac(`contributions-device:${token}`).slice(0, 16),
        lightsAnonKey(request, token),
      ]
    : [];
  if (a && a.who !== "visitor") {
    const primary = "v_" + hmac(`contributions:${a.who}`).slice(0, 22);
    return {
      primary,
      all: [primary, lightsKeyFor(a.who), ...deviceKeys],
      signedIn: true,
      reviewer: a.role === "admin" ? a.who : null,
      recognisedBy: "account",
    };
  }
  if (deviceKeys.length)
    return {
      primary: deviceKeys[0]!,
      all: deviceKeys,
      signedIn: !!a?.signedIn,
      reviewer: null,
      recognisedBy: "device",
    };
  const byAddress =
    "anon_" +
    hmac(`contributions-address:${clientKey(request.headers)}`).slice(0, 16);
  return {
    primary: byAddress,
    all: [byAddress, lightsAnonKey(request)],
    signedIn: !!a?.signedIn,
    reviewer: null,
    recognisedBy: "address",
  };
}

/** Approved lights pins by these keys: a Christmas display somebody added is a contribution too. */
async function lightsCount(keys: readonly string[]) {
  try {
    const stored = (await insidersStore().get(["christmas-lights"])).get(
      "christmas-lights",
    );
    const doc = (stored?.value as LightsDoc | undefined) ?? { pins: [] };
    const mine = doc.pins.filter((p) => keys.includes(p.submittedBy));
    return {
      approved: mine.filter((p) => p.status === "approved").length,
      pending: mine.filter((p) => p.status === "pending").length,
    };
  } catch {
    return { approved: 0, pending: 0 };
  }
}

/** This person's progress: approved suggestions and approved lights pins, over every experience. */
export async function progressFor(
  c: Contributor,
  doc?: SuggestionsDoc,
): Promise<Progress> {
  const here = countFor(doc ?? (await readSuggestions()).doc, c.all);
  const lights = await lightsCount(c.all);
  return progress(
    here.approved + lights.approved,
    here.pending + lights.pending,
  );
}

export const newId = () =>
  `sug-${randomBytes(6)
    .toString("base64url")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "x")}`;

const g = globalThis as unknown as {
  __contributionLimits?: Record<
    "write" | "read" | "review",
    ReturnType<typeof rateLimiter>
  >;
};
/**
 * Per address, per server instance: enough to stop one loop, looser than
 * the per-person pace rule in `domain/contributions/guard.ts` (12 a minute,
 * 60 an hour) so a household behind one connection meets the rule about a
 * person, said in words, before the one about an address.
 */
const limits = () =>
  (g.__contributionLimits ??= {
    write: rateLimiter({
      limits: [
        { max: 20, windowMs: 60_000 },
        { max: 100, windowMs: 3_600_000 },
      ],
    }),
    read: rateLimiter({ limits: [{ max: 60, windowMs: 60_000 }] }),
    review: rateLimiter({ limits: [{ max: 120, windowMs: 60_000 }] }),
  });

/** Same-origin, rate limit, JSON body (for POST), and refusals said in words. */
export async function handle(
  request: Request,
  limit: "write" | "read" | "review",
  who: string | null,
  fn: (body: Record<string, unknown>) => Promise<Response>,
): Promise<Response> {
  if (!isSameOrigin(request)) return crossSiteRefused();
  const decision = limits()[limit].take(clientKey(request.headers, who));
  if (!decision.ok) return tooManyRequests(decision.retryAfterSeconds);
  let body: Record<string, unknown> = {};
  if (request.method !== "GET") {
    try {
      const parsed: unknown = await request.json();
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
        body = parsed as Record<string, unknown>;
    } catch {
      return json({ error: "Send JSON." }, 400);
    }
  }
  try {
    return await fn(body);
  } catch (e) {
    if (e instanceof Refused)
      return json(
        {
          error: e.message,
          ...(e.retryAfterSeconds
            ? { retryAfterSeconds: e.retryAfterSeconds }
            : {}),
        },
        e.status,
        e.retryAfterSeconds
          ? { "Retry-After": String(e.retryAfterSeconds) }
          : undefined,
      );
    if (e instanceof NotReady)
      return json(
        {
          error: "Suggestions aren't switched on here yet — try again soon.",
          because: e.message,
        },
        503,
      );
    console.error("contributions-error", e);
    return json({ error: "Something went wrong — try again." }, 500);
  }
}

/**
 * **Hand a suggestion to Atlas** the one way Passport has: its website,
 * queued as a candidate source for Atlas to read. A suggestion with no
 * website is `no-url`; the administrator copies its facts instead
 * (`atlasCopy`). Automatic ingestion of the facts themselves is deliberately
 * not built (brief §6).
 */
export async function handToAtlas(s: Suggestion, now = new Date()) {
  if (!s.website) return { state: "no-url" as const, at: now.toISOString() };
  return queueCandidateSource(
    {
      url: s.website,
      sourceType: "community-suggestion",
      reason: `Passport community suggestion from ${experienceLabel(s.experience)}: "${s.name}" (${categoryLabel(s.category)}, ${s.location.text}${s.location.town ? `, ${s.location.town}` : ""}), approved by the administrator on ${now.toISOString().slice(0, 10)}.${s.when ? ` When: ${s.when}.` : ""}${s.description ? ` ${s.description}` : ""}`,
    },
    now,
  );
}
