import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PassportResourceType } from "./eventKinds";

// Re-exported so a server module has one import, while the shapes themselves
// stay in a file a browser can read.
export {
  channelFor,
  CORE_EVENT_KINDS,
  type PassportEvent,
  type PassportResourceType,
} from "./eventKinds";

/**
 * **How a watcher learns that something changed.**
 *
 * One append-only log, written inside the same request that changed the durable
 * state. Supabase Realtime streams the inserts to whoever is subscribed, and
 * Postgres row-level security decides who that can be — so a client subscribing
 * to a board it does not belong to receives silence rather than a rejection it
 * could probe.
 *
 * ## The rule for anyone building on this
 *
 * **The state is the truth; this is only the nudge.** A client that reconstructs
 * a board from its event stream will be wrong the first time somebody was
 * offline for one insert. The correct pattern is: receive an event, re-read the
 * canonical state. That is why the payload carries an id and not a diff, and
 * why a reload always shows the same thing as a live session.
 *
 * ## Deliberately generic
 *
 * `resourceType` is `'board'` today. A shared Discovery session, a trip, a
 * voice client changing what everyone is browsing — all the same shape, and all
 * reachable without a schema change. Nothing here knows what a board *is*, and
 * nothing game-specific belongs in it: predictions, scores and votes are an
 * Experience's business, and the moment one appears in this file it has stopped
 * being a seam.
 */

/**
 * Record a change.
 *
 * Never throws. A board item that saved correctly but whose event failed to
 * write is a board that is right and a screen that is briefly stale; turning
 * that into a failed save would be strictly worse for the person who just
 * pressed the button.
 */
export async function recordEvent(input: {
  resourceType: PassportResourceType;
  resourceId: string;
  actorId: string;
  kind: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.from("passport_events").insert({
      resource_type: input.resourceType,
      resource_id: input.resourceId,
      actor_id: input.actorId,
      kind: input.kind,
      payload: input.payload ?? {},
    });
  } catch (error) {
    console.error("Could not record a Passport event:", error);
  }
}
