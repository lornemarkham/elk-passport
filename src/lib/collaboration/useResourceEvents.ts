"use client";

import { useEffect, useRef } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * **Tell me when this thing changes, so I can go and re-read it.**
 *
 * Subscribes to `passport_events` for one resource. The handler receives the
 * event, and the *only* correct response is to re-fetch the canonical state —
 * never to apply the payload as a diff. A client that reconstructs state from
 * events is wrong the first time somebody's laptop slept through one, and
 * "reload shows something different from the live view" is the bug that costs
 * a day to find.
 *
 * ## Why this is only a hook, and the logic is not in it
 *
 * The subscription is a browser concern; deciding what changed is not. A native
 * client, a voice client or a background job subscribes to the same table with
 * the same row-level security and gets the same events — none of them can
 * import a React hook. So this file is deliberately thin, and everything worth
 * knowing lives in the table and its policies.
 *
 * ## Security is Postgres's, not this file's
 *
 * Supabase Realtime applies row-level security to the stream. Subscribing to a
 * board you do not belong to yields silence rather than an error — there is
 * nothing to get right here and nothing to get wrong.
 */
export interface ResourceEvent {
  readonly id: number;
  readonly kind: string;
  readonly actorId: string | null;
  readonly payload: Record<string, unknown>;
}

export function useResourceEvents(
  resourceType: "board",
  resourceId: string | null,
  onChange: (event: ResourceEvent) => void,
): void {
  // Held in a ref so a caller passing an inline arrow does not tear down and
  // rebuild the websocket subscription on every render. Assigned in an effect
  // rather than during render: writing a ref while rendering is not safe under
  // concurrent React, which may render a component and then throw the work away.
  const handler = useRef(onChange);

  useEffect(() => {
    handler.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!resourceId) return;

    const client = supabaseBrowser();
    const channel = client
      .channel(`passport:${resourceType}:${resourceId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "passport_events",
          filter: `resource_id=eq.${resourceId}`,
        },
        (message) => {
          const row = message.new as {
            id: number;
            kind: string;
            actor_id: string | null;
            payload: Record<string, unknown> | null;
            resource_type: string;
          };
          if (row.resource_type !== resourceType) return;

          handler.current({
            id: row.id,
            kind: row.kind,
            actorId: row.actor_id,
            payload: row.payload ?? {},
          });
        },
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [resourceType, resourceId]);
}
