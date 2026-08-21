import type { LearningOpportunity } from "@/lib/knowledge/learningOpportunities";

/**
 * **One entity, one work item, however many pages name it.**
 *
 * Thirteen discovered pages about Big White Ski Resort used to render as
 * thirteen rows, each headed *Big White Ski Resort*. Every row was true and
 * the whole list was operationally wrong: it asked a curator to work
 * URL-by-URL when the thing they are actually doing is teaching Atlas about a
 * resort.
 *
 * So the entity leads, the count of pages sits under it as a fact about the
 * work rather than as the work itself, and the URLs live one disclosure down —
 * present whenever provenance is the question, absent when it is not. **This
 * is hierarchy, not deletion.** Nothing was dropped: every URL, publisher,
 * status, reason and failure is still on the page.
 */
export function LearningList({
  opportunities,
  unattributed,
}: {
  opportunities: readonly LearningOpportunity[];
  unattributed: readonly {
    readonly id: string;
    readonly url: string;
    readonly host: string;
    readonly reason: string;
  }[];
}) {
  const outstanding = opportunities.filter((o) => !o.complete);
  const settled = opportunities.filter((o) => o.complete);

  return (
    <div className="flex flex-col gap-8">
      {outstanding.length === 0 && settled.length === 0 ? (
        <p className="max-w-2xl text-sm leading-relaxed">
          No entity in this domain has a discovered page waiting to be read.
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {[...outstanding, ...settled].map((opportunity) => (
            <Entity key={opportunity.entityId} opportunity={opportunity} />
          ))}
        </ul>
      )}

      {unattributed.length > 0 && <Unattributed sources={unattributed} />}
    </div>
  );
}

function Entity({ opportunity }: { opportunity: LearningOpportunity }) {
  const {
    entityName,
    queued,
    read,
    rejected,
    failed,
    learningAreas,
    publishers,
    sources,
    complete,
  } = opportunity;

  return (
    <li className="py-5 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h4 className="font-heading text-[17px] leading-snug font-medium tracking-tight">
          {entityName}
        </h4>
        {complete ? (
          <span className="text-primary text-[11px] font-medium tracking-widest uppercase">
            ✓ Learning pass complete
          </span>
        ) : (
          <span className="text-[11px] font-medium tracking-widest uppercase">
            More to learn
          </span>
        )}
      </div>

      <p className="text-muted-foreground mt-1 max-w-2xl text-[13px] leading-relaxed">
        {complete
          ? `Atlas has processed every page discovered for it so far — ${read} read${rejected > 0 ? `, ${rejected} rejected` : ""}. Discovery finding more makes this work again.`
          : `Atlas already knows this entity. ${queued + failed} discovered page${queued + failed === 1 ? " is" : "s are"} waiting to be read.`}
      </p>

      {/* The counts that are not zero, and only those. A row of zeroes reads
          as a status board; the curator needs the shape of this entity's
          pass, which is usually one or two numbers. */}
      <dl className="mt-2 flex flex-wrap gap-x-8 gap-y-1 text-[12.5px]">
        {queued > 0 && <Count term="Queued" value={queued} />}
        {failed > 0 && <Count term="Needs attention" value={failed} emphasis />}
        {read > 0 && <Count term="Read" value={read} />}
        {rejected > 0 && <Count term="Rejected" value={rejected} />}
      </dl>

      {learningAreas.length > 0 && (
        <div className="mt-3">
          <p className="text-muted-foreground text-[11px] font-medium tracking-widest uppercase">
            What Atlas can learn
          </p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {learningAreas.map((area) => (
              <li key={area} className="text-[13px] leading-relaxed">
                <span className="text-muted-foreground" aria-hidden>
                  ·{" "}
                </span>
                {area}
              </li>
            ))}
          </ul>
        </div>
      )}

      {failed > 0 && (
        <div className="mt-3">
          <p className="text-muted-foreground text-[11px] font-medium tracking-widest uppercase">
            Needs attention
          </p>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {sources
              .filter((source) => source.state === "failed")
              .map((source) => (
                <li
                  key={source.id}
                  className="max-w-2xl text-[12.5px] leading-relaxed"
                >
                  <span className="font-medium">{source.area}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    — {source.failure}
                  </span>
                </li>
              ))}
          </ul>
          <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed font-medium">
            Next: re-run the queue. A fetch failure is transport, not identity —
            the page is still queued and nothing was written for it.
          </p>
        </div>
      )}

      <p className="text-muted-foreground mt-3 text-[12.5px]">
        {publishers.join(" · ")}
      </p>

      {/* Provenance on demand. The curator should not need to open this. */}
      <details className="group mt-2">
        <summary className="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex w-fit cursor-pointer list-none items-baseline gap-1.5 rounded text-[12px] transition-colors focus-visible:ring-2 focus-visible:outline-none">
          <span
            aria-hidden
            className="transition-transform group-open:rotate-90"
          >
            ▸
          </span>
          Sources — {sources.length}
        </summary>
        <ul className="divide-border mt-2 divide-y">
          {sources.map((source) => (
            <li key={source.id} className="py-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                <span className="text-[12.5px] font-medium">{source.area}</span>
                <span className="text-muted-foreground text-[11px] tracking-wide uppercase">
                  {source.state === "read"
                    ? "Read"
                    : source.state === "rejected"
                      ? "Rejected"
                      : source.state === "failed"
                        ? "Failed"
                        : "Queued"}
                </span>
              </div>
              <p className="text-muted-foreground mt-0.5 font-mono text-[11.5px] break-all">
                {source.url}
              </p>
              <p className="text-muted-foreground mt-0.5 max-w-2xl text-[12px] leading-relaxed">
                {source.reason}
                {source.alsoTeaches > 0 &&
                  ` Also teaches ${source.alsoTeaches} other ${source.alsoTeaches === 1 ? "entity" : "entities"} — one read, not two.`}
              </p>
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}

function Count({
  term,
  value,
  emphasis,
}: {
  term: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-muted-foreground">{term}</dt>
      <dd
        className={`font-medium tabular-nums ${emphasis ? "text-destructive" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * **Pages that name no entity.**
 *
 * Kept, counted, and deliberately not attached to anything. Atlas refuses to
 * process these for one reason — it does not know who they are about — and the
 * app guessing a target here would be inventing exactly the attribution the
 * engine declined to invent.
 *
 * There is no operator workflow for resolving them, and saying so is the
 * honest answer. Drawing a button would be worse than the gap.
 */
function Unattributed({
  sources,
}: {
  sources: readonly {
    readonly id: string;
    readonly url: string;
    readonly host: string;
    readonly reason: string;
  }[];
}) {
  const publishers = [...new Set(sources.map((s) => s.host))].sort();
  return (
    <section className="border-border border-t pt-6">
      <h4 className="text-muted-foreground text-[11px] font-medium tracking-widest uppercase">
        Unattributed sources · {sources.length}
      </h4>
      <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed">
        Atlas cannot safely assign{" "}
        {sources.length === 1 ? "this page" : "these pages"} to an entity yet,
        so
        {sources.length === 1 ? " it belongs" : " they belong"} to no domain and
        the queue operation will not touch{" "}
        {sources.length === 1 ? "it" : "them"}.
      </p>
      <p className="text-muted-foreground mt-1.5 max-w-2xl text-[12.5px] leading-relaxed">
        {publishers.join(" · ")}
      </p>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed font-medium">
        No operator workflow exists yet. Resolving a target means deciding which
        entity a page is about, which is the irreversible judgement Atlas
        refuses to make alone — and nothing on this page can record it.
      </p>
      <details className="group mt-2">
        <summary className="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex w-fit cursor-pointer list-none items-baseline gap-1.5 rounded text-[12px] transition-colors focus-visible:ring-2 focus-visible:outline-none">
          <span
            aria-hidden
            className="transition-transform group-open:rotate-90"
          >
            ▸
          </span>
          The pages
        </summary>
        <ul className="divide-border mt-2 divide-y">
          {sources.map((source) => (
            <li key={source.id} className="py-2">
              <p className="text-muted-foreground font-mono text-[11.5px] break-all">
                {source.url}
              </p>
              <p className="text-muted-foreground mt-0.5 max-w-2xl text-[12px] leading-relaxed">
                {source.reason}
              </p>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
