import "server-only";
import { track } from "@vercel/analytics/server";

type Props = Record<string, string | number | boolean | null>;

/**
 * **What Hockey Night counts on the server**: a night started, an
 * invitation made, an invitation used — so the public pages' clicks
 * (`CreateNightLink`) can be read against what people actually did.
 *
 * Vercel Web Analytics custom events, the same first-party, cookieless
 * service `Measurement` already uses. Never a user id, a night id, a name,
 * an email or a team somebody declared: only the event and how it came
 * about (`via` is one of the public pages' own labels, or "direct").
 * Off the Vercel platform it does nothing; it never fails a request.
 */
export async function measure(event: string, props?: Props): Promise<void> {
  if (!process.env.VERCEL) return;
  try {
    await track(event, props);
  } catch {
    // Counting is never worth a failed night.
  }
}
