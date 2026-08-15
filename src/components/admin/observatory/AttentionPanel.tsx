import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { IngestionEvent } from "@/lib/knowledge/runData";
import { groupAttention } from "@/lib/knowledge/heartbeat";

/**
 * What wants a human, grouped by **why**.
 *
 * A flat list of warnings forces a curator to re-derive the same
 * classification on every visit. Grouping by reason — and stating what the
 * reason *means* once per group rather than once per row — turns a wall of
 * messages into a short list of decisions.
 *
 * The framing matters as much as the grouping: nothing here failed
 * silently. Each entry is Atlas making a conservative choice and saying
 * so, which is the behaviour the whole architecture is built around.
 */
export function AttentionPanel({
  events,
}: {
  events: readonly IngestionEvent[];
}) {
  const groups = groupAttention(events);
  if (groups.length === 0) return null;

  const total = groups.reduce((n, g) => n + g.events.length, 0);

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          Wants a human ({total})
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Nothing here failed silently. Each is Atlas choosing the conservative
          option and telling you why.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <div
            key={group.reason}
            className="rounded-xl border border-amber-500/40 bg-amber-500/[0.03]"
          >
            <div className="border-b border-amber-500/20 p-4">
              <p className="flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                {group.reason}
                <span className="text-muted-foreground font-normal">
                  · {group.events.length}
                </span>
              </p>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                {group.why}
              </p>
            </div>
            <ul className="divide-border/60 divide-y">
              {group.events.map((event) => (
                <li key={event.id} className="p-4">
                  <p className="text-sm font-medium">
                    {event.entityId ? (
                      <Link
                        href={`/admin/entities/${event.entityId}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {event.subject}
                      </Link>
                    ) : (
                      event.subject
                    )}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-sm leading-relaxed">
                    {event.message}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
