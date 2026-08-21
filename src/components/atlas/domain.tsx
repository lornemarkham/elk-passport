import Link from "next/link";
import {
  DOMAIN_STATUS_LABEL,
  DOMAIN_STATUS_MEANING,
  PUBLISHER_STATUS_LABEL,
  PUBLISHER_STATUS_MEANING,
  publishersByStatus,
  usablePublisherCount,
  type AcquisitionStage,
  type Blocker,
  type DomainStatus,
  type KnowledgeDomain,
  type Operation,
  type Publisher,
  type PublisherStatus,
  type Subject,
  type TroubleshootingEntry,
} from "@/lib/knowledge/knowledgeDomains";
import {
  MISSION_STATE_LABEL,
  type Mission,
  type MissionOutcome,
  type MissionProgress,
} from "@/lib/knowledge/missions";
import type { AddedItem, FailureItem } from "@/lib/knowledge/domainWork";
import { CommandBlock } from "@/components/atlas/commandBlock";
import { RefreshStatus } from "@/components/atlas/missionTransition";

/**
 * **Knowledge Acquisition, as a cockpit.**
 *
 * ## The five-second test
 *
 * Open a mission with coffee in hand. Within five seconds you should know the
 * objective, roughly how long it takes, and where to click. Everything on this
 * page was cut, moved or collapsed against that test.
 *
 * ## What V4 changed
 *
 * - **`TodayBlock` dominates.** One objective, in the largest type on the page,
 *   above everything. Reason as bullets. Duration. Outcomes including the
 *   negative one. A button. And *what comes next*, so finishing never leaves a
 *   blank.
 * - **Reference collapses.** Publishers, pipeline, troubleshooting and open
 *   questions live inside `<details>`. Nothing is removed; it simply stops
 *   competing. `<details>` is keyboard-operable natively.
 * - **Prose is bullets.** Every multi-sentence paragraph became two sentences
 *   or a list.
 *
 * ## Progress without invention
 *
 * `ProgressPanel` bars measure capability against Atlas's own asserted lists —
 * publishers identified, subjects named. Those denominators are real. World
 * coverage has none and is not shown, and the panel says so.
 *
 * ## Style
 *
 * Typography, whitespace, hairlines. Rows everywhere; cards only where the
 * thing is an action — Today, and each operation. No icons, no KPI tiles, no
 * colour except status.
 */

/* -------------------------------------------------------------------------
 * Status marks
 * ---------------------------------------------------------------------- */

/** Status as shape, word, then colour — legible in monochrome. */
export function DomainStatusBadge({ status }: { status: DomainStatus }) {
  const marks: Record<DomainStatus, { glyph: string; tone: string }> = {
    operational: { glyph: "●", tone: "text-primary" },
    ready: { glyph: "◐", tone: "text-foreground" },
    planning: { glyph: "○", tone: "text-muted-foreground" },
  };
  const { glyph, tone } = marks[status];

  return (
    <span
      className="inline-flex shrink-0 items-baseline gap-1.5 text-sm"
      title={DOMAIN_STATUS_MEANING[status]}
    >
      <span aria-hidden className={`text-[10px] leading-none ${tone}`}>
        {glyph}
      </span>
      <span className="text-muted-foreground">
        {DOMAIN_STATUS_LABEL[status]}
      </span>
    </span>
  );
}

const PUBLISHER_MARK: Record<PublisherStatus, { glyph: string; tone: string }> =
  {
    operational: { glyph: "●", tone: "text-primary" },
    ready: { glyph: "◐", tone: "text-foreground" },
    planned: { glyph: "○", tone: "text-muted-foreground" },
    "research-candidate": { glyph: "◇", tone: "text-muted-foreground" },
  };

/* -------------------------------------------------------------------------
 * TODAY — the block that dominates
 * ---------------------------------------------------------------------- */

function Labelled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-muted-foreground text-[11.5px] font-medium tracking-widest uppercase">
        {label}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Bullets({ items }: { items: readonly string[] }) {
  return (
    <ul className="marker:text-muted-foreground flex list-disc flex-col gap-1.5 pl-4">
      {items.map((item) => (
        <li key={item} className="text-sm leading-relaxed">
          {item}
        </li>
      ))}
    </ul>
  );
}

const OWNER_LABEL: Record<Blocker["owner"], string> = {
  operator: "You can clear this",
  engineering: "Needs a code change",
  decision: "Needs a decision",
};

/**
 * What is in the way, who can move it, and the work that moves it.
 *
 * `owner` separates *you could fix this today* from *this waits on somebody
 * writing code*. `action` is what makes the row a task instead of a
 * description — a blocker that ends in prose has told an operator they are
 * stuck; the same blocker ending in *"Add trail tags to the POI allow list"*
 * has told them what to do about it.
 */
export function BlockerList({ blockers }: { blockers: readonly Blocker[] }) {
  if (blockers.length === 0) {
    return (
      <p className="text-sm leading-relaxed">
        Nothing is blocking this domain.
      </p>
    );
  }

  return (
    <ul className="divide-border divide-y">
      {blockers.map((blocker) => (
        <li key={blocker.what} className="py-4 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <p className="max-w-2xl text-[15px] font-medium">{blocker.what}</p>
            <p className="text-muted-foreground shrink-0 text-[12px] tracking-wide uppercase">
              {OWNER_LABEL[blocker.owner]}
            </p>
          </div>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
            {blocker.clearedBy}
          </p>
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed">
            <span className="text-muted-foreground text-[12px] tracking-wide uppercase">
              Action{" "}
            </span>
            <span className="font-medium">{blocker.action}</span>
          </p>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------
 * After the run — the static buckets
 * ---------------------------------------------------------------------- */

/**
 * Which run this is, in the operator's terms.
 *
 * A run is not tagged with a mission, so this states the definition it used
 * rather than implying one exists: the most recent run that recorded an event
 * against one of this mission's entities. A definition on the page beats a
 * label that would sometimes be wrong.
 */
export function RunHeader({
  run,
  unattributed,
}: {
  run: { label: string; startedAt: string; status: string } | null;
  unattributed: number;
}) {
  if (!run) {
    return (
      <p className="max-w-2xl text-sm leading-relaxed">
        No run has recorded anything against an entity in this mission yet. Run
        today&apos;s command above, then come back here.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <p className="max-w-2xl text-sm leading-relaxed">
        <span className="font-medium">{run.label}</span> ·{" "}
        {new Date(run.startedAt).toLocaleString()} · {run.status}
      </p>
      <p className="text-muted-foreground max-w-2xl text-[12.5px] leading-relaxed">
        The most recent run that touched something in this domain. Runs carry no
        mission tag, so this is the join Atlas can actually make: an event names
        an entity, and an entity belongs to a domain.
        {unattributed > 0 &&
          ` ${unattributed} event${unattributed === 1 ? "" : "s"} in this run named no entity here and are not counted below.`}
      </p>
    </div>
  );
}

/** Bucket 1. Nothing to do — which is worth showing, because it is most of the work. */
export function AddedList({ added }: { added: readonly AddedItem[] }) {
  if (added.length === 0) {
    return (
      <p className="max-w-2xl text-sm leading-relaxed">
        This run added nothing to the domain. That is a real result — it usually
        means Atlas already held what the sources published.
      </p>
    );
  }
  return (
    <ul className="divide-border divide-y">
      {added.map((item) => (
        <li
          key={item.entityId ?? item.name}
          className="py-3 first:pt-0 last:pb-0"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5">
            {item.entityId ? (
              <Link
                href={`/admin/entities/${item.entityId}`}
                className="focus-visible:ring-ring rounded text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
              >
                {item.name}
              </Link>
            ) : (
              <span className="text-sm font-medium">{item.name}</span>
            )}
            <span className="text-muted-foreground shrink-0 text-[12px] tracking-wide uppercase">
              {item.what}
            </span>
          </div>
          {item.detail && (
            <p className="text-muted-foreground mt-0.5 max-w-2xl text-[12.5px] leading-relaxed">
              {item.detail}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * Bucket 4. A machine failure, kept separate from a refusal.
 *
 * *The page could not be read* and *Atlas read the page and refused to act on
 * it* are opposite events that used to render identically. One is a transport
 * problem; the other is Atlas working correctly.
 */
export function FailureList({
  failures,
}: {
  failures: readonly FailureItem[];
}) {
  if (failures.length === 0) {
    return (
      <p className="max-w-2xl text-sm leading-relaxed">
        Nothing failed and nothing was refused in this domain.
      </p>
    );
  }
  return (
    <ul className="divide-border divide-y">
      {failures.map((failure) => (
        <li key={failure.id} className="py-3.5 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5">
            <span className="text-sm font-medium">{failure.subject}</span>
            <span className="text-muted-foreground shrink-0 text-[11.5px] tracking-wide uppercase">
              {failure.refused ? "Refused on purpose" : "Failed"}
              {failure.attribution === "subject-name" && " · matched by name"}
            </span>
          </div>
          <p className="text-muted-foreground mt-0.5 max-w-2xl text-[13px] leading-relaxed">
            {failure.message}
          </p>
          <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed">
            {failure.refused
              ? "Atlas read it and declined to write. Nothing to retry — this is the identity gate working."
              : "Re-running the operation retries it. A repeat failure is a publisher problem, not a data problem."}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function DomainSection({
  id,
  title,
  lede,
  children,
}: {
  id: string;
  title: string;
  lede?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="border-border scroll-mt-8 border-t pt-6"
    >
      <h2
        id={`${id}-heading`}
        className="font-heading text-xl font-medium tracking-tight"
      >
        {title}
      </h2>
      {lede && (
        <p className="text-muted-foreground mt-1.5 max-w-2xl text-sm leading-relaxed">
          {lede}
        </p>
      )}
      <div className="mt-6">{children}</div>
    </section>
  );
}

/**
 * A reference section — present, complete, and deliberately quiet.
 *
 * `<details>` rather than a tab or an accordion library: it is keyboard
 * operable, findable by browser search when open, and needs no JavaScript. The
 * summary row states what is inside so the operator can decide without opening
 * it.
 */
export function ReferenceItem({
  id,
  title,
  summary,
  children,
}: {
  id: string;
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <details id={id} className="group border-border scroll-mt-8 border-b">
      <summary className="hover:bg-muted/40 focus-visible:ring-ring flex cursor-pointer list-none items-baseline gap-4 px-1 py-4 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset">
        <span
          aria-hidden
          className="text-muted-foreground w-3 shrink-0 text-[11px] transition-transform group-open:rotate-90"
        >
          ▸
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium">{title}</span>
          <span className="text-muted-foreground mt-0.5 block text-[13px] leading-relaxed">
            {summary}
          </span>
        </span>
      </summary>
      <div className="px-1 pb-7 pl-8">{children}</div>
    </details>
  );
}

/* -------------------------------------------------------------------------
 * The mission list
 * ---------------------------------------------------------------------- */

/** One mission, as a navigable row. The third line is its current objective. */
function DomainEntry({
  domain,
  current,
  completed,
  totalMissions,
}: {
  domain: KnowledgeDomain;
  /** Derived, never authored — see `evaluateDomain`. */
  current?: Mission;
  completed: number;
  totalMissions: number;
}) {
  const usable = usablePublisherCount(domain);
  const total = domain.publishers.length;

  return (
    <Link
      href={`/admin/knowledge/${domain.slug}`}
      className="hover:bg-muted/40 focus-visible:ring-ring group flex gap-5 px-4 py-4 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
    >
      <span
        aria-hidden
        className="text-muted-foreground w-5 shrink-0 pt-0.5 text-right font-mono text-[11px] tracking-widest tabular-nums"
      >
        {domain.designation}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="font-heading truncate text-base font-medium tracking-tight">
            {domain.name}
          </span>
          <DomainStatusBadge status={domain.status} />
        </span>

        <span className="mt-1.5 block text-sm leading-relaxed">
          <span className="text-muted-foreground">Mission: </span>
          <span className="font-medium">
            {current
              ? current.title
              : completed === totalMissions
                ? "Every mission complete"
                : "Nothing startable — the rest are blocked"}
          </span>
          {completed > 0 && (
            <span className="text-muted-foreground tabular-nums">
              {"  ·  "}
              {completed} of {totalMissions} complete
            </span>
          )}
        </span>

        <span className="text-muted-foreground mt-1.5 block text-[12.5px] leading-relaxed">
          {domain.purpose}
          <span aria-hidden className="mx-2">
            ·
          </span>
          {total === 0
            ? "No publisher identified"
            : `${usable} of ${total} publishers`}
        </span>
      </span>
    </Link>
  );
}

export interface DomainListEntry {
  readonly domain: KnowledgeDomain;
  readonly current?: Mission;
  readonly completed: number;
  readonly totalMissions: number;
}

export function DomainList({
  entries,
}: {
  entries: readonly DomainListEntry[];
}) {
  return (
    <div className="border-border divide-border divide-y overflow-hidden rounded-lg border">
      {entries.map((entry) => (
        <DomainEntry
          key={entry.domain.slug}
          domain={entry.domain}
          current={entry.current}
          completed={entry.completed}
          totalMissions={entry.totalMissions}
        />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Reference content
 * ---------------------------------------------------------------------- */

export function SubjectList({ subjects }: { subjects: readonly Subject[] }) {
  return (
    <ul className="divide-border divide-y">
      {subjects.map((subject) => (
        <li
          key={subject.name}
          className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 py-3 first:pt-0 last:pb-0"
        >
          <span className="text-sm font-medium sm:w-56 sm:shrink-0">
            {subject.name}
          </span>
          <span
            className={`shrink-0 text-[12.5px] sm:w-20 ${subject.reachable ? "text-muted-foreground" : "font-medium"}`}
          >
            {subject.reachable ? "Reachable" : "Not yet"}
          </span>
          <span className="text-muted-foreground min-w-0 flex-1 text-[13px] leading-relaxed">
            {subject.via}
          </span>
        </li>
      ))}
    </ul>
  );
}

function PublisherLine({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-1.5 flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <span className="text-muted-foreground w-32 shrink-0 text-[12px] tracking-wide uppercase">
        {label}
      </span>
      <span className="max-w-2xl min-w-0 flex-1 text-[13.5px] leading-relaxed">
        {children}
      </span>
    </div>
  );
}

/** A publisher, described as something you operate. */
function PublisherEntry({ publisher }: { publisher: Publisher }) {
  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <h4 className="text-[15px] font-medium">{publisher.name}</h4>
      <PublisherLine label="Purpose">{publisher.purpose}</PublisherLine>
      {publisher.asks && (
        <PublisherLine label="Atlas asks">{publisher.asks}</PublisherLine>
      )}
      <PublisherLine label="Atlas learns">{publisher.learns}</PublisherLine>
      {publisher.limitation && (
        <PublisherLine label="Limitation">{publisher.limitation}</PublisherLine>
      )}
      {publisher.onFailure && (
        <PublisherLine label="If it fails">{publisher.onFailure}</PublisherLine>
      )}
      {publisher.operatorAction && (
        <PublisherLine label="You should">
          {publisher.operatorAction}
        </PublisherLine>
      )}
      {publisher.implementation && (
        <PublisherLine label="In">
          <span className="text-muted-foreground font-mono text-[11.5px] break-all">
            {publisher.implementation}
          </span>
        </PublisherLine>
      )}
    </li>
  );
}

function PublisherTier({
  domain,
  status,
}: {
  domain: KnowledgeDomain;
  status: PublisherStatus;
}) {
  const publishers = publishersByStatus(domain, status);
  if (publishers.length === 0) return null;
  const { glyph, tone } = PUBLISHER_MARK[status];

  return (
    <div>
      <h3 className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="inline-flex items-baseline gap-2">
          <span aria-hidden className={`text-[10px] leading-none ${tone}`}>
            {glyph}
          </span>
          <span className="text-[15px] font-medium">
            {PUBLISHER_STATUS_LABEL[status]}
          </span>
        </span>
        <span className="text-muted-foreground text-[13px] font-normal">
          {PUBLISHER_STATUS_MEANING[status]}
        </span>
      </h3>
      <ul className="divide-border mt-3 divide-y pl-5">
        {publishers.map((publisher) => (
          <PublisherEntry key={publisher.name} publisher={publisher} />
        ))}
      </ul>
    </div>
  );
}

export function PublisherLandscape({ domain }: { domain: KnowledgeDomain }) {
  if (domain.publishers.length === 0) {
    return (
      <p className="max-w-2xl text-sm leading-relaxed">
        No publisher identified — not even a research candidate. That is what
        makes this a planning domain rather than an unstarted one.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-8">
      <PublisherTier domain={domain} status="operational" />
      <PublisherTier domain={domain} status="ready" />
      <PublisherTier domain={domain} status="planned" />
      <PublisherTier domain={domain} status="research-candidate" />
    </div>
  );
}

/** The pipeline as a spine. Order is the meaning, so the stages are connected. */
export function WorkflowFlow({
  stages,
}: {
  stages: readonly AcquisitionStage[];
}) {
  return (
    <ol className="flex flex-col">
      {stages.map((stage, index) => (
        <li key={stage.name} className="relative flex gap-5 pb-6 last:pb-0">
          <div className="flex shrink-0 flex-col items-center">
            <span
              aria-hidden
              className="border-border bg-background text-muted-foreground flex h-7 w-7 items-center justify-center rounded-full border font-mono text-[11px] tabular-nums"
            >
              {index + 1}
            </span>
            {index < stages.length - 1 && (
              <span aria-hidden className="bg-border mt-1 w-px flex-1" />
            )}
          </div>

          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="text-[15px] font-medium">{stage.name}</h3>
              <span className="text-muted-foreground font-mono text-[11.5px]">
                {stage.event ?? "records no event"}
              </span>
            </div>
            <dl className="mt-2 grid gap-x-6 gap-y-2 md:grid-cols-3">
              <div>
                <dt className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                  Atlas does
                </dt>
                <dd className="mt-0.5 text-[13.5px] leading-relaxed">
                  {stage.atlasDoes}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                  You do
                </dt>
                <dd className="mt-0.5 text-[13.5px] leading-relaxed">
                  {stage.operatorDoes}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                  Results in
                </dt>
                <dd className="mt-0.5 text-[13.5px] leading-relaxed">
                  {stage.adminHref ? (
                    <Link
                      href={stage.adminHref}
                      className="focus-visible:ring-ring rounded font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {stage.adminLabel}
                    </Link>
                  ) : (
                    stage.resultsIn
                  )}
                </dd>
              </div>
            </dl>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function TroubleshootingList({
  entries,
}: {
  entries: readonly TroubleshootingEntry[];
}) {
  return (
    <ul className="divide-border divide-y">
      {entries.map((entry) => (
        <li key={entry.id} className="py-5 first:pt-0 last:pb-0">
          <h3 className="max-w-2xl text-[15px] font-medium">{entry.symptom}</h3>
          <div className="mt-2.5 grid gap-x-8 gap-y-2.5 md:grid-cols-2">
            <div>
              <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                Means
              </p>
              <p className="mt-0.5 text-[13.5px] leading-relaxed">
                {entry.meaning}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                Does not mean
              </p>
              <p className="mt-0.5 text-[13.5px] leading-relaxed">
                {entry.notThis}
              </p>
            </div>
          </div>
          <ol className="marker:text-muted-foreground mt-3 flex max-w-2xl list-decimal flex-col gap-1 pl-4">
            {entry.whatToDo.map((step) => (
              <li key={step} className="text-[13.5px] leading-relaxed">
                {step}
              </li>
            ))}
          </ol>
          <p className="text-muted-foreground mt-2 font-mono text-[11.5px] break-all">
            {entry.decidedIn}
          </p>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------
 * Operations
 * ---------------------------------------------------------------------- */

function OperationBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <p className="text-muted-foreground text-[11.5px] font-medium tracking-wide uppercase">
        {label}
      </p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Checklist({ items }: { items: readonly string[] }) {
  return (
    <ul className="marker:text-muted-foreground flex max-w-2xl list-disc flex-col gap-1 pl-4">
      {items.map((item) => (
        <li key={item} className="text-[13.5px] leading-relaxed">
          {item}
        </li>
      ))}
    </ul>
  );
}

/**
 * One operation — a card, because it is an action.
 *
 * The only cards on this page are Today and these. Everything else is rows.
 */
export function OperationCard({
  operation,
  recommended,
}: {
  operation: Operation;
  recommended?: boolean;
}) {
  return (
    <article
      id={`op-${operation.id}`}
      aria-labelledby={`op-${operation.id}-heading`}
      className={`scroll-mt-8 rounded-lg border px-6 py-5 ${recommended ? "border-foreground/30" : "border-border"}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3
          id={`op-${operation.id}-heading`}
          className="font-heading text-lg font-medium tracking-tight"
        >
          {operation.title}
          {recommended && (
            <span className="text-muted-foreground ml-3 align-middle text-[11.5px] font-medium tracking-widest uppercase">
              Today
            </span>
          )}
        </h3>
        <span className="text-muted-foreground shrink-0 text-[12.5px]">
          {operation.duration}
        </span>
      </div>

      <p className="mt-1.5 max-w-2xl text-sm leading-relaxed">
        {operation.purpose}
      </p>
      <p className="text-muted-foreground mt-1 max-w-2xl text-[13.5px] leading-relaxed">
        <span className="text-foreground/80 font-medium">When: </span>
        {operation.whenToUse}
      </p>

      {operation.before.length > 0 && (
        <OperationBlock label="Before you run it">
          <Checklist items={operation.before} />
        </OperationBlock>
      )}

      <OperationBlock label="Command">
        <CommandBlock
          workingDirectory={operation.workingDirectory}
          command={operation.command}
        />
      </OperationBlock>

      <OperationBlock label="Expected">
        <p className="max-w-2xl text-[13.5px] leading-relaxed">
          {operation.expected}
        </p>
      </OperationBlock>

      <OperationBlock label="Then check">
        <Checklist items={operation.thenCheck} />
        {operation.checkHref && (
          <Link
            href={operation.checkHref}
            className="focus-visible:ring-ring mt-2.5 inline-block rounded text-[13.5px] font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
          >
            Open {operation.checkLabel}
          </Link>
        )}
      </OperationBlock>

      {operation.knownFailures.length > 0 && (
        <details className="group border-border mt-4 border-t pt-3">
          <summary className="focus-visible:ring-ring text-muted-foreground hover:text-foreground flex cursor-pointer list-none items-baseline gap-2 rounded text-[12.5px] font-medium tracking-wide uppercase transition-colors focus-visible:ring-2 focus-visible:outline-none">
            <span
              aria-hidden
              className="transition-transform group-open:rotate-90"
            >
              ▸
            </span>
            {operation.knownFailures.length} known failure
            {operation.knownFailures.length === 1 ? "" : "s"} and recovery
          </summary>
          <ul className="divide-border mt-3 divide-y">
            {operation.knownFailures.map((failure) => (
              <li key={failure.symptom} className="py-3 first:pt-0 last:pb-0">
                <p className="max-w-2xl text-[13.5px] font-medium">
                  {failure.symptom}
                </p>
                <p className="text-muted-foreground mt-0.5 max-w-2xl text-[13px] leading-relaxed">
                  {failure.meaning}
                </p>
                <p className="mt-0.5 max-w-2xl text-[13px] leading-relaxed">
                  <span className="text-muted-foreground">Recovery: </span>
                  {failure.recovery}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}

      {operation.note && (
        <p className="text-muted-foreground border-border mt-4 max-w-2xl border-t pt-3 text-[13px] leading-relaxed">
          {operation.note}
        </p>
      )}
    </article>
  );
}

/** The runbook, recommended operation first. */
export function Runbook({
  operations,
  recommendedId,
}: {
  operations: readonly Operation[];
  recommendedId?: string;
}) {
  if (operations.length === 0) {
    return (
      <p className="max-w-2xl text-sm leading-relaxed">
        Nothing to run. Nothing has been aimed at this mission, so no command
        would teach Atlas anything — and a button that did nothing would be
        worse than none.
      </p>
    );
  }

  const ordered = [...operations].sort((a, b) => {
    if (a.id === recommendedId) return -1;
    if (b.id === recommendedId) return 1;
    return 0;
  });

  return (
    <div className="flex flex-col gap-5">
      {ordered.map((operation) => (
        <OperationCard
          key={operation.id}
          operation={operation}
          recommended={operation.id === recommendedId}
        />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------
 * The mission — three phases, one section
 * ---------------------------------------------------------------------- */

/**
 * **Execute · Review · Complete.**
 *
 * The whole loop, visible without scrolling, because the operator does the
 * same three things every day and should not have to hunt for any of them.
 *
 * They are one section rather than three, deliberately. Three sections read as
 * three separate concerns an operator must decide between; a numbered strip
 * reads as one job with three parts, which is what it is.
 *
 * Everything explanatory sits behind a disclosure. The page used to lead with
 * why the mission mattered and what could go wrong — accurate, and read once.
 * What is needed every day is the command, the questions, and whether it is
 * finished.
 */
function PhaseHeading({
  index,
  title,
  hint,
  count,
}: {
  index: number;
  title: string;
  hint?: string;
  count?: number;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
      <span
        aria-hidden
        className="text-muted-foreground font-mono text-[11px] tracking-widest tabular-nums"
      >
        {index}
      </span>
      <h3 className="font-heading text-[15px] font-medium tracking-tight">
        {title}
      </h3>
      {count !== undefined && count > 0 && (
        <span className="text-sm tabular-nums">{count}</span>
      )}
      {hint && (
        <span className="text-muted-foreground text-[12.5px]">{hint}</span>
      )}
    </div>
  );
}

/** The mission itself: what it is, and the command that starts it. */
export function MissionHeader({
  mission,
  operation,
  state,
  surface,
  commandLeads,
}: {
  mission: Mission;
  operation?: Operation;
  /** Derived by `evaluateDomain`. Never read off the mission. */
  state: MissionProgress["state"];
  /**
   * **The on-page working surface, when this mission has one.**
   *
   * Present means the operator does the work here and the command becomes a
   * fallback behind a disclosure — still printed, still verified, no longer
   * the instruction. Absent means the terminal is genuinely the only way, and
   * the command leads. Which of the two is true is declared by the mission
   * (`Mission.surface`), never guessed from its id.
   */
  surface?: React.ReactNode;
  /**
   * **True when the surface shows the work but does not perform it.**
   *
   * A placement list *is* the operation — the command belongs behind a
   * disclosure there. A list of entities waiting to be taught is a picture of
   * what the command will do, and demoting the command would hide the only
   * thing that moves the mission forward.
   */
  commandLeads?: boolean;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-muted-foreground text-[11.5px] font-medium tracking-widest uppercase">
          Mission · {MISSION_STATE_LABEL[state]}
        </p>
        <h2 className="font-heading mt-1.5 max-w-2xl text-2xl leading-tight font-medium tracking-tight">
          {mission.title}
        </h2>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed">
          {mission.outcome}
        </p>
      </div>

      {state === "blocked" && mission.blockedBy && (
        <p className="max-w-2xl text-sm leading-relaxed">
          <span className="text-muted-foreground text-[12px] tracking-wide uppercase">
            Blocked{" "}
          </span>
          {mission.blockedBy}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <PhaseHeading index={1} title="Execute" hint={mission.duration} />

        {surface ?? null}

        {operation ? (
          surface && !commandLeads ? (
            // Demoted, not removed. The command still exists and still works;
            // it is no longer what the page tells you to do.
            <details className="group mt-1">
              <summary className="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex w-fit cursor-pointer list-none items-baseline gap-1.5 rounded text-[12px] transition-colors focus-visible:ring-2 focus-visible:outline-none">
                <span
                  aria-hidden
                  className="transition-transform group-open:rotate-90"
                >
                  ▸
                </span>
                Or run it from the terminal
              </summary>
              <div className="mt-2">
                <CommandBlock
                  workingDirectory={operation.workingDirectory}
                  command={operation.command}
                />
              </div>
            </details>
          ) : (
            <CommandBlock
              workingDirectory={operation.workingDirectory}
              command={operation.command}
            />
          )
        ) : surface ? null : (
          <p className="max-w-2xl text-sm leading-relaxed">
            No command — this mission is a decision or a code change, not a run.
          </p>
        )}

        {/* The MVP loop, stated. An operation may legitimately be a terminal
            command — what matters is that the page reflects its result, and
            that the operator has something obvious to press when they come
            back. Everything here is derived, so refreshing *is* the
            mechanism: no polling, no job to track. */}
        <div className="mt-1 flex flex-col gap-2">
          <p className="text-muted-foreground max-w-2xl text-[12.5px] leading-relaxed">
            <span className="text-foreground/70">Status: </span>
            {surface && !commandLeads
              ? "Ready — do it here, and the counts update as you go."
              : operation
                ? "Waiting for the operation. Run the command, then refresh — Atlas works out what changed."
                : "Waiting on a decision or a code change. Nothing here to run."}
          </p>
          <RefreshStatus />
        </div>

        {/* Instructions for work the page now performs are noise. Kept when
            the terminal is still the only route. */}
        {(!surface || commandLeads) && (
          <ol className="marker:text-muted-foreground mt-1 flex max-w-2xl list-decimal flex-col gap-1.5 pl-4">
            {mission.steps.map((step) => (
              <li key={step.title} className="text-[13px] leading-relaxed">
                <span className="font-medium">{step.title}</span> —{" "}
                {step.detail}
              </li>
            ))}
          </ol>
        )}

        <details className="group">
          <summary className="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex w-fit cursor-pointer list-none items-baseline gap-1.5 rounded text-[12px] transition-colors focus-visible:ring-2 focus-visible:outline-none">
            <span
              aria-hidden
              className="transition-transform group-open:rotate-90"
            >
              ▸
            </span>
            Why this mission, and what can go wrong
          </summary>
          <div className="mt-2 flex flex-col gap-3">
            <Bullets items={mission.why} />
            {operation && (
              <div className="flex flex-col gap-2">
                <Labelled label="Expect">{operation.expected}</Labelled>
                {operation.knownFailures.map((failure) => (
                  <Labelled key={failure.symptom} label={failure.symptom}>
                    {failure.meaning} {failure.recovery}
                  </Labelled>
                ))}
              </div>
            )}
          </div>
        </details>
      </div>
    </div>
  );
}

/**
 * **Complete — derived, never awarded.**
 *
 * Each condition is evaluated against Atlas's own state. Nothing is stored and
 * nothing is scored: a mission is finished because the corpus changed, which
 * is the same reason health moved. If reality regresses, this un-completes,
 * and that is correct.
 *
 * `unverifiable` is rendered as its own state rather than as an unticked box.
 * An unticked box says work is outstanding; *cannot be verified* says Atlas
 * has no way to know, which is a different and more useful statement.
 */
export function MissionComplete({
  outcome,
  nextTitle,
}: {
  outcome: MissionOutcome;
  /** The mission that becomes current when this one finishes. */
  nextTitle?: string;
}) {
  const mark = (state: string) =>
    state === "done" ? "✓" : state === "unverifiable" ? "?" : "○";

  return (
    <div className="flex flex-col gap-4">
      <PhaseHeading
        index={3}
        title="Complete"
        hint={
          outcome.complete
            ? "Everything below is true"
            : outcome.awaitingYou
              ? "Only your confirmation is left"
              : `${outcome.remaining} left`
        }
      />

      {outcome.complete && (
        <p className="font-heading max-w-2xl text-[17px] leading-snug font-medium tracking-tight">
          Mission complete.
        </p>
      )}

      <ul className="divide-border divide-y">
        {outcome.conditions.map(({ condition, result }) => (
          <li
            key={condition.id}
            className="flex gap-3 py-3 first:pt-0 last:pb-0"
          >
            <span
              aria-hidden
              className={`mt-[3px] shrink-0 text-[13px] leading-none ${
                result.state === "done"
                  ? "text-primary"
                  : "text-muted-foreground/50"
              }`}
            >
              {mark(result.state)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">
                {condition.label}
                <span className="sr-only">
                  {result.state === "done"
                    ? " — done"
                    : result.state === "unverifiable"
                      ? " — cannot be verified"
                      : " — not done"}
                </span>
              </span>
              <span className="text-muted-foreground mt-0.5 block max-w-2xl text-[12.5px] leading-relaxed">
                {result.state === "unverifiable" && "Cannot be verified — "}
                {result.detail}
              </span>
            </span>
          </li>
        ))}
      </ul>

      {outcome.complete && nextTitle && (
        <p className="max-w-2xl text-sm leading-relaxed">
          <span className="text-muted-foreground">Next mission: </span>
          <span className="font-medium">{nextTitle}</span>
        </p>
      )}
    </div>
  );
}

/** Every mission in this domain, so the operator can see the shape of the work. */
export function MissionRoster({
  missions,
}: {
  missions: readonly MissionProgress[];
}) {
  if (missions.length === 0) {
    return (
      <p className="max-w-2xl text-sm leading-relaxed">
        No missions are defined for this domain yet.
      </p>
    );
  }
  return (
    <ul className="divide-border divide-y">
      {missions.map(({ mission, state }) => (
        <li
          key={mission.id}
          className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5 py-2.5 first:pt-0 last:pb-0"
        >
          <span className="flex min-w-0 items-baseline gap-2">
            <span
              aria-hidden
              className={`shrink-0 text-[11px] leading-none ${state === "complete" ? "text-primary" : "text-muted-foreground/40"}`}
            >
              {state === "complete" ? "✓" : "○"}
            </span>
            <span
              className={`text-sm ${state === "current" ? "font-medium" : state === "complete" ? "text-muted-foreground" : ""}`}
            >
              {mission.title}
            </span>
          </span>
          <span className="text-muted-foreground shrink-0 text-[11.5px] tracking-wide uppercase">
            {MISSION_STATE_LABEL[state]}
          </span>
        </li>
      ))}
    </ul>
  );
}
