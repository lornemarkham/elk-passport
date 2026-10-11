"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

/**
 * **What Passport measures about its own visitors, and what it refuses to.**
 *
 * Vercel Web Analytics and Speed Insights: first-party, served from this
 * domain, no cookies, no device fingerprint, no cross-site identifier, and no
 * session recording. That is the whole of it, and it is a deliberate choice
 * over the GTM → GA4 → Clarity stack, which would have meant a third-party
 * container able to load arbitrary tags later and a replay of what each person
 * did on screen.
 *
 * ## Why that mattered here rather than being a preference
 *
 * This product already has a written privacy position and it is unusually
 * specific. `useHere` says a reader's blunted position is written to "no
 * database, no cookie, no `localStorage`, no log line, and no analytics call",
 * and ADR 002 says the same about coordinates. Session replay records the
 * rendered page, which on Discovery includes the area somebody's position
 * resolved to and on `/account` includes their own name. Shipping it would
 * have contradicted a documented commitment, with no consent banner in front
 * of it. The conflict was named and a human chose; this is what they chose.
 *
 * ## The query string is stripped before anything is sent
 *
 * Passport's own URLs carry the exploration: `?who=child&age=5&on=2026-10-11`.
 * **A child's age is not a thing to send to an analytics service**, and
 * Vercel's default event carries the full URL. `beforeSend` cuts everything
 * from the `?` onwards, so what leaves the browser is a path — `/discovery`,
 * `/day/{id}` — and never an answer somebody gave about their family.
 *
 * It is a function, so it cannot be passed from a Server Component: that is
 * why this is a client component rather than two tags in `layout.tsx`.
 *
 * ## What this is for
 *
 * Speed Insights is the other half of `e2e/nfr.spec.ts`. That file measures a
 * local production build on loopback and says, at length, that it is not an
 * SLA measurement. This is where the real number comes from — a real phone, a
 * real network, a cold function — and it is the only place that can say
 * whether the 2.77MB Discovery payload actually costs a person anything.
 */
const withoutQuery = <T extends { url: string }>(event: T): T => ({
  ...event,
  url: event.url.split("?")[0] ?? event.url,
});

export function Measurement() {
  return (
    <>
      <Analytics beforeSend={withoutQuery} />
      <SpeedInsights beforeSend={withoutQuery} />
    </>
  );
}
