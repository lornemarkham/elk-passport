import type React from "react";
import {
  MISSION_STATE_LABEL,
  type MissionProgress,
} from "@/lib/knowledge/missions";

/**
 * **A Knowledge Domain is operated as an ordered sequence of finite missions.**
 *
 * The page used to spread one question — *what do I do next?* — across a
 * mission section, a work queue, a mission roster, health, Passport readiness
 * and Reference. Every one of those was true, and answering the question meant
 * combining six of them by hand.
 *
 * This is the spine instead. One ordered list, worked top to bottom: finished
 * missions collapsed behind a tick, the current mission open and holding the
 * whole working surface, later missions closed until their turn, blocked ones
 * visible and plainly set apart. There is exactly one open panel by default,
 * and it is the answer.
 *
 * ## It renders the state machine; it does not own one
 *
 * Which mission is current is decided by `evaluateDomain`, from Atlas's own
 * facts: the first mission that is neither complete nor blocked. **Nothing
 * here is stored, advanced or remembered.** An operation changes Atlas, a
 * refresh re-evaluates every condition, and the panel that opens is a
 * consequence of the corpus, never of a click.
 *
 * That is also why a completed mission collapses without being told to, and
 * why a mission can un-complete: if reality regresses, the sequence reopens at
 * the mission that is no longer finished, which is correct.
 *
 * ## Order is the guidance, not a rule
 *
 * The authored order is the intended path, and the current mission is always
 * the earliest one that can be worked. But a later mission whose conditions
 * are already true renders **complete**, out of sequence and without argument
 * — derived reality outranks expected order, and inventing a dependency to
 * keep the list tidy would be asserting something Atlas cannot see.
 *
 * ## Why `<details>`, and why the state is in the key
 *
 * Native disclosure: keyboard and screen-reader behaviour for free, no state
 * to persist, nothing to animate. The operator can open any panel they like —
 * this guides, it does not lock.
 *
 * The `key` carries the mission's derived state on purpose. React updates
 * `open` only when the prop changes, and a panel the operator has toggled by
 * hand has already diverged from it; keying on state makes the element fresh
 * the moment the mission's state changes, so the newly-current mission is
 * reliably open after a refresh rather than sometimes.
 */

export interface SequenceItem {
  readonly progress: MissionProgress;
  /**
   * A short line for the closed row — what remains, in this mission's own
   * units. Absent when the state label says everything worth saying.
   */
  readonly status?: string;
  /** What this panel shows when open. Composed by the page, per state. */
  readonly body: React.ReactNode;
}

const MARK: Record<MissionProgress["state"], string> = {
  complete: "✓",
  current: "○",
  queued: "○",
  blocked: "—",
};

export function MissionSequence({ items }: { items: readonly SequenceItem[] }) {
  if (items.length === 0) {
    return (
      <p className="max-w-2xl text-sm leading-relaxed">
        No missions are defined for this domain yet.
      </p>
    );
  }

  return (
    <ol className="divide-border border-border divide-y border-y">
      {items.map(({ progress, status, body }, index) => {
        const { mission, state } = progress;
        const complete = state === "complete";
        const current = state === "current";

        return (
          <li key={`${mission.id}:${state}`}>
            <details open={current} className="group">
              <summary className="hover:bg-muted/40 focus-visible:ring-ring flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1 px-1 py-4 transition-colors focus-visible:ring-2 focus-visible:outline-none">
                <span
                  aria-hidden
                  className={`shrink-0 text-[12px] leading-none ${complete ? "text-primary" : "text-muted-foreground/40"}`}
                >
                  {MARK[state]}
                </span>
                <span
                  aria-hidden
                  className="text-muted-foreground shrink-0 font-mono text-[11px] tracking-widest tabular-nums"
                >
                  {index + 1}
                </span>

                <span className="min-w-[12rem] flex-1">
                  <span
                    className={`block leading-snug ${
                      current
                        ? "font-heading text-[17px] font-medium tracking-tight"
                        : complete
                          ? "text-muted-foreground text-sm"
                          : "text-sm"
                    }`}
                  >
                    {mission.title}
                  </span>
                  {status && (
                    <span className="text-muted-foreground mt-0.5 block text-[12.5px] leading-relaxed">
                      {status}
                    </span>
                  )}
                </span>

                <span
                  className={`shrink-0 text-[11px] font-medium tracking-widest uppercase ${
                    complete
                      ? "text-primary"
                      : current
                        ? "text-foreground"
                        : "text-muted-foreground"
                  }`}
                >
                  {current ? "Current" : MISSION_STATE_LABEL[state]}
                </span>
              </summary>

              <div className="px-1 pt-2 pb-8">{body}</div>
            </details>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * **What a finished mission looks like when someone opens it again.**
 *
 * Evidence, and nothing operable. A completed mission that still offered its
 * Execute controls would be telling the operator there is work here when
 * Atlas says there is not — and in a sequence worked top to bottom, a stale
 * control is worse than a missing one: it pulls attention backwards past the
 * mission that actually needs it.
 */
export function CompletedMission({ progress }: { progress: MissionProgress }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-2xl text-sm leading-relaxed">
        {progress.mission.outcome}
      </p>
      <div>
        <h4 className="text-muted-foreground text-[11.5px] font-medium tracking-widest uppercase">
          Why Atlas calls this done
        </h4>
        <ul className="divide-border mt-2 divide-y">
          {progress.outcome.conditions.map(({ condition, result }) => (
            <li key={condition.id} className="flex gap-3 py-2.5">
              <span
                aria-hidden
                className="text-primary mt-[3px] shrink-0 text-[13px] leading-none"
              >
                ✓
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium">
                  {condition.label}
                </span>
                <span className="text-muted-foreground mt-0.5 block max-w-2xl text-[12.5px] leading-relaxed">
                  {result.detail}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-muted-foreground max-w-2xl text-[12.5px] leading-relaxed">
        Read from Atlas just now, not recorded when it happened. If the corpus
        changes so that one of these stops being true, this mission reopens —
        which is the point of deriving it.
      </p>
    </div>
  );
}

/**
 * **A mission that is not this operator's turn yet.**
 *
 * Shown in full — objective, reasons, and the conditions it will be graded on
 * — because knowing what is coming is useful. Given no controls, because
 * starting it now would be working out of order against a page whose whole
 * purpose is order.
 */
export function QueuedMission({
  progress,
  waitingOn,
}: {
  progress: MissionProgress;
  /** The mission that must finish first. Absent when this is next in line. */
  waitingOn?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-2xl text-sm leading-relaxed">
        {progress.mission.outcome}
      </p>
      <ul className="marker:text-muted-foreground flex max-w-2xl list-disc flex-col gap-1.5 pl-4">
        {progress.mission.why.map((line) => (
          <li key={line} className="text-[13px] leading-relaxed">
            {line}
          </li>
        ))}
      </ul>
      <div>
        <h4 className="text-muted-foreground text-[11.5px] font-medium tracking-widest uppercase">
          It will be finished when
        </h4>
        <ul className="mt-2 flex flex-col gap-1.5">
          {progress.outcome.conditions.map(({ condition, result }) => (
            <li
              key={condition.id}
              className="flex gap-3 text-[13px] leading-relaxed"
            >
              <span aria-hidden className="text-muted-foreground/40 shrink-0">
                ○
              </span>
              <span>
                {condition.label}
                <span className="text-muted-foreground">
                  {" "}
                  — {result.detail}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-muted-foreground max-w-2xl text-[12.5px] leading-relaxed">
        {waitingOn
          ? `Becomes current when "${waitingOn}" finishes. Nothing advances it by hand — Atlas re-reads its conditions on every refresh.`
          : "Becomes current the moment the mission above finishes. Nothing advances it by hand."}
      </p>
    </div>
  );
}

/**
 * **A capability, not a backlog item.**
 *
 * `blockedBy` is the one authored fact about a mission's state, and it means
 * something specific: an operator cannot start this, because the world stops
 * them. Rendering it as another unticked row would put work on a list that
 * nobody can pick up — so it is stated as what it is, with the change that
 * would clear it, and kept out of the sequence's completion arithmetic.
 */
export function BlockedMission({
  progress,
  operationBuilt,
}: {
  progress: MissionProgress;
  /** False when no command exists for this yet — a truthful blocker, not a missing button. */
  operationBuilt: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-2xl text-sm leading-relaxed">
        {progress.mission.outcome}
      </p>
      {progress.mission.blockedBy && (
        <p className="max-w-2xl text-sm leading-relaxed">
          <span className="text-muted-foreground text-[12px] tracking-wide uppercase">
            Blocked{" "}
          </span>
          {progress.mission.blockedBy}
        </p>
      )}
      <ul className="marker:text-muted-foreground flex max-w-2xl list-disc flex-col gap-1.5 pl-4">
        {progress.mission.why.map((line) => (
          <li key={line} className="text-[13px] leading-relaxed">
            {line}
          </li>
        ))}
      </ul>
      {!operationBuilt && (
        <p className="max-w-2xl text-[13px] leading-relaxed">
          <span className="text-muted-foreground">Operation: </span>
          not built yet. There is no command to show, and inventing a button for
          one would be the more expensive mistake.
        </p>
      )}
      <p className="text-muted-foreground max-w-2xl text-[12.5px] leading-relaxed">
        This can still complete without anyone clearing the blocker: if the
        corpus comes to satisfy its conditions, the blocker cleared in reality
        and the catalogue was simply out of date. Facts outrank the assertion.
      </p>
    </div>
  );
}
