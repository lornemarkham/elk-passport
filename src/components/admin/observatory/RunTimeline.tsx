import Link from "next/link";
import {
  AlertTriangle,
  XCircle,
  MinusCircle,
  Check,
  ArrowUpRight,
} from "lucide-react";
import { STAGE_LABEL, type IngestionEvent } from "@/lib/knowledge/runData";

/**
 * The run, event by event, in the order it happened.
 *
 * Progressive disclosure by grouping rather than by clicking: events are
 * bucketed by stage so the reader scans six headings instead of forty
 * rows, and each row carries the one sentence the recorder wrote for a
 * human. There is no raw log view — if an event needed a log line to be
 * understood, the fix is a better message, not a details toggle.
 *
 * Every row that touched a real record links into it, which is the
 * difference between a log and a workspace: the Observatory answers *how*
 * Atlas learned, and hands off to the Entity Workspace for *what it now
 * knows*.
 */

const OUTCOME_META = {
  ok: { Icon: Check, className: "text-muted-foreground/60", label: "ok" },
  skipped: {
    Icon: MinusCircle,
    className: "text-muted-foreground/60",
    label: "skipped",
  },
  failed: {
    Icon: XCircle,
    className: "text-red-600 dark:text-red-400",
    label: "failed",
  },
  "needs-attention": {
    Icon: AlertTriangle,
    className: "text-amber-600 dark:text-amber-500",
    label: "needs review",
  },
} as const;

export function RunTimeline({ events }: { events: readonly IngestionEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-muted-foreground border-border rounded-xl border border-dashed p-8 text-center text-sm">
        This run recorded no events.
      </p>
    );
  }

  // Grouped in first-occurrence order, which preserves the real sequence
  // without repeating a stage heading every few rows.
  const groups: { stage: string; events: IngestionEvent[] }[] = [];
  for (const event of [...events].sort((a, b) => a.sequence - b.sequence)) {
    const last = groups[groups.length - 1];
    if (last && last.stage === event.stage) last.events.push(event);
    else groups.push({ stage: event.stage, events: [event] });
  }

  return (
    <section className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          What happened, in order
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Each line is a real recorded event. Anything Atlas touched links
          straight to it.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {groups.map((group, groupIndex) => (
          <div
            key={`${group.stage}-${groupIndex}`}
            className="flex flex-col gap-2"
          >
            <div className="flex items-baseline gap-3">
              <h3 className="text-sm font-semibold tracking-wide uppercase">
                {STAGE_LABEL[group.stage] ?? group.stage}
              </h3>
              <span className="text-muted-foreground text-xs tabular-nums">
                {group.events.length}
              </span>
            </div>

            <div className="border-border divide-border divide-y rounded-xl border">
              {group.events.map((event) => {
                const meta = OUTCOME_META[event.outcome] ?? OUTCOME_META.ok;
                const Icon = meta.Icon;
                return (
                  <div key={event.id} className="flex items-start gap-3 p-4">
                    <Icon
                      className={`mt-0.5 h-4 w-4 shrink-0 ${meta.className}`}
                      aria-label={meta.label}
                    />

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium break-words">
                        {event.subject}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-sm leading-relaxed break-words">
                        {event.message}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {event.entityId && (
                        <Link
                          href={`/admin/entities/${event.entityId}`}
                          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs underline-offset-4 hover:underline"
                        >
                          Open entity
                          <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      )}
                      {event.sourceRecordId && !event.entityId && (
                        <span
                          className="text-muted-foreground text-[11px]"
                          title={event.sourceRecordId}
                        >
                          source {event.sourceRecordId.slice(0, 8)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
