import Link from "next/link";
import type { DomainWorkQueue } from "@/lib/knowledge/workQueue";

/**
 * **What needs you.**
 *
 * The first thing on a Knowledge Domain page, because *what needs me?* is the
 * first thing an operator asks and the answer used to be spread across five
 * sections with no way to know you had seen them all.
 *
 * Every group states **why the items are here, what is missing, and what to do
 * about it**, and links to the section that renders the items themselves. A
 * count with no action is a complaint; this page does not make complaints.
 *
 * The counts are not summed into one headline. Five different kinds of thing —
 * an unplaced entity, a proposed merge, an unread page, a missing field, a
 * failed fetch — do not share a unit, and adding them would produce a number
 * that looks precise and means nothing.
 */
export function WorkQueue({ queue }: { queue: DomainWorkQueue }) {
  if (queue.outstanding.length === 0) return null;

  return (
    <div className="flex flex-col gap-5">
      <p className="max-w-2xl text-sm leading-relaxed">
        {queue.outstanding.length === 1
          ? "One kind of work is outstanding."
          : `${queue.outstanding.length} kinds of work are outstanding.`}{" "}
        {!queue.readsComplete && (
          <span className="text-muted-foreground">
            A read did not answer, so treat every count as a floor.
          </span>
        )}
      </p>

      <ul className="divide-border divide-y">
        {queue.outstanding.map((group) => (
          <li key={group.key} className="py-4 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5">
              <Link
                href={group.href}
                className="focus-visible:ring-ring rounded text-[15px] font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
              >
                {group.label}
              </Link>
              <span className="font-heading text-[19px] font-medium tabular-nums">
                {group.count}
              </span>
            </div>

            <p className="text-muted-foreground mt-1 max-w-2xl text-[13px] leading-relaxed">
              {group.because}
            </p>
            {group.missing && (
              <p className="text-muted-foreground mt-0.5 max-w-2xl text-[12.5px] leading-relaxed">
                <span className="text-foreground/70">Missing: </span>
                {group.missing}
              </p>
            )}
            <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed font-medium">
              {group.nextAction}
            </p>
            {group.examples.length > 0 && (
              <p className="text-muted-foreground mt-1 max-w-2xl text-[12.5px] leading-relaxed">
                {group.examples.join("  ·  ")}
                {group.count > group.examples.length &&
                  ` and ${group.count - group.examples.length} more`}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * **Complete against current knowledge.**
 *
 * Not *"Atlas knows every recreation place in the Okanagan"* — that has no
 * denominator and never will. This says something narrower and entirely true:
 * **everything Atlas currently knows about has been processed**, and every
 * mission that could be started has finished.
 *
 * Which means it can stop being true without anything having been wrong. New
 * evidence creates new work; the previous completion was correct against the
 * evidence that existed when it was made. That is why the wording is *current
 * knowledge* and why nothing about it is stored.
 *
 * Restrained on purpose. This is a real moment in the work, and it earns
 * scale and space — not a badge, not points, not a colour it has not earned.
 */
export function DomainComplete({
  domainName,
  regionName,
  queue,
  placed,
  known,
  missionsComplete,
  missionsTotal,
}: {
  domainName: string;
  regionName: string;
  queue: DomainWorkQueue;
  placed: number;
  known: number;
  missionsComplete: number;
  missionsTotal: number;
}) {
  return (
    <div className="border-border flex flex-col gap-5 border-y py-10">
      <p className="text-primary text-[11.5px] font-medium tracking-widest uppercase">
        ✓ Current knowledge complete
      </p>

      <p className="font-heading max-w-2xl text-4xl leading-[1.1] font-medium tracking-tight">
        Everything Atlas knows about {domainName} has been processed.
      </p>

      <dl className="mt-1 flex flex-wrap gap-x-12 gap-y-4">
        <Figure term="Known" value={known} />
        <Figure term={`Placed in ${regionName}`} value={placed} />
        <Figure term="Waiting on you" value={0} />
        <Figure
          term="Missions complete"
          value={`${missionsComplete} of ${missionsTotal}`}
        />
      </dl>

      <p className="text-muted-foreground max-w-2xl text-[13px] leading-relaxed">
        Complete <em>against current knowledge</em> — not a claim that Atlas
        knows every {domainName.toLowerCase()} place in {regionName}, which has
        no denominator. When a publisher yields something new, this becomes work
        again, and today&apos;s completion will not have been wrong.
        {queue.blockedMissions > 0 &&
          ` ${queue.blockedMissions} mission${queue.blockedMissions === 1 ? " is" : "s are"} blocked on a change Atlas cannot make itself, and ${queue.blockedMissions === 1 ? "is" : "are"} not counted here.`}
      </p>
    </div>
  );
}

function Figure({ term, value }: { term: string; value: number | string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-[12px] tracking-wide uppercase">
        {term}
      </dt>
      <dd className="font-heading text-2xl font-medium tabular-nums">
        {value}
      </dd>
    </div>
  );
}
