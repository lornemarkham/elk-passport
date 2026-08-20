import {
  GRADE_LABEL,
  REVIEW_NATURE_LABEL,
  type CategoryCount,
  type HealthGrade,
  type HealthReading,
  type Opportunity,
  type ReviewBacklog,
} from "@/lib/knowledge/domainHealth";
import type { PassportReadiness } from "@/lib/knowledge/passportReadiness";

/**
 * **Instruments, not charts.**
 *
 * The reference is survey and aviation instrumentation: a calibrated scale,
 * fine ticks, a plain needle, and the value printed beside it. No gauges, no
 * donuts, no glow. An instrument is trusted because it is legible and boring.
 *
 * ## Three rules
 *
 * 1. **Every visual states its number in text.** The bar is a second reading
 *    of a value the eye has already been given, never the only one. Remove
 *    every bar on this page and nothing becomes unknowable.
 * 2. **Colour is never the signal.** The grade appears as a word. Colour and
 *    fill are redundant encodings on top of it, so the panel survives
 *    monochrome, low vision, and a screenshot.
 * 3. **Any reading can be opened.** `rule`, `source` and `factors` sit behind
 *    a disclosure on every instrument. Nothing important is a mystery number.
 */

/* -------------------------------------------------------------------------
 * The scale
 * ---------------------------------------------------------------------- */

const FILL: Record<HealthGrade, string> = {
  healthy: "bg-primary",
  watch: "bg-foreground/70",
  weak: "bg-destructive/70",
  unknown: "bg-muted-foreground/40",
};

/**
 * A calibrated scale.
 *
 * Ticks at the quarters, drawn *through* the track rather than under it, so
 * the instrument reads as one object. The filled portion is the value; the
 * hairline continues to full scale so the denominator stays visible — a bar
 * that ends at its own value hides how far there is to go.
 */
function Scale({
  value,
  total,
  grade,
  label,
}: {
  value: number;
  total: number;
  grade: HealthGrade;
  label: string;
}) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);

  return (
    <span role="img" aria-label={label} className="block">
      <span className="bg-border relative block h-2 w-full overflow-hidden rounded-[2px]">
        <span
          className={`absolute inset-y-0 left-0 ${FILL[grade]}`}
          style={{ width: `${pct}%` }}
        />
        {/* Quarter ticks, cut through the whole bar. */}
        {[25, 50, 75].map((at) => (
          <span
            key={at}
            aria-hidden
            className="bg-background/70 absolute inset-y-0 w-px"
            style={{ left: `${at}%` }}
          />
        ))}
      </span>
    </span>
  );
}

/* -------------------------------------------------------------------------
 * One reading
 * ---------------------------------------------------------------------- */

export function Instrument({ reading }: { reading: HealthReading }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <h3 className="text-muted-foreground text-[11.5px] font-medium tracking-widest uppercase">
          {reading.label}
        </h3>
        <span className="text-[13px] font-medium">
          {GRADE_LABEL[reading.grade]}
        </span>
      </div>

      <p className="font-heading text-[19px] leading-none font-medium tracking-tight tabular-nums">
        {reading.value}
      </p>

      {reading.meter && (
        <div className="flex flex-col gap-1">
          <Scale
            value={reading.meter.value}
            total={reading.meter.total}
            grade={reading.grade}
            label={reading.meterLabel ?? `${reading.label}: ${reading.value}`}
          />
          {reading.meterLabel && (
            <p className="text-muted-foreground text-[12px] tabular-nums">
              {reading.meterLabel}
            </p>
          )}
        </div>
      )}

      <p className="text-muted-foreground max-w-md text-[13px] leading-relaxed">
        {reading.summary}
      </p>

      <details className="group">
        <summary className="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex w-fit cursor-pointer list-none items-baseline gap-1.5 rounded text-[12px] transition-colors focus-visible:ring-2 focus-visible:outline-none">
          <span
            aria-hidden
            className="transition-transform group-open:rotate-90"
          >
            ▸
          </span>
          How this is measured
        </summary>
        <div className="mt-2 flex flex-col gap-2">
          <ul className="marker:text-muted-foreground flex max-w-md list-disc flex-col gap-1 pl-4">
            {reading.factors.map((factor) => (
              <li key={factor} className="text-[12.5px] leading-relaxed">
                {factor}
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground max-w-md text-[12.5px] leading-relaxed">
            <span className="text-foreground/80 font-medium">Rule: </span>
            {reading.rule}
          </p>
          <p className="text-muted-foreground max-w-md font-mono text-[11.5px] leading-relaxed break-all">
            {reading.source}
          </p>
        </div>
      </details>
    </div>
  );
}

/** The instruments, side by side. No overall score — see `domainHealth.ts`. */
export function HealthPanel({
  readings,
}: {
  readings: readonly HealthReading[];
}) {
  return (
    <div className="grid gap-x-10 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
      {readings.map((reading) => (
        <Instrument key={reading.id} reading={reading} />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Evidence quality
 * ---------------------------------------------------------------------- */

const NATURE_MARK: Record<string, string> = {
  judgement: "●",
  "evidence-weakness": "○",
  unclassified: "◇",
};

/**
 * Why each waiting decision is waiting.
 *
 * The split is the point. A backlog of genuine judgement means Atlas is
 * working; a backlog of missing evidence means Atlas is asking a human to
 * compensate for a source it does not have, and no amount of curator time
 * fixes that.
 */
export function EvidenceQuality({ backlog }: { backlog: ReviewBacklog }) {
  const classified = backlog.judgement + backlog.evidenceWeakness;

  return (
    <div className="flex flex-col gap-5">
      <dl className="flex flex-wrap gap-x-10 gap-y-3">
        <div>
          <dt className="text-muted-foreground text-[12px] tracking-wide uppercase">
            Genuine judgement
          </dt>
          <dd className="text-lg font-medium tabular-nums">
            {backlog.judgement}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-[12px] tracking-wide uppercase">
            Missing evidence
          </dt>
          <dd className="text-lg font-medium tabular-nums">
            {backlog.evidenceWeakness}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-[12px] tracking-wide uppercase">
            Unclassified
          </dt>
          <dd className="text-lg font-medium tabular-nums">
            {backlog.unclassified}
          </dd>
        </div>
        {backlog.oldestDays !== undefined && (
          <div>
            <dt className="text-muted-foreground text-[12px] tracking-wide uppercase">
              Oldest waiting
            </dt>
            <dd className="text-lg font-medium tabular-nums">
              {backlog.oldestDays}d
            </dd>
          </div>
        )}
      </dl>

      <ul className="divide-border divide-y">
        {backlog.groups.map((group) => (
          <li key={group.reason} className="py-3.5 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
              <span className="inline-flex items-baseline gap-2 text-sm font-medium">
                <span
                  aria-hidden
                  className="text-muted-foreground text-[9px] leading-none"
                >
                  {NATURE_MARK[group.nature]}
                </span>
                {group.reason}
              </span>
              <span className="text-sm tabular-nums">{group.count}</span>
            </div>
            <p className="text-muted-foreground mt-0.5 text-[12px] tracking-wide uppercase">
              {REVIEW_NATURE_LABEL[group.nature]}
            </p>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed">
              {group.because}
            </p>
          </li>
        ))}
      </ul>

      <p className="text-muted-foreground max-w-2xl text-[12.5px] leading-relaxed">
        {classified > 0 && backlog.evidenceWeakness > classified / 2
          ? "Most of this backlog would disappear with better evidence, not more curator time."
          : "Most of this backlog is work only a person can do."}{" "}
        Categories are assigned by regular expressions over event messages in{" "}
        <span className="font-mono text-[11.5px]">heartbeat.ts</span>, so this
        is a reading of a heuristic — a change of wording upstream re-buckets an
        item.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------
 * What the mission knows
 * ---------------------------------------------------------------------- */

/**
 * Held knowledge, by category.
 *
 * Counts only — no percentage. Atlas has no denominator for how many parks
 * exist, and a category showing "12" is a fact while "12%" would be a claim.
 * A category Atlas cannot identify at all says so rather than reporting zero,
 * because zero and unmeasurable are different answers.
 */
export function KnowledgeTable({
  categories,
  alsoHolds,
}: {
  categories: readonly CategoryCount[];
  alsoHolds?: { label: string; count: number; note: string };
}) {
  return (
    <div className="flex flex-col gap-4">
      <ul className="divide-border divide-y">
        {categories.map((category) => {
          const empty = category.held === 0;
          return (
            <li
              key={category.key}
              className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5 py-2.5 first:pt-0 last:pb-0"
            >
              <span
                className={`text-sm ${empty ? "text-muted-foreground" : "font-medium"}`}
              >
                {category.label}
              </span>

              {/* An empty category is not a failure and is never rendered as
                  one. `0` is a score an operator can only feel bad about; the
                  publisher that would fill it is the next piece of work. Muted
                  type, never red, never a warning glyph. */}
              {empty ? (
                <span className="text-muted-foreground min-w-0 flex-1 text-right text-[12.5px] leading-relaxed">
                  Not taught yet
                  {category.notMeasurable
                    ? ` — ${category.notMeasurable}`
                    : category.taughtBy
                      ? ` — ${category.taughtBy}`
                      : ""}
                </span>
              ) : (
                <span className="text-sm tabular-nums">
                  {category.held}
                  <span className="text-muted-foreground">
                    {" "}
                    · {category.placed} placed
                  </span>
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {alsoHolds && (
        <p className="text-muted-foreground max-w-2xl text-[12.5px] leading-relaxed">
          Atlas also holds{" "}
          <span className="text-foreground font-medium tabular-nums">
            {alsoHolds.count} {alsoHolds.label.toLowerCase()}
          </span>
          . {alsoHolds.note}
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Passport readiness
 * ---------------------------------------------------------------------- */

/**
 * **Could Passport show these to a traveller?**
 *
 * Two counts and a list of what is missing. No percentage, no grade, no
 * meter — an entity is either presentable or it is short of something
 * nameable, and the name is the only actionable part.
 *
 * Deliberately not a health instrument. Health asks whether Atlas is working;
 * this asks whether the product can use what Atlas produced. They move
 * independently, and a single combined verdict would hide which one is wrong.
 */
export function PassportPanel({ readiness }: { readiness: PassportReadiness }) {
  return (
    <div className="flex flex-col gap-6">
      <dl className="flex flex-wrap gap-x-12 gap-y-3">
        <div>
          <dt className="text-muted-foreground text-[12px] tracking-wide uppercase">
            In this mission
          </dt>
          <dd className="font-heading text-[19px] font-medium tabular-nums">
            {readiness.total}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-[12px] tracking-wide uppercase">
            Passport ready
          </dt>
          <dd className="font-heading text-[19px] font-medium tabular-nums">
            {readiness.ready}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-[12px] tracking-wide uppercase">
            Needs enrichment
          </dt>
          <dd className="font-heading text-[19px] font-medium tabular-nums">
            {readiness.needsEnrichment}
          </dd>
        </div>
      </dl>

      {readiness.readyExamples.length > 0 && (
        <p className="max-w-2xl text-[13px] leading-relaxed">
          <span className="font-medium">Ready today: </span>
          <span className="text-muted-foreground">
            {readiness.readyExamples.join(" · ")}
            {readiness.ready > readiness.readyExamples.length &&
              ` and ${readiness.ready - readiness.readyExamples.length} more`}
          </span>
        </p>
      )}

      {readiness.gaps.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-muted-foreground text-[11.5px] font-medium tracking-widest uppercase">
            What is missing
          </h3>
          <ul className="divide-border divide-y">
            {readiness.gaps.map((gap) => (
              <li key={gap.key} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5">
                  <span className="text-sm font-medium">{gap.label}</span>
                  <span className="text-sm tabular-nums">
                    {gap.count} missing
                  </span>
                </div>
                <p className="text-muted-foreground mt-0.5 max-w-2xl text-[12.5px] leading-relaxed">
                  {gap.renders}
                </p>
                {gap.examples.length > 0 && (
                  <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed">
                    {gap.examples.join(" · ")}
                    {gap.count > gap.examples.length &&
                      ` and ${gap.count - gap.examples.length} more`}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {readiness.needsExamples.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-muted-foreground text-[11.5px] font-medium tracking-widest uppercase">
            Closest to ready
          </h3>
          <ul className="divide-border divide-y">
            {readiness.needsExamples.map((entity) => (
              <li
                key={entity.id}
                className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5 py-2.5 first:pt-0 last:pb-0"
              >
                <span className="text-sm">{entity.name}</span>
                <span className="text-muted-foreground text-[12.5px]">
                  needs{" "}
                  {entity.missing.map((m) => m.label.toLowerCase()).join(", ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-muted-foreground max-w-2xl text-[12.5px] leading-relaxed">
        Passport ready means the entity has every field a traveller-facing
        section actually renders — a name, a description, a picture, and for a
        place a location. The list is maintained alongside{" "}
        <span className="font-mono text-[11.5px]">passportUsage.ts</span>, which
        records what each Passport section reads. Whether an entity is
        well-sourced is a different question, measured by Evidence strength.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Opportunities
 * ---------------------------------------------------------------------- */

/** A labelled line. Used where a row has to answer more than one question. */
function Line({
  term,
  children,
  emphasis,
}: {
  term: string;
  children: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="text-muted-foreground w-32 shrink-0 text-[12px] tracking-wide uppercase">
        {term}
      </dt>
      <dd
        className={`max-w-xl text-[13px] leading-relaxed ${emphasis ? "font-medium" : "text-muted-foreground"}`}
      >
        {children}
      </dd>
    </div>
  );
}

/**
 * The same measurement as a source gap, framed as the work it implies.
 *
 * A page that says *"89 entities have only one source"* and stops has told an
 * operator they are failing. The identical fact plus the publishers that would
 * fix it is a plan. Nothing is generated: every candidate is a publisher this
 * mission has already identified, with the reason it is worth having taken
 * from its own entry.
 */
export function Opportunities({ opportunity }: { opportunity: Opportunity }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-2xl text-[15px] leading-relaxed">
        {opportunity.count} entities here rest on{" "}
        <span className="font-medium">{opportunity.sourceType}</span> alone.
        Each of these publishers would corroborate them and add something{" "}
        {opportunity.sourceType} does not carry.
      </p>

      {opportunity.candidates.length > 0 ? (
        <ul className="divide-border divide-y">
          {opportunity.candidates.map((candidate) => (
            <li key={candidate.name} className="py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5">
                <p className="text-[15px] font-medium">{candidate.name}</p>
                <p className="text-muted-foreground shrink-0 text-[11.5px] tracking-wide uppercase">
                  {candidate.status}
                </p>
              </div>

              <dl className="mt-2 flex flex-col gap-1.5">
                <Line term="Adds">{candidate.adds}</Line>
                <Line term="Why it matters">{candidate.whyItMatters}</Line>
                {/* The row that turns a catalogue into a plan. */}
                <Line term="Next action" emphasis>
                  {candidate.nextAction}
                </Line>
              </dl>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground max-w-2xl text-[13px] leading-relaxed">
          Every publisher this mission has identified is already wired. The next
          improvement is identifying a new one.
        </p>
      )}
    </div>
  );
}
