import "server-only";
import { track } from "@vercel/analytics/server";

type Props = Record<string, string | number | boolean | null>;

/**
 * **Server-side counting**: Vercel Web Analytics custom events, the same
 * first-party, cookieless service `Measurement` uses for page views. Never a
 * user id, an email, a name, an address or a coordinate: only the event and
 * coarse labels (a town, a kind). Off the Vercel platform it does nothing;
 * it never fails a request.
 */
export async function measure(event: string, props?: Props): Promise<void> {
  if (!process.env.VERCEL) return;
  try {
    await track(event, props);
  } catch {
    // Counting is never worth a failed request.
  }
}
