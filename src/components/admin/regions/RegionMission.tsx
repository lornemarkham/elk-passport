import Link from "next/link";
import { ArrowRight, Sparkles, Target } from "lucide-react";
import type { Mission, FindingAction } from "@/lib/knowledge/regionDiagnosis";

/**
 * **Today's mission — the loudest thing on the page.**
 *
 * ## Why this dominates
 *
 * A curator opening the workspace has already decided to do *something*.
 * What they lack is *which*. Eight findings is eight decisions; this is
 * one, with the reasoning attached, so the first thing the page does is
 * answer the question they arrived with.
 *
 * ## Obviousness over elegance, on purpose
 *
 * This block is deliberately louder than the design system's restraint
 * rules would allow anywhere else. That is a scoped override, recorded in
 * `ATLAS-DESIGN-SYSTEM.md`: restraint governs surfaces read a hundred
 * times, obviousness governs the surface where someone decides what to do
 * next. **We can simplify later; we cannot simplify confusion.**
 *
 * ## The stars are arithmetic, not a rating
 *
 * Impact is `affected / total`, rounded to five. The count sits next to
 * it — *"6 of 7 entities"* — precisely so a curator can check the
 * arithmetic and argue with the ranking rather than with a hidden verdict.
 *
 * **There is no time estimate**, because Atlas has not measured one for
 * this kind of work. A plausible "~2 minutes" would be the same class of
 * error as a fabricated identifier: a number that looks like evidence and
 * is not.
 */
export function RegionMission({
  mission,
  regionId,
}: {
  mission: Mission | null;
  regionId: string;
}) {
  if (!mission) {
    // Nothing needs a human. Worth saying loudly rather than rendering
    // nothing — silence reads as "the page failed to load the mission".
    return (
      <section className="border-border rounded-xl border border-dashed px-6 py-8">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
          Nothing needs you right now
        </p>
        <p className="text-muted-foreground mt-2 max-w-2xl text-[13px] leading-relaxed">
          Atlas has no outstanding gap in this region that a person has to
          resolve. Growing it is still worthwhile when there are new sources to
          read — see what Atlas can do, below.
        </p>
      </section>
    );
  }

  return (
    <section className="border-foreground/20 bg-muted/40 overflow-hidden rounded-xl border-2">
      <div className="bg-foreground text-background flex items-center gap-2 px-6 py-2.5">
        <Target className="h-4 w-4" />
        <span className="text-[13px] font-semibold tracking-wide uppercase">
          Today&apos;s mission
        </span>
        <span className="ml-auto text-[13px] opacity-80">
          Atlas found the highest-impact improvement
        </span>
      </div>

      <div className="px-6 py-6">
        <h2 className="text-xl font-semibold tracking-tight">
          {mission.headline}
        </h2>

        <div className="mt-5 grid gap-6 sm:grid-cols-[1fr_auto]">
          <div>
            <p className="text-muted-foreground text-[13px] font-medium">
              Until this is fixed, Atlas cannot:
            </p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {mission.blocks.map((b) => (
                <li key={b} className="flex gap-2 text-sm">
                  <span className="text-muted-foreground/40 select-none">
                    ✕
                  </span>
                  <span className="text-foreground/80">{b}</span>
                </li>
              ))}
            </ul>
          </div>

          <dl className="flex shrink-0 gap-8 sm:flex-col sm:gap-4">
            <div>
              <dt className="text-muted-foreground text-[13px]">Affects</dt>
              <dd className="mt-0.5 text-2xl font-semibold tabular-nums">
                {mission.affected}
                <span className="text-muted-foreground text-sm font-normal">
                  {" "}
                  of {mission.outOf}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-[13px]">Impact</dt>
              <dd
                className="mt-0.5 text-lg tracking-[0.15em]"
                title={`${mission.affected} of ${mission.outOf} entities — impact is that share, not a rating`}
              >
                <span className="text-foreground">
                  {"★".repeat(mission.impact)}
                </span>
                <span className="text-muted-foreground/30">
                  {"★".repeat(5 - mission.impact)}
                </span>
              </dd>
            </div>
          </dl>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {mission.action && (
            <MissionButton
              action={mission.action}
              regionId={regionId}
              primary
            />
          )}
          {mission.secondary && (
            <MissionButton action={mission.secondary} regionId={regionId} />
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * The mission's own buttons.
 *
 * A `run` action does not start anything here — it points at the
 * operation panel, which owns starting, progress and completion. Two
 * controls that can both begin the same work will eventually disagree
 * about whether it is running, and *is Atlas working* cannot have two
 * answers.
 */
function MissionButton({
  action,
  regionId,
  primary,
}: {
  action: FindingAction;
  regionId: string;
  primary?: boolean;
}) {
  const base =
    "inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors";
  const tone = primary
    ? "bg-foreground text-background hover:opacity-90"
    : "border-border bg-background hover:bg-muted border";

  if (action.kind === "planned") {
    return (
      <span
        title={action.note}
        aria-disabled="true"
        className={`${base} border-border text-muted-foreground/70 cursor-not-allowed border-2 border-dashed`}
      >
        {action.label}
        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] tracking-wide text-amber-700 uppercase dark:text-amber-400">
          not built yet
        </span>
      </span>
    );
  }

  const href =
    action.kind === "link"
      ? action.href
      : action.kind === "filter"
        ? `/admin/regions/${regionId}?gap=${action.gap}#entities`
        : "#atlas-can-do";

  return (
    <Link href={href} scroll className={`${base} ${tone}`}>
      {action.label}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}
