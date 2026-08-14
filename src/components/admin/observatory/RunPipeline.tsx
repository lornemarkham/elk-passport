import {
  stageRank,
  STAGE_LABEL,
  type IngestionEvent,
} from "@/lib/knowledge/runData";

/**
 * The pipeline a run actually moved through, rendered from its real
 * events.
 *
 * **Nothing here is decorative.** Every stage shown exists because events
 * with that stage were persisted; a stage the run never reached is absent
 * rather than greyed out, because "Atlas didn't get that far" and "Atlas
 * did that with zero results" are different facts and the difference
 * matters when something looks wrong.
 *
 * Deliberately not an animation. A moving diagram would imply live
 * progress this page does not have — runs are recorded, then read. Showing
 * motion for a finished run would be the fake-pipeline failure mode the
 * brief explicitly ruled out.
 */
export function RunPipeline({ events }: { events: readonly IngestionEvent[] }) {
  const byStage = new Map<
    string,
    { total: number; attention: number; failed: number }
  >();
  for (const event of events) {
    const bucket = byStage.get(event.stage) ?? {
      total: 0,
      attention: 0,
      failed: 0,
    };
    bucket.total += 1;
    if (event.outcome === "needs-attention") bucket.attention += 1;
    if (event.outcome === "failed") bucket.failed += 1;
    byStage.set(event.stage, bucket);
  }

  const stages = [...byStage.entries()]
    .map(([stage, counts]) => ({ stage, ...counts }))
    .sort((a, b) => stageRank(a.stage) - stageRank(b.stage));

  if (stages.length === 0) return null;

  return (
    <section className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          How this run moved
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Every stage below is drawn from real recorded events. A stage the run
          never reached simply isn&apos;t here.
        </p>
      </div>

      <div className="flex flex-wrap items-stretch gap-2">
        {stages.map((s, index) => (
          <div key={s.stage} className="flex items-stretch gap-2">
            <div
              className={`border-border min-w-[126px] rounded-xl border px-4 py-3 ${
                s.failed > 0
                  ? "border-red-500/50 bg-red-500/5"
                  : s.attention > 0
                    ? "border-amber-500/50 bg-amber-500/5"
                    : ""
              }`}
            >
              <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                {STAGE_LABEL[s.stage] ?? s.stage}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {s.total}
              </p>
              {(s.attention > 0 || s.failed > 0) && (
                <p className="mt-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-500">
                  {s.failed > 0
                    ? `${s.failed} failed`
                    : `${s.attention} to review`}
                </p>
              )}
            </div>
            {index < stages.length - 1 && (
              <span
                className="text-muted-foreground/40 self-center text-lg"
                aria-hidden
              >
                →
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
