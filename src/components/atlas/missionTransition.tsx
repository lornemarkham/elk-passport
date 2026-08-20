"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * **"Something finished while you were away."**
 *
 * Mission progression is derived, and that creates one real gap in the
 * experience: the instant a mission's conditions turn true, the *next* mission
 * becomes current. A server render has no memory of a previous state, so an
 * operator who runs a CLI command and refreshes sees a different mission and no
 * acknowledgement that the old one finished. The work succeeded and the page
 * said nothing.
 *
 * ## Why this is browser memory, and why that is honest
 *
 * The fix must not be a stored mission status — that is the asserted pointer
 * ADR 044 removed, and it would be able to disagree with the corpus. What is
 * missing is not a fact about Atlas; it is a fact about **this operator's last
 * visit**. So that is what is stored, in `localStorage`, and every message is
 * worded as *since you last looked*.
 *
 * Atlas's own state is untouched. Clear the browser and you lose the greeting,
 * not the truth — the mission roster still shows exactly which missions are
 * complete, because that is derived.
 *
 * ## Two transitions worth announcing
 *
 * **A mission completed.** The remembered mission is now complete and is no
 * longer current: it finished between visits. Named, with what became current
 * in its place.
 *
 * **Update available.** The domain was complete when last seen and is not any
 * more. That does not make the earlier completion wrong — it was complete
 * against the evidence that existed then, and new evidence created new work.
 * Saying "update available" rather than "no longer complete" is the difference
 * between those two readings.
 */

interface Remembered {
  readonly missionId: string | null;
  readonly complete: boolean;
}

function storageKey(domainSlug: string): string {
  return `atlas:domain-visit:${domainSlug}`;
}

function read(domainSlug: string): Remembered | null {
  try {
    const raw = window.localStorage.getItem(storageKey(domainSlug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Remembered>;
    return {
      missionId: typeof parsed.missionId === "string" ? parsed.missionId : null,
      complete: parsed.complete === true,
    };
  } catch {
    // A browser with storage disabled loses the greeting, not the truth.
    return null;
  }
}

type Announcement =
  | { readonly kind: "completed"; readonly title: string }
  | { readonly kind: "update" };

export function MissionTransition({
  domainSlug,
  currentMissionId,
  currentMissionTitle,
  completedMissionIds,
  missionTitles,
  domainComplete,
}: {
  domainSlug: string;
  currentMissionId: string | null;
  currentMissionTitle: string | null;
  /** Ids whose conditions are satisfied right now. Derived, never stored. */
  completedMissionIds: readonly string[];
  missionTitles: Readonly<Record<string, string>>;
  domainComplete: boolean;
}) {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const settled = useRef(false);

  useEffect(() => {
    // Once per mount, guarded. The guard is what makes this safe: the effect
    // reads browser memory and immediately overwrites it, so a second run
    // would read its own write and find nothing to announce. Strict Mode's
    // double invocation makes that a real case, not a theoretical one — an
    // earlier version revealed the banner by DOM mutation instead and lost it
    // on the remount for exactly this reason.
    if (settled.current) return;
    settled.current = true;

    const remembered = read(domainSlug);
    let next: Announcement | null = null;
    if (remembered) {
      if (remembered.complete && !domainComplete) {
        next = { kind: "update" };
      } else if (
        remembered.missionId &&
        remembered.missionId !== currentMissionId &&
        completedMissionIds.includes(remembered.missionId)
      ) {
        next = {
          kind: "completed",
          title: missionTitles[remembered.missionId] ?? "That mission",
        };
      }
    }

    try {
      window.localStorage.setItem(
        storageKey(domainSlug),
        JSON.stringify({
          missionId: currentMissionId,
          complete: domainComplete,
        } satisfies Remembered),
      );
    } catch {
      // Nothing to do — the page is fully usable without the greeting.
    }
    // The single state write, and the whole reason this is an effect: what to
    // announce depends on browser memory, which does not exist during server
    // rendering, so it cannot be known until after mount. `settled` makes this
    // run once, so it cannot cascade.
    if (next) setAnnouncement(next);
  }, [
    domainSlug,
    currentMissionId,
    domainComplete,
    completedMissionIds,
    missionTitles,
  ]);

  if (!announcement) return null;

  if (announcement.kind === "update") {
    return (
      <div className="border-border flex flex-col gap-3 border-y py-7">
        <p className="text-[11.5px] font-medium tracking-widest uppercase">
          Update available
        </p>
        <p className="font-heading max-w-2xl text-2xl leading-tight font-medium tracking-tight">
          Atlas found more work since you last looked.
        </p>
        <p className="text-muted-foreground max-w-2xl text-[13px] leading-relaxed">
          The earlier completion was not wrong — it was complete against the
          evidence that existed then. New evidence created new work.
        </p>
      </div>
    );
  }

  return (
    <div className="border-border flex flex-col gap-3 border-y py-7">
      <p className="text-primary text-[11.5px] font-medium tracking-widest uppercase">
        ✓ Mission complete
      </p>
      <p className="font-heading max-w-2xl text-2xl leading-tight font-medium tracking-tight">
        {announcement.title}
      </p>
      <p className="text-muted-foreground max-w-2xl text-[13px] leading-relaxed">
        Finished since you last looked — its conditions are now true. Atlas
        moved on by itself; nothing was marked done by hand.
      </p>
      {currentMissionTitle && (
        <p className="max-w-2xl text-sm leading-relaxed">
          <span className="text-muted-foreground">Now current: </span>
          <span className="font-medium">{currentMissionTitle}</span>
        </p>
      )}
    </div>
  );
}

/**
 * **Refresh status.**
 *
 * The whole MVP loop is *run the operation, come back, let Atlas work out what
 * changed*. This is that second step made explicit, so an operator who has just
 * finished a command in a terminal has something obvious to press instead of
 * wondering whether the page updates itself.
 *
 * It is `router.refresh()` and nothing else: the server component re-reads
 * Atlas, re-evaluates every mission, the work queue, health and Passport
 * readiness, and re-renders. There is no polling, no socket and no job to
 * track — refreshing *is* the mechanism, because everything on the page is
 * derived from facts Atlas already holds.
 */
export function RefreshStatus({
  label = "Refresh status",
}: {
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        router.refresh();
        // The refresh is a server round trip with no completion callback here;
        // a short disable is enough to stop a double-press, and the re-render
        // replaces this component anyway.
        window.setTimeout(() => setBusy(false), 1200);
      }}
      className="border-border hover:bg-muted focus-visible:ring-ring w-fit rounded-md border px-3.5 py-1.5 text-[13px] font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
    >
      {busy ? "Re-reading Atlas…" : label}
    </button>
  );
}
