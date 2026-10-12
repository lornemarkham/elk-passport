import { describe, expect, it } from "vitest";
import { clientKey, rateLimiter, tooManyRequests } from "./rateLimit";

describe("rateLimiter — per client, per instance", () => {
  const minuteAndHour = (now: () => number, maxClients?: number) =>
    rateLimiter({
      limits: [
        { max: 3, windowMs: 60_000 },
        { max: 5, windowMs: 3_600_000 },
      ],
      now,
      ...(maxClients ? { maxClients } : {}),
    });

  it("lets a client through until a window is full, then says how long to wait", () => {
    let t = 0;
    const limiter = minuteAndHour(() => t);
    for (let i = 0; i < 3; i += 1) expect(limiter.take("a").ok).toBe(true);
    t = 15_000;
    expect(limiter.take("a")).toEqual({ ok: false, retryAfterSeconds: 45 });
    // Another client has its own count.
    expect(limiter.take("b").ok).toBe(true);
  });

  it("does not count a refused request, so waiting it out is enough", () => {
    let t = 0;
    const limiter = minuteAndHour(() => t);
    for (let i = 0; i < 3; i += 1) limiter.take("a");
    for (let i = 0; i < 10; i += 1) expect(limiter.take("a").ok).toBe(false);
    t = 60_000;
    expect(limiter.take("a").ok).toBe(true);
  });

  it("holds the longer window too", () => {
    let t = 0;
    const limiter = minuteAndHour(() => t);
    for (let i = 0; i < 3; i += 1) limiter.take("a");
    t = 60_000;
    expect(limiter.take("a").ok).toBe(true);
    expect(limiter.take("a").ok).toBe(true);
    // Five in the hour: the minute has room, the hour does not.
    expect(limiter.take("a")).toEqual({
      ok: false,
      retryAfterSeconds: 3_540,
    });
  });

  it("remembers at most maxClients, forgetting the least recently seen", () => {
    const limiter = minuteAndHour(() => 0, 2);
    for (let i = 0; i < 3; i += 1) limiter.take("a");
    expect(limiter.take("a").ok).toBe(false);
    limiter.take("b");
    limiter.take("c"); // "a" was seen before "b": it goes.
    expect(limiter.take("a").ok).toBe(true);
  });
});

describe("clientKey", () => {
  it("is the user when signed in, else the first forwarded hop", () => {
    const h = new Headers({
      "x-forwarded-for": "203.0.113.7, 10.0.0.1",
      "x-real-ip": "198.51.100.2",
    });
    expect(clientKey(h, "user-1")).toBe("user:user-1");
    expect(clientKey(h, null)).toBe("ip:203.0.113.7");
    expect(clientKey(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe(
      "ip:198.51.100.2",
    );
    expect(clientKey(new Headers())).toBe("ip:unknown");
  });
});

describe("tooManyRequests", () => {
  it("is a 429 with Retry-After and a JSON error", async () => {
    const response = tooManyRequests(42);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    expect(await response.json()).toMatchObject({ error: "rate-limited" });
  });
});
