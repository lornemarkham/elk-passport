/**
 * **How often one client may ask, counted on this server instance.**
 *
 * Fixed windows, one counter per limit per client: `20 a minute and 120 an
 * hour` is two windows, and a request is let through only when every window
 * has room. A refused request is not counted, so waiting out `Retry-After` is
 * always enough.
 *
 * ## Per instance, in memory, and that is the point of saying so
 *
 * Nothing here is shared. Each serverless instance keeps its own counts, a
 * cold start begins at zero, and a client spread across several instances
 * gets each instance's allowance. That is enough to stop one tab, one script
 * or one loop from draining a scarce resource through a warm instance, and it
 * needs no store and no new service. It is **not** a global quota. The
 * cross-instance backstop for travel is Atlas's own: a fail-closed provider
 * quota of 50 openrouteservice requests a day for the whole key
 * (travel-legs/1), which answers `transient` once spent.
 *
 * Memory is bounded: at most `maxClients` clients are remembered, and the one
 * least recently seen is forgotten first. A flood of new clients can push an
 * old one out early — it then starts again at zero — which is the price of
 * never growing without bound.
 */

export interface RateLimit {
  /** Requests allowed in one window. */
  readonly max: number;
  readonly windowMs: number;
}

export type RateDecision =
  | { readonly ok: true }
  | {
      readonly ok: false;
      /** Whole seconds until every full window has room again. At least 1. */
      readonly retryAfterSeconds: number;
    };

export interface RateLimiter {
  /** Count one request from `client`, or refuse it without counting. */
  take(client: string): RateDecision;
  /** For tests: forget every client. */
  clear(): void;
}

const MAX_CLIENTS = 5_000;

export function rateLimiter({
  limits,
  maxClients = MAX_CLIENTS,
  now = () => Date.now(),
}: {
  readonly limits: readonly RateLimit[];
  readonly maxClients?: number;
  readonly now?: () => number;
}): RateLimiter {
  const windows = new Map<string, { start: number; count: number }[]>();
  return {
    take(client) {
      const t = now();
      const held =
        windows.get(client) ?? limits.map(() => ({ start: t, count: 0 }));
      let wait = 0;
      limits.forEach((limit, i) => {
        const w = held[i]!;
        if (t - w.start >= limit.windowMs) {
          w.start = t;
          w.count = 0;
        }
        if (w.count >= limit.max) {
          wait = Math.max(wait, w.start + limit.windowMs - t);
        }
      });
      // Least recently seen first: re-inserting moves a client to the end.
      windows.delete(client);
      windows.set(client, held);
      while (windows.size > maxClients) {
        windows.delete(windows.keys().next().value!);
      }
      if (wait > 0) {
        return {
          ok: false,
          retryAfterSeconds: Math.max(1, Math.ceil(wait / 1000)),
        };
      }
      for (const w of held) w.count += 1;
      return { ok: true };
    },
    clear() {
      windows.clear();
    },
  };
}

/**
 * **Who is asking, as far as a counter can tell.**
 *
 * A signed-in person is their Supabase user id, wherever they are. Anyone
 * else is the first hop of `x-forwarded-for` (or `x-real-ip`): on Vercel that
 * header is written by the platform, not the caller. Behind a proxy that
 * passes a caller's own header through, it can be forged, and the per-client
 * limit becomes a per-forgery one. With neither header, every such request
 * shares one count.
 */
export function clientKey(headers: Headers, userId?: string | null): string {
  if (userId) return `user:${userId}`;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = headers.get("x-real-ip")?.trim();
  return `ip:${forwarded || real || "unknown"}`;
}

/** The 429 every limited route answers. */
export function tooManyRequests(retryAfterSeconds: number): Response {
  return Response.json(
    {
      error: "rate-limited",
      because: `Too many requests from here just now; try again in ${retryAfterSeconds} s.`,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
        "Cache-Control": "no-store",
      },
    },
  );
}
